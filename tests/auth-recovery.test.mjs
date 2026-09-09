import assert from 'node:assert/strict'
import test from 'node:test'
import { AuthenticatedCommandClient } from '../dist/esm/custom/client.js'
import { recoverableBearer } from '../dist/esm/custom/auth/recovery.js'
import { AuthProviderError } from '../dist/esm/custom/auth/types.js'

const fixture = async (respond, refreshError, responseBody = () => ({ok:true})) => {
  let saved = { version:1,issuer:'https://clerk.test',clientId:'client',accessToken:'old',refreshToken:'refresh-old',
    accessTokenExpiresAt:Date.now()+3600000,userId:'user',organizationId:'org',grantedScopes:['offline_access','user:org:read'] }
  let lock = Promise.resolve()
  let refreshes = 0
  const store = { backend:'file',read:async()=>saved,write:async(value)=>{saved=value},remove:async()=>false,
    withLifecycleLock:(fn)=>{const run=lock.then(fn);lock=run.catch(()=>{});return run} }
  const provider = { issuer:saved.issuer,clientId:saved.clientId,
    refresh:async(s)=>{refreshes++;if(refreshError?.()) throw refreshError();return {...s,accessToken:'new',refreshToken:'refresh-new'}},
    login:async()=>{throw Error('unexpected login')},revoke:async()=>false }
  const requests=[]
  const client=new AuthenticatedCommandClient({apiKey:null,xAPIKey:null,bearerAuth:await recoverableBearer('old',store,provider),
    baseURL:'https://gateway.test',maxRetries:0,fetch:async(url,init)=>{
      requests.push({headers:new Headers(init.headers),body:init.body})
      const status=respond(requests.length,new Headers(init.headers))
      return new Response(JSON.stringify(status===200?responseBody(url):{error_code:'invalid_token'}),{status,headers:{'content-type':'application/json'}})
    }})
  return {client,requests,refreshes:()=>refreshes,store,session:()=>saved}
}

test('401 refresh retries once with identical mutation body and idempotency key',async()=>{
 const f=await fixture((n)=>n===1?401:200)
 assert.deepEqual(await f.client.post('/v1/machines',{body:{vcpu:1}}),{ok:true})
 assert.equal(f.requests.length,2);assert.equal(f.refreshes(),1)
 assert.equal(f.requests[0].body,f.requests[1].body)
 assert.ok(f.requests[0].headers.get('idempotency-key'))
 assert.equal(f.requests[0].headers.get('idempotency-key'),f.requests[1].headers.get('idempotency-key'))
 assert.equal(f.requests[1].headers.get('authorization'),'Bearer new')
})

test('repeated 401 stops after one retry; 403 never refreshes',async()=>{
 for(const code of [401,403]){
  const f=await fixture(()=>code)
  await assert.rejects(f.client.get('/v1/machines'),e=>e.status===code)
  assert.equal(f.requests.length,code===401?2:1);assert.equal(f.refreshes(),code===401?1:0)
 }
})

test('concurrent rejected requests share one refresh under the storage lock',async()=>{
 const f=await fixture((_n,h)=>h.get('authorization')==='Bearer old'?401:200)
 await Promise.all([f.client.get('/one'),f.client.get('/two')])
 assert.equal(f.refreshes(),1);assert.equal(f.requests.length,4)
})

test('reloads a token refreshed by another process without another refresh',async()=>{
 const f=await fixture((n)=>n===1?401:200)
 await f.store.write({...f.session(),accessToken:'other-process'})
 await f.client.get('/one')
 assert.equal(f.refreshes(),0)
 assert.equal(f.requests[1].headers.get('authorization'),'Bearer other-process')
})

test('recovery refuses an account change without replaying the request',async()=>{
 const f=await fixture(()=>401)
 await f.store.write({...f.session(),accessToken:'other-account',userId:'different'})
 await assert.rejects(f.client.get('/one'),e=>e.code==='cli_session_identity_changed')
 assert.equal(f.refreshes(),0);assert.equal(f.requests.length,1)
})

test('temporary refresh outage preserves credentials and a later command recovers',async()=>{
 let offline=true
 const failure=new AuthProviderError('refresh_failed',{stage:'network'})
 const f=await fixture((_n,h)=>h.get('authorization')==='Bearer old'?401:200,()=>offline?failure:undefined)
 await assert.rejects(f.client.get('/one'),e=>e===failure)
 assert.equal(f.session().refreshToken,'refresh-old')
 offline=false
 await f.client.get('/two')
 assert.equal(f.refreshes(),2);assert.equal(f.session().refreshToken,'refresh-new')
})

test('permanent failure is cached for the same credential without repeated refresh calls',async()=>{
 const failure=new AuthProviderError('invalid_grant',{stage:'provider',status:400})
 const f=await fixture(()=>401,()=>failure)
 for(let n=0;n<2;n++)await assert.rejects(f.client.get('/one'),e=>e===failure)
 assert.equal(f.refreshes(),1);assert.equal(f.session().refreshToken,'refresh-old')
})

test('API keys do not enter OAuth recovery',async()=>{
 let calls=0
 const client=new AuthenticatedCommandClient({apiKey:'key',bearerAuth:null,xAPIKey:null,baseURL:'https://gateway.test',maxRetries:0,
 fetch:async()=>{calls++;return new Response('{}',{status:401,headers:{'content-type':'application/json'}})}})
 await assert.rejects(client.get('/one'),e=>e.status===401)
 assert.equal(calls,1)
})

test('consumable request streams are not replayed after a 401',async()=>{
 const f=await fixture(()=>401)
 const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('payload'));controller.close()}})
 await assert.rejects(f.client.post('/upload',{body}),e=>e.status===401)
 assert.equal(f.requests.length,1);assert.equal(f.refreshes(),0)
})

test('recovered response retains raw streaming response support',async()=>{
 const f=await fixture(n=>n===1?401:200)
 const response=await f.client.get('/events',{__binaryResponse:true})
 assert.ok(response instanceof Response)
 assert.deepEqual(await response.json(),{ok:true})
})

test('native generated pagination recovers OAuth on a later page', async () => {
 const f=await fixture((n)=>n===2?401:200,undefined,(url)=>String(url).includes('cursor=next')
   ?{items:[{machine_id:'two'}],next_cursor:null}:{items:[{machine_id:'one'}],next_cursor:'next'})
 const items=[]
 for await(const item of f.client.machines.list()) items.push(item.machine_id)
 assert.deepEqual(items,['one','two'])
 assert.equal(f.refreshes(),1)
 assert.equal(f.requests.length,3)
 assert.equal(f.requests[2].headers.get('authorization'),'Bearer new')
})

test('transient retries cannot start a second OAuth recovery for one request', async () => {
 const statuses=[401,500,401]
 const f=await fixture(n=>statuses[n-1])
 await assert.rejects(f.client.machines.retrieve({machine_id:'one'},{maxRetries:1}),e=>e.status===401)
 assert.equal(f.refreshes(),1)
 assert.equal(f.requests.length,3)
})
