'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto'),{gzipSync}=require('node:zlib');
const producer=require('../../scripts/build-startup-codec.cjs'),hash=b=>createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(path.join(__dirname,'../src/scene-cache46.js'),'utf8'),anchor=' Y.SceneCache46={warmup,load,receive,textureSource,decodeOrder};',outer={YY:{}};
vm.runInNewContext(source.replace(anchor,' Y.__worker=workerSource;Y.__kernel=deltaKernelBytes;\n'+anchor),outer);
function fixture(codec,rows=8192){
 const {unit,lanes}=producer.definitions[codec],bytes=new Uint8Array(rows*unit*lanes),view=new DataView(bytes.buffer),edges=[0,0xffffffff,0x80000000,0x7f800000,0xff800000,0x7fc01234,0x80000001,1,0x7fff,0x8000,0xffff];let random=73;
 for(let i=0;i<bytes.length/unit;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;const v=i<edges.length?edges[i]:random;if(unit===2)view.setUint16(i*unit,v&65535,true);else view.setUint32(i*unit,v,true);}
 return bytes;
}
for(const codec of Object.keys(producer.definitions)){
 test(codec+' independent producer inverse retains every bit including wraps, signed zero and NaN payloads',()=>{const raw=fixture(codec),planes=producer.encodeRaw(raw,codec),restored=producer.decodeRaw(planes,codec);assert.deepEqual(Buffer.from(restored),Buffer.from(raw));assert.equal(planes.length,raw.length);});
 for(const dataViewFallback of [false,true])test(codec+' actual worker '+(dataViewFallback?'DataView fallback':'native typed arrays')+' exactly restores all original words',async()=>{
  const raw=fixture(codec),planes=producer.encodeRaw(raw,codec),packed=gzipSync(planes),posts=[],requests=[],scope={Blob,Response,DecompressionStream,ReadableStream,Uint8Array,Uint16Array,Uint32Array,Float32Array,Float64Array,DataView,ArrayBuffer,Map,Set,WebAssembly,crypto:webcrypto,atob,setTimeout,clearTimeout};scope.self=scope;scope.compileVisibility=()=>{};scope.fetch=async u=>{requests.push(u);throw Error('Unexpected fallback');};scope.postMessage=r=>posts.push(r);
  let worker=outer.YY.__worker;if(dataViewFallback){const a='const little=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;';assert.equal(worker.split(a).length,2);worker=worker.replace(a,'const little=false;');}vm.runInNewContext(worker,scope);
  await scope.onmessage({data:{index:0,url:'https://scene.test/original.gz',rawBytes:raw.length,sha256:hash(raw),shuffle:0,buckets:[],transport:{codec,bytes:packed.length,buffer:Uint8Array.from(packed).buffer}}});assert.equal(posts.length,1);assert.equal(posts[0].codec,codec);assert.equal(posts[0].error,undefined);assert.deepEqual(Buffer.from(posts[0].buffer),Buffer.from(raw));assert.deepEqual(requests,[]);
 });
}
test('corrupted startup transport falls back once to original checked legacy and publishes once',async()=>{
 const codec='gzip-u32x8-zigzag-v1',raw=fixture(codec),packed=gzipSync(producer.encodeRaw(raw,codec)),original=gzipSync(raw),posts=[],requests=[];packed[packed.length-5]^=128;
 const scope={Blob,Response,DecompressionStream,ReadableStream,Uint8Array,Uint16Array,Uint32Array,Float32Array,Float64Array,DataView,ArrayBuffer,Map,Set,WebAssembly,crypto:webcrypto,atob,setTimeout,clearTimeout};scope.self=scope;scope.compileVisibility=()=>{};scope.fetch=async u=>{requests.push(u);return new Response(original);};scope.postMessage=r=>posts.push(r);vm.runInNewContext(outer.YY.__worker,scope);
 await scope.onmessage({data:{index:0,url:'https://scene.test/original.gz',rawBytes:raw.length,sha256:hash(raw),shuffle:0,buckets:[],transport:{codec,bytes:packed.length,buffer:Uint8Array.from(packed).buffer}}});assert.equal(posts.length,1);assert.equal(posts[0].codec,'legacy');assert.ok(posts[0].fallbackReason);assert.deepEqual(Buffer.from(posts[0].buffer),Buffer.from(raw));assert.deepEqual(requests,['https://scene.test/original.gz']);
});
test('integer SIMD kernel provenance, imported arena and three-tile carry/reset are exact',async()=>{
 assert.equal(hash(outer.YY.__kernel),'25917253b40594f0de75aa2103903f6bc5ff1fc37bae482de6e9513884b46750');
 assert.equal(hash(fs.readFileSync(path.join(__dirname,'../tools/scene-startup-delta.wat'))),'16cc643a15a837ebe4fc3c7a03466e953b239eb68d4432fcccdf9aef7aa1178a');
 const module=new WebAssembly.Module(outer.YY.__kernel);assert.deepEqual(WebAssembly.Module.imports(module),[{module:'env',name:'memory',kind:'memory'}]);assert.deepEqual(WebAssembly.Module.exports(module).map(x=>x.name),['reset','undo']);
 const codec='gzip-u32x8-zigzag-v1',scope={Blob,Response,DecompressionStream,ReadableStream,Uint8Array,Uint16Array,Uint32Array,Float32Array,Float64Array,DataView,ArrayBuffer,Map,Set,WebAssembly,crypto:webcrypto,atob,setTimeout,clearTimeout};scope.self=scope;scope.compileVisibility=()=>{};scope.fetch=()=>{throw Error('Unexpected fallback');};scope.postMessage=r=>{scope.last=r;};
 vm.runInNewContext(outer.YY.__worker+'\nself.inspect=()=>({active:!!deltaKernelState,bytes:wasm32State.instance.exports.memory.buffer.byteLength,memory:wasm32State.instance.exports.memory});',scope);
 for(const rows of [16385,8193]){const raw=fixture(codec,rows);raw[0]=rows&255;const packed=gzipSync(producer.encodeRaw(raw,codec));await scope.onmessage({data:{index:0,url:'https://scene.test/a.gz',rawBytes:raw.length,sha256:hash(raw),shuffle:32,buckets:[],transport:{codec,bytes:packed.length,buffer:Uint8Array.from(packed).buffer}}});assert.equal(scope.last.codec,codec);assert.deepEqual(Buffer.from(scope.last.buffer),Buffer.from(raw));assert.equal(scope.inspect().active,true);assert.equal(scope.inspect().bytes,524288);}
 assert.throws(()=>scope.inspect().memory.grow(1),RangeError);
});
