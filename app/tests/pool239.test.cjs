const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=process.env.PKU_BASE239||path.resolve(__dirname,'..');
const enginePath=process.env.PKU_ENGINE239||path.join(app,'src/engine.js');
const source=fs.readFileSync(enginePath,'utf8');
function gpu(virtual=false){
 let serial=0,array=null,vao=null,sequence=0;const stores=new Map(),reads=[],syncs=[],events=[],trace=[];
 const g={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,FLOAT:3,DYNAMIC_DRAW:4,TRIANGLES:5,UNSIGNED_SHORT:6,UNSIGNED_INT:7,BUFFER_SIZE:8,
  SYNC_GPU_COMMANDS_COMPLETE:9,ALREADY_SIGNALED:10,CONDITION_SATISFIED:11,TIMEOUT_EXPIRED:12,WAIT_FAILED:13,lost:false,failData:false,nullFence:false,failWait:false,nullBuffer:false,
  createBuffer(){if(g.nullBuffer)return null;const b={id:++serial};events.push(['createBuffer',b]);return b;},
  deleteBuffer(b){events.push(['deleteBuffer',b]);stores.delete(b);},
  bindBuffer(target,b){if(target===1)array=b;else if(vao)vao.index=b;events.push(['bindBuffer',target,b]);},
  bufferData(target,size){assert.equal(typeof size,'number');events.push(['bufferData',array,size]);if(g.failData){g.failData=false;return;}stores.set(array,{size,bytes:virtual?null:Buffer.alloc(size)});},
  getBufferParameter(){return stores.get(array)?.size||0;},
  bufferSubData(target,offset,data,start,length){const store=stores.get(array);assert(store&&store.size>=offset+length*4);assert(!reads.some(r=>!r.done&&r.store===store),'write into a store still read by the GPU');events.push(['bufferSubData',array,length*4]);if(!virtual)Buffer.from(new Uint8Array(data.buffer,data.byteOffset+start*4,length*4)).copy(store.bytes,offset);},
  fenceSync(condition,flags){assert.equal(condition,9);assert.equal(flags,0);if(g.nullFence)return null;const f={id:++serial,limit:sequence,done:false};syncs.push(f);events.push(['fence',f]);return f;},
  clientWaitSync(f,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);events.push(['poll',f]);return g.failWait?g.WAIT_FAILED:f.done?g.ALREADY_SIGNALED:g.TIMEOUT_EXPIRED;},
  deleteSync(f){assert(!f.deleted,'sync deleted twice');f.deleted=true;events.push(['deleteSync',f]);},isContextLost(){return g.lost;},
  createVertexArray(){const v={id:++serial,a:{}};events.push(['createVAO',v]);return v;},bindVertexArray(v){vao=v;},deleteVertexArray(v){events.push(['deleteVAO',v]);},
  vertexAttribPointer(a,n,type,normalized,stride,offset){assert(vao);vao.a[a]={buffer:array,stride,offset};events.push(['pointer',a,array,offset]);},
  enableVertexAttribArray(){},vertexAttribDivisor(){},useProgram(){},enable(){},disable(){},depthMask(){},blendFunc(){},deleteTexture(){},deleteProgram(){},
  drawElementsInstanced(mode,count,type,offset,instances){g.draw(count,instances);},drawArraysInstanced(mode,first,count,instances){g.draw(count,instances);},
  draw(count,instances){const a=vao.a[3],store=stores.get(a.buffer);assert(store);const bytes=Buffer.from(store.bytes.subarray(a.offset,a.offset+instances*112));assert.equal(bytes.length,instances*112);trace.push({count,instances,bytes});g.read(a.buffer);},
  read(buffer){const store=stores.get(buffer);assert(store);reads.push({sequence:++sequence,store,bytes:store.bytes&&Buffer.from(store.bytes),done:false});},
  complete(f){for(const x of syncs)if(x.limit<=f.limit)x.done=true;for(const r of reads)if(r.sequence<=f.limit&&!r.done){r.result=r.store.bytes&&Buffer.from(r.store.bytes);r.done=true;}},
  assertOriginalReads(){for(const r of reads)if(r.bytes)assert.deepEqual(r.done?r.result:r.store.bytes,r.bytes,'an earlier queued draw changed');},
  stores,reads,syncs,events,trace
 };return g;
}
function fixture(quality='low',virtual=false){
 const Y={},ctx=vm.createContext({YY:Y});for(const n of ['math','visibility'])vm.runInContext(fs.readFileSync(path.join(app,'src/'+n+'.js'),'utf8'),ctx);vm.runInContext(source,ctx);
 const gl=gpu(virtual),e=Object.assign(Object.create(Y.Engine.prototype),{gl,qualityPreset:quality,state:{deferredInstanceVAO:true},stats:{instanceUploadBytes:0},buckets:new Map(),frameFences:[{originalQueue:true}]});
 return{Y,e,gl};
}
function stream(f,pass=0,used=56,seed=1){
 const s=f.e.instanceStream(pass);if(s.data.length<used)s.data=new Float32Array(used);
 const words=new Uint32Array(s.data.buffer,s.data.byteOffset,s.data.length);for(let i=0;i<used;i++)words[i]=[0x80000000,0x7fc12355,0xff800000,(i+seed)>>>0][i%4];s.used=used;return s;
}
function prepare(f,s,pass=0){f.e.prepareInstancePool239(s,pass,f.e.state);f.e.uploadInstances(s);}
function draw(f,s,pass=0){f.gl.read(s.buffer);f.e.fenceInstancePool239(pass);}
const bytes=s=>Buffer.from(new Uint8Array(s.data.buffer,s.data.byteOffset,s.used*4));

for(const quality of ['medium','low'])test('GPU readers remain immutable while two fenced stores rotate: '+quality,()=>{
 const f=fixture(quality),q=f.e.frameFences,s1=stream(f);prepare(f,s1);const a=s1.buffer;draw(f,s1);const fenceA=s1.poolEntry239.fence;
 const s2=stream(f,0,56,2);prepare(f,s2);const b=s2.buffer;assert.notEqual(a,b);draw(f,s2);const fenceB=s2.poolEntry239.fence;
 const s3=stream(f,0,56,3);prepare(f,s3);assert.equal(s3.buffer,s3.baseBuffer239,'both busy means original base orphan path');assert.equal(f.e.instancePoolStatus239().busyFallbacks,1);
 f.gl.complete(fenceA);const dataEvents=f.gl.events.filter(e=>e[0]==='bufferData').length;const s4=stream(f,0,56,4);prepare(f,s4);assert.equal(s4.buffer,a);assert.equal(f.gl.events.filter(e=>e[0]==='bufferData').length,dataEvents,'idle store needs no allocation');
 assert.deepEqual(f.gl.stores.get(a).bytes.subarray(0,s4.used*4),bytes(s4));assert.equal(f.e.frameFences,q);assert.equal(f.e.frameFences.length,1);f.gl.assertOriginalReads();assert(!fenceB.done);
});
test('cached draws replace the ownership fence, including picking pass1',()=>{
 const f=fixture(),s=stream(f);prepare(f,s);draw(f,s);const old=s.poolEntry239.fence,buffer=s.buffer;f.gl.read(s.buffer);f.e.fenceInstancePool239(1);const latest=s.poolEntry239.fence;
 assert.notEqual(old,latest);assert(old.deleted);assert(!latest.deleted);f.gl.complete(old);const other=stream(f,0,56,2);prepare(f,other);assert.notEqual(other.buffer,buffer,'completion of an older draw cannot release a newer cached/pick read');f.gl.assertOriginalReads();
});
test('WAIT_FAILED never grants reuse of a pending GPU store',()=>{
 const f=fixture(),s=stream(f);prepare(f,s);draw(f,s);const old=s.poolEntry239,buffer=s.buffer;f.gl.failWait=true;
 const next=stream(f,0,56,3);prepare(f,next);assert(old.failed);assert.notEqual(next.buffer,buffer);assert.equal(f.e.instancePoolStatus239().fenceFailures,1);f.gl.assertOriginalReads();
});
test('growth allocates only a completed store; shrinking preserves NaN and signed-zero bits',()=>{
 const f=fixture(),s=stream(f,0,56);prepare(f,s);draw(f,s);const first=s.poolEntry239.fence;f.gl.complete(first);
 let next=stream(f,0,2800,7);prepare(f,next);draw(f,next);f.gl.complete(next.poolEntry239.fence);const count=f.gl.events.filter(e=>e[0]==='bufferData').length;
 next=stream(f,0,28,9);prepare(f,next);assert.equal(f.gl.events.filter(e=>e[0]==='bufferData').length,count);assert.deepEqual(f.gl.stores.get(next.buffer).bytes.subarray(0,112),bytes(next));f.gl.assertOriginalReads();
});
test('empty prefixes allocate and upload no optional storage',()=>{
 const f=fixture(),s=stream(f,0,0);const count=f.gl.events.length;prepare(f,s);assert.equal(f.gl.events.length,count);assert.equal(f.e.instancePoolStatus239().buffers,0);assert.equal(f.e.stats.instanceUploadBytes,0);
});
test('High issues only the original base allocation and subdata pair',()=>{
 const f=fixture('high'),s=stream(f);const q=f.e.frameFences;prepare(f,s);f.e.fenceInstancePool239(0);
 assert.equal(s.buffer,s.baseBuffer239);assert.equal(f.e.instancePoolStatus239().buffers,0);assert.equal(f.gl.syncs.length,0);assert.deepEqual(f.gl.events.filter(e=>['bufferData','bufferSubData'].includes(e[0])).map(e=>e[0]),['bufferData','bufferSubData']);assert.equal(q,f.e.frameFences);
});
test('High after a lower-quality cache rebuild returns to its original base store',()=>{
 const f=fixture(),s=stream(f);prepare(f,s);draw(f,s);const pool=s.buffer;f.e.qualityPreset='high';const high=stream(f);prepare(f,high);assert.notEqual(high.buffer,pool);assert.equal(high.buffer,high.baseBuffer239);
 const n=f.gl.syncs.length;f.e.fenceInstancePool239(0);assert.equal(f.gl.syncs.length,n);f.gl.assertOriginalReads();
});
for(const option of ['nondeferred','unknownpass','capabilities','lost'])test('unsupported path delegates to the original base upload: '+option,()=>{
 const f=fixture(),pass=option==='unknownpass'?9:0;if(option==='nondeferred')f.e.state.deferredInstanceVAO=false;if(option==='capabilities')f.gl.getBufferParameter=undefined;if(option==='lost')f.gl.lost=true;
 const s=stream(f,pass);prepare(f,s,pass);assert.equal(s.buffer,s.baseBuffer239);assert.equal(f.e.instancePoolStatus239().buffers,0);assert.deepEqual(f.gl.events.filter(e=>['bufferData','bufferSubData'].includes(e[0])).map(e=>e[0]),['bufferData','bufferSubData']);
});
test('allocation failure retires optional store and uploads correct bytes to base',()=>{
 const f=fixture(),s=stream(f);f.gl.failData=true;prepare(f,s);assert.equal(s.buffer,s.baseBuffer239);assert.equal(f.e.instancePoolStatus239().allocationFailures,1);assert.deepEqual(f.gl.stores.get(s.buffer).bytes.subarray(0,s.used*4),bytes(s));
});
test('a missing new buffer falls back without retaining a phantom entry',()=>{
 const f=fixture(),s=stream(f);f.gl.nullBuffer=true;prepare(f,s);assert.equal(s.buffer,s.baseBuffer239);assert.equal(f.e.instancePoolStatus239().buffers,0);
});
test('failed fence creation retires the store without unsafe reuse',()=>{
 const f=fixture(),s=stream(f);prepare(f,s);const old=s.buffer;f.gl.nullFence=true;draw(f,s);assert(s.poolEntry239.failed);const next=stream(f,0,56,4);prepare(f,next);assert.notEqual(next.buffer,old);f.gl.assertOriginalReads();assert.equal(f.e.instancePoolStatus239().fenceFailures,1);
});
test('the total optional reservation stays within64MiB across all passes and busy fallbacks',()=>{
 const f=fixture('medium',true),data=new Float32Array(4*1024*1024);
 for(let round=0;round<3;round++)for(const pass of [0,2,3]){const s=f.e.instanceStream(pass);s.data=data;s.used=data.length;prepare(f,s,pass);draw(f,s,pass);assert(f.e.instancePoolStatus239().reservedBytes<=64*1024*1024);assert(f.e.instancePoolStatus239().buffers<=6);}
 assert(f.e.instancePoolStatus239().budgetFallbacks>0);assert(f.e.instancePoolStatus239().fences<=6);
});
test('release owns every extra object once and leaves original base ownership intact',()=>{
 const f=fixture();for(const pass of [0,2,3])for(let i=0;i<2;i++){const s=stream(f,pass,56,i);prepare(f,s,pass);draw(f,s,pass);}
 const pools=[...f.e.instancePool239.passes.values()].flatMap(p=>p.entries),bases=[...f.e.instanceStreams.values()].map(s=>s.baseBuffer239);
 f.e.releaseInstancePool239();f.e.releaseInstancePool239();assert.equal(f.e.instancePoolStatus239().reservedBytes,0);
 for(const p of pools)assert.equal(f.gl.events.filter(e=>e[0]==='deleteBuffer'&&e[1]===p.buffer).length,1);
 for(const b of bases)assert.equal(f.gl.events.filter(e=>e[0]==='deleteBuffer'&&e[1]===b).length,0);
 for(const s of f.e.instanceStreams.values())assert.equal(s.buffer,s.baseBuffer239);
});
function modelFixture(){
 const f=fixture(),{e,Y}=f;e.state={...e.state,staticInstanceBindings:false,selected:0,isolate:0,explode:0,detailLOD:true,meshCulling:true,vegetation:true,routeEdges:new Set(),specializedCeramic:false,specializedFoliage:false,skyAfterOpaque:false};
 Object.assign(e,{camera:{eye:[0,0,10],fov:.8},canvas:{clientHeight:1000},visibilityCaches:new Map(),stats:{visibilityBuilds:0,instanceUploadBytes:0},reflectTarget:{w:100,h:100,tex:{}},shadowTarget:{tex:{}},main:{p:1},glass:{p:2},meshResources:[],uniform(){},sampler(){},stateUniforms(){},disposeTarget(){}});
 const resource={vertexBuffer:{name:'vertices'},indexBuffer:{name:'indices'},indexType:'uint16'};
 for(let i=0;i<5;i++){const data=new Float32Array(28);data.set(Y.M.identity());data[20]=i===4?44:24;data[21]=i+1;data.set([0,0,1,1],24);const b={resource,vertexCount:6,data,count:1,spatial:new Float32Array([0,0,0,1,1]),passes:new Map()};Y.Visibility.compile(b);e.buckets.set('b'+i,b);}
 e.visibleRanges=()=>null;e.reflectionPlanes=vp=>Y.M.frustum(vp);f.vp=Y.M.identity();return f;
}
test('actual visibleScene/draw preserve grouped GPU bytes, cached draws and changed membership',()=>{
 const f=modelFixture();for(const slot of [0,2,3]){f.gl.trace.length=0;f.e.draw(f.e.main,f.vp,f.e.camera.eye,slot);const stream=f.e.instanceStreams.get(slot);assert(stream.poolEntry239);assert(stream.poolEntry239.fence);assert.deepEqual(Buffer.concat(f.gl.trace.splice(0).map(t=>t.bytes)),bytes(stream));
 const uploads=f.gl.events.filter(e=>e[0]==='bufferSubData').length;const fence=stream.poolEntry239.fence;f.e.draw(f.e.main,f.vp,f.e.camera.eye,slot);assert.equal(f.gl.events.filter(e=>e[0]==='bufferSubData').length,uploads);assert(fence.deleted);}
 for(const fence of f.gl.syncs)f.gl.complete(fence);f.gl.trace.length=0;f.e.buckets.delete('b2');f.e.visibilityCaches.clear();f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);const s=f.e.instanceStreams.get(0);assert.deepEqual(Buffer.concat(f.gl.trace.map(t=>t.bytes)),bytes(s));f.gl.assertOriginalReads();
});
test('a CPU stream reset cannot lose ownership of a cached GPU draw',()=>{
 const f=modelFixture();f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);
 const s=f.e.instanceStreams.get(0),entry=s.poolEntry239,buffer=s.buffer,oldFence=entry.fence;
 f.e.instanceStream(0);assert.equal(s.poolEntry239,null);
 f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);assert.notEqual(entry.fence,oldFence,'cached plan retains the actual GPU store owner');
 f.gl.complete(oldFence);f.e.visibilityCaches.clear();f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);
 assert.notEqual(s.buffer,buffer,'newer cached read still prevents reuse');f.gl.assertOriginalReads();
});
test('direct external upload rebinds cached dynamic VAOs to base and keeps old GPU readers intact',()=>{
 const f=modelFixture();f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);const s=f.e.instanceStreams.get(0),old=s.buffer;s.data[20]=23;f.e.uploadInstances(s);assert.equal(s.buffer,s.baseBuffer239);assert.notEqual(s.buffer,old);
 for(const b of f.e.buckets.values()){const record=b.passes.get(0);if(record)assert.equal(record.instanceBuffer,s.baseBuffer239);}f.gl.assertOriginalReads();f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);
});
test('borrowed drawing with no optional ownership hooks retains the original base path',()=>{
 const f=modelFixture();for(const key of ['prepareInstancePool239','recordInstancePoolPlan239','fenceInstancePool239','releaseInstancePool239'])f.e[key]=undefined;
 f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);const s=f.e.instanceStreams.get(0);
 assert.equal(s.buffer,s.baseBuffer239);assert.equal(f.e.instancePoolStatus239().buffers,0);assert.equal(f.gl.syncs.length,0);assert.deepEqual(Buffer.concat(f.gl.trace.map(t=>t.bytes)),bytes(s));
 f.e.dispose();
});
test('a partial prototype adapter cannot enable reuse without its fencing capability',()=>{
 const f=modelFixture();f.e.fenceInstancePool239=undefined;f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);const s=f.e.instanceStreams.get(0);
 assert.equal(s.buffer,s.baseBuffer239);assert.equal(f.e.instancePoolStatus239().reservedBytes,0);assert.equal(f.gl.syncs.length,0);
});
test('real dispose deletes base, optional stores, VAOs and fences once; fresh engine starts empty',()=>{
 const f=modelFixture();f.e.draw(f.e.main,f.vp,f.e.camera.eye,0);const base=f.e.instanceStreams.get(0).baseBuffer239;f.e.dispose();f.e.dispose();assert.equal(f.gl.events.filter(e=>e[0]==='deleteBuffer'&&e[1]===base).length,1);assert.equal(f.e.instancePoolStatus239().buffers,0);assert.equal(fixture().e.instancePoolStatus239().buffers,0);
});

test('two pending stores for each observed Native lower-tier peak fit without budget fallback',()=>{
 const f=fixture('medium',true),peaks=[[0,5706400],[2,6377504],[3,2583392]];
 for(let round=0;round<2;round++)for(const [pass,usedBytes] of peaks){
  const s=f.e.instanceStream(pass);s.data=new Float32Array(usedBytes/4);s.used=s.data.length;prepare(f,s,pass);assert.notEqual(s.buffer,s.baseBuffer239);draw(f,s,pass);
 }
 const status=f.e.instancePoolStatus239();assert.equal(status.buffers,6);assert.equal(status.fences,6);assert.equal(status.budgetFallbacks,0);assert(status.reservedBytes>32*1024*1024&&status.reservedBytes<=64*1024*1024);f.gl.assertOriginalReads();
});
