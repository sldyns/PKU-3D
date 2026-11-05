'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto'),{gzipSync}=require('node:zlib');
const source=fs.readFileSync(path.join(__dirname,'../src/scene-cache46.js'),'utf8'),anchor=' Y.SceneCache46={warmup,load,receive,textureSource,decodeOrder};';
function host(fetch){
 const ctx={YY:{},URL,Uint8Array,ArrayBuffer,AbortController,ReadableStream,DecompressionStream,WebAssembly,crypto:webcrypto,location:{protocol:'https:',origin:'https://scene.test'},fetch};
 vm.runInNewContext(source.replace(anchor,' Y.__stream={createTransport,workerSource};\n'+anchor),ctx);return ctx;
}
function fixture(options={}){
 const bodies=[Uint8Array.from([1,2,3,4,5]),Uint8Array.from([6,7,8])],calls=[];
 const m={sourceHash:'same-source',chunks:[{bytes:3},{bytes:2},{bytes:3}],transport:{version:1,sourceHash:'same-source',parts:[{file:'startup-'+ 'a'.repeat(24)+'.bin',bytes:5,entries:[{index:0,bytes:3,codec:'legacy'},{index:1,bytes:2,codec:'legacy'}]},{file:'startup-'+ 'b'.repeat(24)+'.bin',bytes:3,entries:[{index:2,bytes:3,codec:'legacy'}]}]}};
 const ctx=host(async(url,init)=>{const index=calls.length;calls.push({url,init});return options.fetch?options.fetch(index,init):new Response(bodies[index]);});
 return{ctx,m,calls,create(){return ctx.YY.__stream.createTransport(m,'https://scene.test/cache/',[0,1,2],()=>null);}};
}
test('stream reproduces ordered opaque chunks over part/read boundaries and remains demand driven',async()=>{
 const f=fixture(),s=f.create();assert.ok(await s.start());assert.equal(f.calls.length,1);
 const second=s.get(1),first=await s.get(0);assert.deepEqual([...new Uint8Array(first.buffer)],[1,2,3]);s.release(first.bytes);
 const b=await second;assert.deepEqual([...new Uint8Array(b.buffer)],[4,5]);s.release(b.bytes);assert.equal(f.calls.length,1,'next part waits for a real decoder demand');
 const c=await s.get(2);assert.deepEqual([...new Uint8Array(c.buffer)],[6,7,8]);s.release(c.bytes);await s.finish();assert.equal(f.calls.length,2);assert.equal(s.stats.bytes,8);assert.equal(s.stats.chunks,3);assert.equal(s.stats.heldBytes,0);assert.ok(s.stats.peakCompressedBytes<=10);assert.ok(s.stats.byobReads>=3);assert.equal(s.stats.byobTransfers,s.stats.byobReads,'every completed read re-adopts a transferred byte buffer');s.dispose();assert.equal(s.stats.disposed,true);
});
test('untrusted descriptor paths, size/order/codec/source mismatch keep original transport without fetching',()=>{
 const edits=[m=>m.transport.sourceHash='other',m=>m.transport.parts[0].file='../x',m=>m.transport.parts[0].bytes++,m=>m.transport.parts[0].entries[0].bytes++,m=>m.transport.parts[0].entries[0].codec='unknown',m=>m.transport.parts[0].entries.reverse(),m=>m.transport.parts.pop()];
 for(const edit of edits){const f=fixture();edit(f.m);assert.equal(f.create(),null);assert.equal(f.calls.length,0);}
});
test('local-file and unsupported streaming capabilities use original transport',()=>{
 for(const feature of ['file','ReadableStream','DecompressionStream','crypto']){const f=fixture();if(feature==='file')f.ctx.location.protocol='file:';else f.ctx[feature]=undefined;assert.equal(f.create(),null);}
});
test('first pack unavailable falls back before a chunk or decoder is published',async()=>{
 const f=fixture({fetch:()=>new Response('',{status:404})}),s=f.create();assert.equal(await s.start(),false);assert.equal(s.stats.mode,'legacy');assert.equal(s.stats.chunks,0);s.dispose();
});
test('truncation rejects the waiting chunk and the full completion barrier',async()=>{
 const f=fixture({fetch:()=>new Response(Uint8Array.of(1,2))}),s=f.create();await s.start();await assert.rejects(s.get(0),/Incomplete/);await assert.rejects(s.finish(),/Incomplete/);s.dispose();
});
test('extra bytes cannot pass the final readiness barrier',async()=>{
 const f=fixture({fetch:()=>new Response(Uint8Array.of(1,2,3,4,5,6))}),s=f.create();await s.start();for(const i of [0,1]){const r=await s.get(i);s.release(r.bytes);}await assert.rejects(s.finish(),/Unexpected/);s.dispose();
});
test('disposal aborts a stalled body and rejects pending decoder demand',async()=>{
 let cancelled=0;const f=fixture({fetch:()=>new Response(new ReadableStream({type:'bytes',cancel(){cancelled++;}}))}),s=f.create();await s.start();const pending=s.get(0);s.dispose();await assert.rejects(pending,/interrupted/);await assert.rejects(s.get(1),/interrupted/);assert.equal(cancelled,1);assert.equal(s.stats.disposed,true);
});
test('non-byte response retains the original transport before any publication',async()=>{
 const f=fixture({fetch:()=>new Response(new ReadableStream({start(c){c.close();}}))}),s=f.create();assert.equal(await s.start(),false);assert.equal(s.stats.mode,'legacy');assert.equal(s.stats.chunks,0);s.dispose();
});
test('a second part failure stays terminal without cross-job or script retries',async()=>{
 const f=fixture({fetch:i=>i?new Response('',{status:503}):new Response(Uint8Array.of(1,2,3,4,5))}),s=f.create();await s.start();for(const i of [0,1]){const r=await s.get(i);s.release(r.bytes);}await assert.rejects(s.get(2),/HTTP 503/);await assert.rejects(s.finish(),/HTTP 503/);assert.equal(f.calls.length,2);s.dispose();
});
test('actual worker decodes transferred legacy bytes, verifies raw SHA and makes no chunk fetch',async()=>{
 const ctx=host(()=>{}),raw=Uint8Array.from({length:64},(_,i)=>i),packed=gzipSync(raw),posts=[],requests=[];
 const scope={Blob,Response,DecompressionStream,ReadableStream,Uint8Array,Uint32Array,Float32Array,Float64Array,ArrayBuffer,Map,Set,WebAssembly,crypto:webcrypto,atob,setTimeout,clearTimeout};scope.self=scope;scope.compileVisibility=()=>{};scope.fetch=async u=>{requests.push(u);throw Error('Unexpected fetch');};scope.postMessage=r=>posts.push(r);
 vm.runInNewContext(ctx.YY.__stream.workerSource,scope);const buffer=Uint8Array.from(packed).buffer;
 await scope.onmessage({data:{index:0,url:'https://scene.test/a.gz',rawBytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),shuffle:0,buckets:[],transport:{codec:'legacy',buffer}}});
 assert.equal(posts.length,1);assert.equal(posts[0].codec,'legacy');assert.deepEqual([...new Uint8Array(posts[0].buffer)],[...raw]);assert.deepEqual(requests,[]);
});
for(const corrupt of [false,true])test('actual worker stream modern '+(corrupt?'SHA failure falls back to original legacy exactly once':'decodes verified bytes without a chunk fetch'),async()=>{
 const ctx=host(()=>{}),raw=Uint8Array.from({length:64},(_,i)=>i),good=gzipSync(raw),packed=gzipSync(corrupt?new Uint8Array(raw.length):raw),posts=[],requests=[];
 const scope={Blob,Response,DecompressionStream,ReadableStream,Uint8Array,Uint32Array,Float32Array,Float64Array,ArrayBuffer,Map,Set,WebAssembly,crypto:webcrypto,atob,setTimeout,clearTimeout};scope.self=scope;scope.compileVisibility=()=>{};scope.fetch=async u=>{requests.push(u);return new Response(good);};scope.postMessage=r=>posts.push(r);scope.__decoder=async()=>({MeshoptDecoder:{supported:true,ready:Promise.resolve(),decodeVertexBuffer(out,count,stride,input){out.set(input);}}});
 vm.runInNewContext(ctx.YY.__stream.workerSource.replace('import(url)','__decoder(url)'),scope);
 const codec='gzip-meshopt-attributes-v1',url='https://scene.test/original.gz';
 await scope.onmessage({data:{index:0,url,rawBytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),shuffle:0,buckets:[],decoderURL:'https://scene.test/decoder.mjs',alternative:{codec,url:'https://scene.test/modern.gz',bytes:packed.length,decodedBytes:raw.length,count:16,stride:4,sha256:'a'.repeat(64)},transport:{codec,buffer:Uint8Array.from(packed).buffer}}});
 assert.equal(posts.length,1);assert.equal(posts[0].codec,corrupt?'legacy':codec);assert.deepEqual([...new Uint8Array(posts[0].buffer)],[...raw]);assert.deepEqual(requests,corrupt?[url]:[]);if(corrupt)assert.match(posts[0].fallbackReason,/checksum/);
});
