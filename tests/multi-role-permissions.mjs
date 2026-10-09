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
  },URLSearchParams,URL,Request,Response,FormData});
  return exports;
}
const roles=load(await compile('../lib/roles.ts'));
const permissions=load(await compile('../app/dashboard/resources/permissions.ts'),{'@/lib/roles':roles});
const combinations=[[true,[]],[false,['facilitator']],[false,['expert']],[false,['facilitator','expert']],
  [true,['facilitator']],[true,['expert']],[true,['facilitator','expert']]];
let checks=0;
const eq=(a,b)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),b);checks++;};
const make=(admin,codes,active=true)=>({id:'user',role:admin?'expert':'admin',is_admin:admin,is_active:active,profile_operational_roles:codes.map(role_code=>({role_code}))});
const authCode=await compile('../app/dashboard/lib.ts');
const redirect=path=>{throw Object.assign(new Error('redirect'),{path});};
async function expectRedirect(fn,path) {await assert.rejects(fn,e=>e.path?.startsWith(path));checks++;}
for(const [admin,codes] of combinations) {
  const profile=make(admin,codes);
  eq(permissions.teamPermissionLabels(profile),[
    ...(admin?['Administrator']:[]),
    ...codes.map(code=>code==='facilitator'?'Facilitator':'Expert')
  ]);
  eq(roles.isAdminRole(profile),admin);
  eq(roles.canAccessAssignedWork(profile),true);
  eq(roles.canBeAssignedToTripSheet(profile),true);
  eq(roles.visibleCardCategories(profile).sort(),admin?['expert','facilitator']:[...codes].sort());
  eq(roles.eligibleProfiles([profile,profile,{...profile,id:'inactive',is_active:false}]).map(p=>p.id),['user']);
  let queries=0;
  const auth=load(authCode,{
    'next/navigation':{redirect},'@/lib/roles':roles,
    '@/lib/supabase/server':{async createClient(){return {
      auth:{async getUser(){return {data:{user:{id:'user'}}};}},
      from(){return {select(){queries++;return {eq(){return {async maybeSingle(){return {data:profile,error:null};}};}};}};}
    };}}
  });
  eq(auth.getSignedInHomePath(profile),admin?'/dashboard/trips':'/my-trips');
  if(admin) {eq((await auth.requireAdmin()).profile.is_admin,true);await expectRedirect(()=>auth.requireResource(),'/dashboard/trips');}
  else {await expectRedirect(()=>auth.requireAdmin(),'/my-trip-sheets');eq((await auth.requireResource()).profile.id,'user');}
  eq((await auth.requireAdminOrResource()).profile.id,'user');
  eq(queries,3); // One embedded-membership query per guard call, not a query per role.
}
for(const profile of [null,make(true,[],false),make(false,[],true),{role:'admin',is_active:true}]) {
  eq(roles.isAdminRole(profile),false);
  eq(roles.canAccessAssignedWork(profile),false);
  eq(roles.canBeAssignedToTripSheet(profile),false);
  eq(roles.visibleCardCategories(profile),[]);
}
// Actual detail renderer enforces own assignment even for Admins on personal URLs.
const detailCode=await compile('../app/trip-sheets/[id]/TripSheetDetailPageContent.tsx');
const detailSource=await read('../app/trip-sheets/[id]/TripSheetDetailPageContent.tsx');
const imports=[...detailSource.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>m[1]);
for(const [admin,codes] of combinations) {
  const filters=[];
  const profile=make(admin,codes);
  const supabase={from(table){
    const query={select(){return query;},eq(key,value){filters.push([table,key,value]);return query;},
      async maybeSingle(){return {data:{id:'sheet',trip:{id:'trip'}}};},
      async limit(){return {data:[],error:null};}};
    return query;
  }};
  const dependencies=Object.fromEntries(imports.map(name=>[name,{}]));
  dependencies['react/jsx-runtime']={jsx(){throw new Error('Unassigned personal details must never render');},jsxs(){throw new Error('Unassigned personal details must never render');}};
  dependencies['next/navigation']={redirect};
  dependencies['@/lib/roles']=roles;
  dependencies['@/lib/trip-sheets']={getTripParent:r=>r};
  dependencies['@/app/dashboard/lib']={getCurrentUserProfile:async()=>({supabase,user:{id:'user'},profile}),getSignedInHomePath:()=>'/my-trips'};
  const detail=load(detailCode,dependencies);
  await expectRedirect(()=>detail.renderTripSheetDetailPage({id:'sheet',personal:true}),'/my-trip-sheets');
  assert(filters.some(f=>f[0]==='trip_sheet_assignments' && f[1]==='resource_user_id' && f[2]==='user'));checks++;
}
// Independent PDF, notification and calendar action guards must reject legacy
// role=admin if the authoritative flag is false, before any service client/write.
async function isolated(path,client) {
  const source=await read(path);
  const names=[...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const dependencies=Object.fromEntries(names.map(name=>[name,{}]));
  dependencies['@/lib/roles']=roles;
  dependencies['@/lib/supabase/server']={createClient:async()=>client};
  dependencies['@/lib/supabase/admin']={createAdminClient(){throw new Error('Unauthorized service client access');}};
  dependencies['next/server']={NextResponse:Response};
  return load(await compile(path),dependencies);
}
for(const profile of [null,make(false,['facilitator','expert']),make(true,[],false)]) {
  const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},from(table){
    assert.equal(table,'profiles');
    const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:profile,error:null})};return q;
  }};
  const pdf=await isolated('../app/dashboard/trips/[id]/pdf/route.ts',client);
  eq((await pdf.GET(new Request('https://example.test/pdf'),{params:Promise.resolve({id:'trip'})})).status,403);
  const notification=await isolated('../app/dashboard/trips/trip-notifications.ts',client);
  eq((await notification.sendTripNotification('trip')).ok,false);
  const calendar=await isolated('../app/dashboard/trip-sheets/actions.ts',client);
  eq((await calendar.replaceTripSheetAssignments('sheet',['target'])).ok,false);
  eq((await calendar.updateTripSheetSchedule({tripSheetId:'sheet',startDate:'2026-10-09',startTime:'09:00',endDate:'2026-10-09',endTime:'10:00'})).ok,false);
}
// Retaining an existing assignment after role removal must not delete/recreate it.
{
  const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from(table){
    const data=table==='profiles'?make(true,[]):table==='trip_sheets'?{id:'sheet'}:[{id:'existing-assignment',resource_user_id:'removed-role-user'}];
    const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data,error:null}),then(resolve){resolve({data,error:null});}};return q;
  }};
  const actions=await isolated('../app/dashboard/trip-sheets/actions.ts',client);
  const result=await actions.replaceTripSheetAssignments('sheet',['removed-role-user','removed-role-user']);
  eq([result.ok,result.addedCount,result.removedCount],[true,0,0]);
}
console.log(`PASS: ${checks} multi-role application assertions.`);
