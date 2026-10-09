import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const compile=async path=>ts.transpileModule(await read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(code,dependencies={}) {
  const exports={};
  vm.runInNewContext(code,{exports,require:name=>{
    if(!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  },FormData,URL,URLSearchParams,process:{env:{NODE_ENV:'production'}}});
  return exports;
}
let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);checks++;};
const roles=load(await compile('../lib/roles.ts'));
const views=load(await compile('../lib/interface-view.ts'),{'@/lib/roles':roles});
const id='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
const make=(admin,codes,active=true)=>({is_admin:admin,is_active:active,profile_operational_roles:codes.map(role_code=>({role_code}))});
const combinations=[[true,[]],[true,['facilitator']],[true,['expert']],[true,['facilitator','expert']],
  [false,['facilitator']],[false,['expert']],[false,['facilitator','expert']]];

for(const [admin,codes] of combinations) {
  const profile=make(admin,codes);
  eq(views.getEffectiveInterfaceView(profile,null),admin?'admin':'resource');
  eq(views.getEffectiveInterfaceView(profile,'resource'),'resource');
  eq(views.getEffectiveInterfaceView(profile,'admin'),admin?'admin':'resource');
}
for(const profile of [null,make(true,[],false),make(false,['expert'],false),make(false,[],true)]) {
  eq(views.getEffectiveInterfaceView(profile,'admin'),null);
}
const encoded=views.serializeInterfaceViewPreference(id,'resource');
eq(views.parseInterfaceViewPreference(encoded,id),'resource');
eq(views.parseInterfaceViewPreference(encoded,other),null);
eq(views.parseInterfaceViewPreference('resource',id),null);
eq(views.parseInterfaceView('admin'),'admin');
eq(views.parseInterfaceView('owner'),null);

const redirect=path=>{throw Object.assign(new Error('redirect'),{path});};
const dashboard=load(await compile('../app/dashboard/lib.ts'),{
  'next/navigation':{redirect},
  '@/lib/roles':roles,
  '@/lib/interface-view':views,
  '@/lib/supabase/server':{createClient:async()=>({})},
});
for(const [admin,codes] of combinations) {
  const profile=make(admin,codes);
  eq(dashboard.getSignedInHomePath(profile,'resource'),'/my-trips');
  eq(dashboard.getSignedInHomePath(profile,'admin'),admin?'/dashboard/trips':'/my-trips');
}

// Cookie persistence is browser-local, server-readable, and bound to one profile ID.
let written;
const cookieModule=load(await compile('../app/lib/interface-view-cookie.ts'),{
  'next/headers':{cookies:async()=>({get:()=>({value:encoded}),set:(...args)=>{written=args;}})},
  '@/lib/interface-view':views,
});
eq(await cookieModule.getInterfaceViewPreference(id),'resource');
eq(await cookieModule.getInterfaceViewPreference(other),null);
await cookieModule.setInterfaceViewPreference(id,'admin');
eq(written,[views.INTERFACE_VIEW_COOKIE,views.serializeInterfaceViewPreference(id,'admin'),{
  httpOnly:true,sameSite:'lax',secure:true,path:'/',maxAge:31536000,
}]);

// The server action reauthorizes every switch; a forged Admin preference cannot elevate a non-admin.
const actionCode=await compile('../app/interface-view-actions.ts');
async function switchResult(profile,requested,preference=null) {
  const writes=[];
  const action=load(actionCode,{
    'next/navigation':{redirect:path=>{throw Object.assign(new Error('redirect'),{path});}},
    '@/app/dashboard/lib':{
      getCurrentUserProfile:async()=>({user:{id},profile}),
      getSignedInHomePath:(current,pref)=>views.getInterfaceViewHomePath(views.getEffectiveInterfaceView(current,pref)),
    },
    '@/app/lib/interface-view-cookie':{
      getInterfaceViewPreference:async()=>preference,
      setInterfaceViewPreference:async(...args)=>writes.push(args),
    },
    '@/lib/interface-view':views,
    '@/lib/roles':roles,
  });
  const form=new FormData(); if(requested!==null) form.set('view',requested);
  let path; try {await action.switchInterfaceView(form);} catch(error) {path=error.path;}
  return {path,writes};
}
eq(await switchResult(make(true,[]),'resource'),{path:'/my-trips',writes:[[id,'resource']]});
eq(await switchResult(make(true,['expert']),'admin'),{path:'/dashboard/trips',writes:[[id,'admin']]});
eq(await switchResult(make(false,['facilitator']),'admin'),{path:'/my-trips',writes:[[id,'resource']]});
eq(await switchResult(make(true,[]),'invalid','resource'),{path:'/my-trips',writes:[]});

// Actual login action reads the current browser preference after authentication.
const authActionsCode=await compile('../app/auth/actions.ts');
async function loginPath(profile,preference) {
  const client={
    auth:{
      signInWithPassword:async()=>({error:null}),
      getUser:async()=>({data:{user:{id}}}),
      signOut:async()=>{},
    },
    from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:profile})}),
  };
  const actions=load(authActionsCode,{
    'next/navigation':{redirect},
    'next/headers':{cookies:async()=>({}),headers:async()=>({get:()=>null})},
    '@/app/dashboard/lib':dashboard,
    '@/app/lib/interface-view-cookie':{getInterfaceViewPreference:async()=>preference},
    '@/lib/auth-recovery':{passwordRecoveryCookieName:'recovery'},
    '@/lib/supabase/server':{createClient:async()=>client},
  });
  const form=new FormData(); form.set('email','user@example.test'); form.set('password','secret');
  try {await actions.login(form);} catch(error) {return error.path;}
}
eq(await loginPath(make(true,[]),null),'/dashboard/trips');
eq(await loginPath(make(true,[]),'resource'),'/my-trips');
eq(await loginPath(make(false,['expert']),'admin'),'/my-trips');

// Navigation exposes the switcher only in an authorized Admin context.
const jsx={Fragment:Symbol('fragment'),jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};
const Switcher=()=>null;
const nav=load(await compile('../app/dashboard/AdminNav.tsx'),{
  'react/jsx-runtime':jsx,
  'next/link':{default:'link'},
  '@/app/components/InterfaceViewSwitcher':{default:Switcher},
  '@/lib/roles':roles,
});
function elements(value,out=[]) {
  if(Array.isArray(value)) {for(const child of value) elements(child,out);return out;}
  if(value && typeof value==='object') {out.push(value);elements(value.props?.children,out);}
  return out;
}
const switcher=load(await compile('../app/components/InterfaceViewSwitcher.tsx'),{
  'react/jsx-runtime':jsx,
  '@/app/interface-view-actions':{switchInterfaceView:()=>{}},
});
const switcherTree=elements(switcher.default({currentView:'resource',className:'w-full'}));
const switcherButtons=switcherTree.filter(node=>node.type==='button');
eq(switcherTree.some(node=>node.type==='div' && node.props.className.includes('inline-grid') && node.props.className.includes('w-full')),true);
eq(switcherButtons.length,2);
eq(switcherButtons.find(node=>node.props.children==='Resource View').props['aria-pressed'],true);
eq(switcherButtons.find(node=>node.props.children==='Admin View').props['aria-pressed'],false);
for(const [admin,codes] of combinations) {
  const tree=elements(nav.default({current:'my-trips',profile:make(admin,codes),view:'resource'}));
  const switchers=tree.filter(node=>node.type===Switcher);
  const labels=tree.filter(node=>node.type==='link').map(node=>node.props.children).filter(value=>typeof value==='string');
  eq(switchers.length,admin?2:0); // One desktop and one mobile; responsive CSS shows one.
  eq(admin?switchers.some(node=>node.props.className==='w-full'):false,admin);
  eq(labels.includes('Overview'),false);
  eq(labels.includes('My Trips'),true);
  eq(labels.includes('My Trip Sheets'),true);
}
const adminTree=elements(nav.default({current:'overview'}));
const adminSwitchers=adminTree.filter(node=>node.type===Switcher);
const adminLabels=adminTree.filter(node=>node.type==='link').map(node=>node.props.children);
eq(adminSwitchers.length,2);
eq(adminSwitchers.some(node=>node.props.className==='w-full'),true);
eq(adminLabels.includes('Overview'),true);
eq(adminLabels.includes('My Trips'),false);
eq(adminLabels.includes('My Trip Sheets'),false);
eq(elements(nav.default({current:'my-trips',profile:make(true,['facilitator'],false),view:'resource'})).some(node=>node.type===Switcher),false);

console.log(`PASS: ${checks} interface-view assertions.`);
