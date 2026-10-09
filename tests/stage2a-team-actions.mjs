// Execute the actual server action module with isolated Auth/database boundaries.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const source = await compile('../app/dashboard/resources/actions.ts');
function moduleFrom(code, imports={}) {
  const exports={};
  vm.runInNewContext(code,{exports,require:name=>{
    if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`);
    return imports[name];
  },URLSearchParams,FormData});
  return exports;
}
const roles = moduleFrom(await compile('../lib/roles.ts'));
const permissions = moduleFrom(await compile('../app/dashboard/resources/permissions.ts'), {'@/lib/roles':roles});
const feedback = moduleFrom(await compile('../app/lib/action-feedback.ts'));
let assertions=0;
function eq(a,b) { assert.deepEqual(JSON.parse(JSON.stringify(a)),b); assertions++; }
function harness({unauthorized=false,profileError=null,transportFailure=false,authError=null,writeError=null}={}) {
  const calls=[];
  const client={
    auth:{admin:{
      async createUser(value) { calls.push(['createAuth',value]); return {data:{user:authError?null:{id:'created-auth-id'}},error:authError}; },
      async deleteUser() { throw new Error('Auth deletion must never be attempted'); }
    }},
    async rpc(name,value) {
      calls.push(['rpc',name,value]);
      if(transportFailure) throw new Error('network');
      return {error: value.p_email ? profileError : writeError};
    }
  };
  const actions=moduleFrom(source,{
    'next/navigation':{redirect(path) { throw Object.assign(new Error('redirect'),{path}); }},
    '@/app/dashboard/lib':{async requireAdmin() { calls.push(['guard']); if(unauthorized) throw new Error('denied'); return {supabase:client,user:{id:'admin-id'}}; }},
    '@/app/lib/action-feedback':feedback,
    '@/lib/roles':roles,
    './permissions':permissions,
    '@/lib/supabase/admin':{createAdminClient() { calls.push(['serviceClient']); return client; }}
  });
  return {actions,calls};
}
function form(values) {
  const f=new FormData();
  for(const [k,v] of Object.entries(values)) {
    if(v===undefined) continue;
    for(const item of Array.isArray(v)?v:[v]) f.append(k,item);
  }
  return f;
}
const base={full_name:'Name',email:'NAME@example.test',phone:'123',password:'secret123',
  permissions_form:'multi-role-v1',is_admin:'on',is_active:'on'};
async function redirectOf(fn) { try {await fn(); assert.fail('Expected redirect');} catch(e) {assert(e.path,e.message); assertions++; return new URL(e.path,'https://example.test');} }
const combinations=[[true,[]],[false,['facilitator']],[false,['expert']],[false,['facilitator','expert']],
  [true,['facilitator']],[true,['expert']],[true,['facilitator','expert']]];
for(const [isAdmin,roles] of combinations) {
  const fields={...base,is_admin:isAdmin?'on':undefined,operational_roles:roles};
  const h=harness();
  const result=await redirectOf(()=>h.actions.createResource(form(fields)));
  eq(result.searchParams.get('toast'),'done');
  eq(h.calls.map(c=>c[0]),['guard','serviceClient','createAuth','rpc']);
  eq(h.calls.at(-1),['rpc','save_profile_permissions',{p_id:'created-auth-id',p_full_name:'Name',p_phone:'123',p_email:'name@example.test',p_admin:isAdmin,p_roles:roles,p_active:true}]);
  const edit=harness();
  const editResult=await redirectOf(()=>edit.actions.updateResource(form({...fields,id:'target',full_name:'New name'})));
  eq(editResult.searchParams.get('toast'),'done');
  eq(edit.calls,[['guard'],['rpc','save_profile_permissions',{p_id:'target',p_full_name:'New name',p_phone:'123',p_email:null,p_admin:isAdmin,p_roles:roles,p_active:true}]]);
}
// Reject malformed/stale permission forms before creating an Auth identity or writing.
for(const invalid of [
  {...base,role:'admin'}, {...base,permissions_form:undefined},
  {...base,operational_roles:['guide']}, {...base,is_admin:'true'},
  {...base,is_admin:['on','on']}, {...base,is_active:'false'},
  {...base,is_admin:undefined,operational_roles:[]}
]) {
  for(const action of ['createResource','updateResource']) {
    const h=harness();
    const result=await redirectOf(()=>h.actions[action](form({...invalid,id:'target'})));
    eq(result.searchParams.has('error'),true);
    eq(h.calls,[['guard']]);
  }
}
// Inactive users may have no permissions; repeated membership inputs produce one set.
for(const fields of [
  {...base,is_admin:undefined,is_active:undefined,operational_roles:[]},
  {...base,is_admin:undefined,operational_roles:['facilitator','facilitator','expert']}
]) {
  const h=harness();
  await redirectOf(()=>h.actions.createResource(form(fields)));
  eq(h.calls.at(-1)[2].p_roles,fields.is_active?['facilitator','expert']:[]);
  eq(h.calls.at(-1)[2].p_active,Boolean(fields.is_active));
  eq(h.calls.filter(c=>c[0]==='createAuth').length,1);
}
for(const options of [{profileError:{message:'membership failure'}},{transportFailure:true}]) {
  const h=harness(options);
  const result=await redirectOf(()=>h.actions.createResource(form(base)));
  assert.match(result.searchParams.get('error'),/created-auth-id.*preserved.*Do not create it again/); assertions++;
  eq(result.searchParams.has('toast'),false);
  eq(h.calls.map(c=>c[0]),['guard','serviceClient','createAuth','rpc']);
}
{
  const h=harness({authError:{message:'Auth creation failed'}});
  const result=await redirectOf(()=>h.actions.createResource(form(base)));
  eq(result.searchParams.get('error'),'Auth creation failed');
  eq(h.calls.map(c=>c[0]),['guard','serviceClient','createAuth']);
}
for(const action of ['createResource','updateResource','toggleResourceActive','updateResourcePassword']) {
  const h=harness({unauthorized:true});
  await assert.rejects(h.actions[action](form(base)),/denied/); assertions++;
  eq(h.calls,[['guard']]);
}
{
  const h=harness({writeError:{message:'Cannot remove or deactivate the final active Administrator'}});
  const r=await redirectOf(()=>h.actions.toggleResourceActive(form({id:'target',next_is_active:'false'})));
  assert.match(r.searchParams.get('error'),/final active Administrator/); assertions++;
  eq(r.searchParams.has('toast'),false);
}
{
  const h=harness({writeError:{message:'Cannot remove or deactivate the final active Administrator'}});
  const r=await redirectOf(()=>h.actions.updateResource(form({...base,id:'admin-id',is_admin:undefined,operational_roles:['expert']})));
  assert.match(r.searchParams.get('error'),/final active Administrator/); assertions++;
  eq(r.searchParams.has('toast'),false);
}
{
  const h=harness({authError:{message:'A user with this email address has already been registered'}});
  const r=await redirectOf(()=>h.actions.createResource(form(base)));
  eq(r.searchParams.has('error'),true);
  eq(h.calls.filter(c=>c[0]==='rpc').length,0);
  eq(h.calls.filter(c=>c[0]==='createAuth').length,1);
}
// Exercise existing real authorization helpers; Stage 2A must not change landing
// or permit inactive/missing profiles to reach privileged actions.
const authSource=await compile('../app/dashboard/lib.ts');
for(const [role,active,exists] of [
  ['admin',true,true],['facilitator',true,true],['expert',true,true],
  ['admin',false,true],['admin',true,false]
]) {
  let signedOut=false;
  const auth=moduleFrom(authSource,{
    'next/navigation':{redirect(path) { throw Object.assign(new Error('redirect'),{path}); }},
    '@/lib/roles':roles,
    '@/lib/supabase/server':{async createClient() { return {
      auth:{async getUser() { return {data:{user:{id:'current-id'}}}; },async signOut() { signedOut=true; }},
      from() { return {select() { return {eq() { return {async maybeSingle() {
        return {data:exists?{role,is_active:active,is_admin:role==='admin',profile_operational_roles:role==='admin'?[]:[{role_code:role}]}:null,error:null};
      }}; }}; }}; }
    }; }}
  });
  eq(auth.getSignedInHomePath({is_active:true,is_admin:role==='admin',profile_operational_roles:role==='admin'?[]:[{role_code:role}]}),role==='admin'?'/dashboard/trips':'/my-trips');
  if(active && exists && role==='admin') {
    eq((await auth.requireAdmin()).profile.role,'admin');
  } else {
    const r=await redirectOf(()=>auth.requireAdmin());
    eq(r.pathname,active && exists?'/my-trip-sheets':'/login');
  }
  eq(signedOut,!active);
}
console.log(`PASS: ${assertions} Team/action authorization (Stage 2C independent RPC) assertions.`);
