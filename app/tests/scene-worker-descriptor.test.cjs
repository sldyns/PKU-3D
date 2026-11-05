'use strict';
// Executes the actual main-thread message expression and actual worker prepare.
// Missing worker fields throw, including after a future worker adds a new read.
const test=require('node:test'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{createHash,webcrypto}=require('node:crypto');
const source=fs.readFileSync(process.env.PKU_SCENE_CACHE_SOURCE||path.resolve(__dirname,'../src/scene-cache46.js'),'utf8');
const visibility=fs.readFileSync(process.env.PKU_VISIBILITY_SOURCE||path.resolve(__dirname,'../src/visibility.js'),'utf8');
const exportLine=' Y.SceneCache46={warmup,load,receive,textureSource,decodeOrder};';
assert.equal(source.split(exportLine).length,2);
const outer={YY:{}};
vm.runInNewContext(source.replace(exportLine,' Y.__descriptorWorker=workerSource;\n'+exportLine),outer);
const actualWorker=outer.YY.__descriptorWorker;
const messageLines=source.split('\n').filter(line=>line.includes('worker.postMessage({index,url:base+chunk.file,encoded,'));
assert.equal(messageLines.length,1,'actual message statement must be unique');
function strictFields(value){
 if(value===null||typeof value!=='object')return value;
 return new Proxy(value,{get(target,key){assert.ok(Object.hasOwn(target,key),'worker read missing descriptor field: '+String(key));return strictFields(target[key]);}});
}
function prepare(workerSource){
 const visibilityHost={YY:{}};vm.runInNewContext(visibility,visibilityHost);
 const ctx={Uint8Array,Uint32Array,Float32Array,Float64Array,ArrayBuffer,Map,Set,crypto:webcrypto};
 ctx.self=ctx;ctx.compileVisibility=visibilityHost.YY.Visibility.compile;vm.runInNewContext(workerSource,ctx);return ctx.prepare;
}
function fixture(count,detailWidth){
 const raw=new ArrayBuffer(count*33*4),data=new Float32Array(raw,0,count*28),spatial=new Float32Array(raw,count*28*4,count*5);
 for(let i=0;i<count;i++){
  const d=i*28,s=i*5;data[d]=data[d+5]=data[d+10]=data[d+15]=1;data[d+20]=i%2?38:4;data[d+21]=i%3?100:950001;data[d+23]=i%5;
  spatial[s]=i;spatial[s+1]=i%4;spatial[s+2]=i%7;spatial[s+3]=1.5;spatial[s+4]=2;
 }
 const record={mesh:0,count,data:{chunk:0,offset:0,length:count*28},spatial:{chunk:0,offset:count*28*4,length:count*5},key:'fixture',dataHash:'unused',spatialHash:'unused',lods:[],qualityRole:'unused'};
 const chunk={rawBytes:raw.byteLength,sha256:createHash('sha256').update(Buffer.from(raw)).digest('hex'),file:'fixture.gz',shuffle:0};
 let message;
 vm.runInNewContext(messageLines[0],{index:0,chunk,base:'https://scene.test/',encoded:undefined,prefetchURL:undefined,prefetchAlternative:undefined,alternative:null,transport:undefined,chunks:[{buckets:[record]}],m:{meshes:[{detailWidth}]},worker:{postMessage(value){message=value;}}});
 message.buckets=message.buckets.map(strictFields);return{raw,message};
}
test('actual worker prepare reads only fields supplied by the actual message',async()=>{
 const run=prepare(actualWorker);
 for(const count of [1,129])for(const detailWidth of [0,2]){
  const{raw,message}=fixture(count,detailWidth),result=await run(raw,message,false);
  assert.equal(result.buffer,raw);assert.equal(result.compiled.length,1);
 }
});
