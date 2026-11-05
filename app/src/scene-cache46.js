/* Load the byte-exact prepared scene off the UI thread, in bounded chunks. */
(function(Y){'use strict';
 const deltaKernelBytes=new Uint8Array([0,97,115,109,1,0,0,0,1,9,2,96,0,0,96,2,127,127,0,2,15,1,3,101,110,118,6,109,101,109,111,114,121,2,0,8,3,3,2,0,1,6,43,2,123,1,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,123,1,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,7,16,2,5,114,101,115,101,116,0,0,4,117,110,100,111,0,1,10,203,1,2,42,0,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,36,0,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,36,1,11,157,1,2,1,127,1,123,2,64,3,64,32,2,32,1,79,13,1,32,0,253,0,4,0,33,3,35,0,32,3,65,1,253,173,1,32,3,253,12,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,253,78,253,161,1,253,81,253,174,1,33,3,32,0,32,3,253,11,4,0,32,3,36,0,32,0,253,0,4,16,33,3,35,1,32,3,65,1,253,173,1,32,3,253,12,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,253,78,253,161,1,253,81,253,174,1,33,3,32,0,32,3,253,11,4,16,32,3,36,1,32,0,65,32,106,33,0,32,2,65,1,106,33,2,12,0,11,11,11]);
 const pendingFiles=new Map();
 let localTextures;
 async function textureSource(kind,url){
  if(location.protocol!=='file:')return url;
  if(!localTextures)localTextures=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=Y.TEXTURE_FALLBACK46;script.onload=()=>{script.remove();Y.LOCAL_TEXTURES46?resolve(Y.LOCAL_TEXTURES46):reject(Error('Local textures are incomplete'));};script.onerror=()=>{script.remove();reject(Error('Local texture file is missing'));};document.head.append(script);});
  return(await localTextures)[kind];
 }
 // Keep the late-arriving index loop independent of earlier width-32/2 warmup.
 // The byte operations and endian/alignment guards remain unchanged.
 const workerSource=`const deltaKernelBytes=new Uint8Array(${JSON.stringify(Array.from(deltaKernelBytes))});
function unshuffle4(src,out){
   const words=new Uint32Array(out.buffer),n=words.length;
   for(let i=0;i<n;i++)words[i]=src[i]|src[n+i]<<8|src[2*n+i]<<16|src[3*n+i]<<24;
   return out.buffer;
}
function unshuffle32(src,out){
 const words=new Uint32Array(out.buffer),rows=src.length/32;
 for(let i=0,j=0;i<rows;i++,j+=8){
  words[j+0]=src[0*rows+i]|src[1*rows+i]<<8|src[2*rows+i]<<16|src[3*rows+i]<<24;
  words[j+1]=src[4*rows+i]|src[5*rows+i]<<8|src[6*rows+i]<<16|src[7*rows+i]<<24;
  words[j+2]=src[8*rows+i]|src[9*rows+i]<<8|src[10*rows+i]<<16|src[11*rows+i]<<24;
  words[j+3]=src[12*rows+i]|src[13*rows+i]<<8|src[14*rows+i]<<16|src[15*rows+i]<<24;
  words[j+4]=src[16*rows+i]|src[17*rows+i]<<8|src[18*rows+i]<<16|src[19*rows+i]<<24;
  words[j+5]=src[20*rows+i]|src[21*rows+i]<<8|src[22*rows+i]<<16|src[23*rows+i]<<24;
  words[j+6]=src[24*rows+i]|src[25*rows+i]<<8|src[26*rows+i]<<16|src[27*rows+i]<<24;
  words[j+7]=src[28*rows+i]|src[29*rows+i]<<8|src[30*rows+i]<<16|src[31*rows+i]<<24;
 }
 return out.buffer;
}
// Lossless bounded SIMD transpose. All decoding/checksum publication stays below.
let wasm32State;
let deltaKernelState;
function unshuffle32SIMD(buffer,delta=false){
 if(wasm32State===false)return null;
 try{
  if(!wasm32State){
   const encoded='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',binary=atob(encoded),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   const instance=new WebAssembly.Instance(new WebAssembly.Module(bytes));
   if(instance.exports.memory.buffer.byteLength!==524288)throw Error('Unexpected transpose memory');
   wasm32State={instance,view:new Uint8Array(instance.exports.memory.buffer)};
  }
  if(delta){
   if(deltaKernelState===false)return null;
   try{if(!deltaKernelState)deltaKernelState=new WebAssembly.Instance(new WebAssembly.Module(deltaKernelBytes),{env:{memory:wasm32State.instance.exports.memory}});deltaKernelState.exports.reset();}catch{deltaKernelState=false;return null;}
  }
  const src=new Uint8Array(buffer),rows=src.length/32,out=new Uint8Array(src.length),v=wasm32State.view;
  for(let row=0;row<rows;row+=8192){
   const n=Math.min(8192,rows-row);
   for(let lane=0;lane<32;lane++)v.set(src.subarray(lane*rows+row,lane*rows+row+n),lane*n);
   wasm32State.instance.exports.transpose32(n);
   if(delta)try{deltaKernelState.exports.undo(n*32,n);}catch{deltaKernelState=false;return null;}
   out.set(v.subarray(n*32,n*64),row*32);
  }
  return out.buffer;
 }catch{wasm32State=false;return null;}
}
function unshuffle(buffer,width,little=new Uint8Array(new Uint32Array([1]).buffer)[0]===1){
  if(little&&width===32&&buffer.byteLength%32===0){const result=unshuffle32SIMD(buffer);if(result!==null)return result;}
  const src=new Uint8Array(buffer),out=new Uint8Array(src.length);
  // Index streams have contiguous word output. Specialize those widths so
  // each write restores one full word, preserving every bit without conversion.
  if(little&&width===4&&src.length%4===0){
   return unshuffle4(src,out);
  }
  if(little&&width===2&&src.length%4===0){
   const words=new Uint32Array(out.buffer),n=src.length/2;
   for(let i=0,j=0;j<words.length;i+=2,j++)words[j]=src[i]|src[n+i]<<8|src[i+1]<<16|src[n+i+1]<<24;
   return out.buffer;
  }
  if(little&&width===32&&src.length%32===0)return unshuffle32(src,out);
  // Restore four byte lanes per write without converting floating-point values.
  // Partial final records have equally sized lanes within each aligned word.
  if(little&&width%4===0&&src.length%4===0){
   const words=new Uint32Array(out.buffer),rows=Math.floor(src.length/width),tail=src.length%width,step=width/4;
   for(let lane=0;lane<width;lane+=4){
    const n=rows+(lane<tail?1:0),a=lane*rows+Math.min(lane,tail),b=a+n,c=b+n,d=c+n;
    for(let i=0,j=lane/4;i<n;i++,j+=step)words[j]=src[a+i]|src[b+i]<<8|src[c+i]<<16|src[d+i]<<24;
   }
  }else{let q=0;for(let lane=0;lane<width;lane++)for(let i=lane;i<src.length;i+=width)out[i]=src[q++];}
  return out.buffer;
 }
 const modernCodec='gzip-meshopt-attributes-v1',maxCodecBytes=64*1024*1024;
 const deltaCodecs={'gzip-u32x8-zigzag-v1':[4,8],'gzip-u32-zigzag-v1':[4,1],'gzip-u16-zigzag-v1':[2,1]};
 let prefetched,modernDisabled=false,deltaDisabled=false,decoderReady;
 function discardPrefetch(){
  const pending=prefetched;prefetched=null;
  if(pending){pending.controller.abort();pending.promise.then(r=>r.body?.cancel()).catch(()=>{});}
 }
 async function compressed(url,prefetchURL){
  let pending;
  if(prefetched?.url===url){pending=prefetched;prefetched=null;}else discardPrefetch();
  const r=await(pending?pending.promise:fetch(url));
  if(!r.ok){try{r.body?.cancel().catch(()=>{});}catch{}throw Error('Scene chunk HTTP '+r.status);}
  // Retain one compressed response, never a second decoder task.
  if(prefetchURL){const controller=new AbortController(),promise=fetch(prefetchURL,{signal:controller.signal});promise.catch(()=>{});prefetched={url:prefetchURL,promise,controller};}
  return r.arrayBuffer();
 }
 async function verify(buffer,sha,required){
  if(!self.crypto?.subtle){if(required)throw Error('Scene codec requires checksum verification');return;}
  const digest=await crypto.subtle.digest('SHA-256',buffer),actual=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  if(actual!==sha)throw Error('Scene chunk checksum mismatch');
 }
 async function inflate(bytes){
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const input=new ReadableStream({start(controller){controller.enqueue(view);controller.close();}});
  return new Response(input.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 }
 function modernCapable(m){return !modernDisabled&&!m.encoded&&/^https?:/.test(m.url)&&typeof WebAssembly==='object'&&!!self.crypto?.subtle&&typeof DecompressionStream==='function';}
 function modernAvailable(m){return modernCapable(m)&&m.alternative?.codec===modernCodec;}
 function nextURL(m,modern){return modern&&m.prefetchAlternative?m.prefetchAlternative.url:m.prefetchURL;}
 function getDecoder(url){
  if(!decoderReady){
   let timer;
   const initialized=import(url).then(async module=>{const decoder=module.MeshoptDecoder;if(!decoder?.supported||typeof decoder.decodeVertexBuffer!=='function')throw Error('Scene codec unavailable');await decoder.ready;return decoder;});
   decoderReady=Promise.race([initialized,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Scene codec initialization timeout')),3000);})]).finally(()=>clearTimeout(timer));
  }
  return decoderReady;
 }
 async function decodeModern(m){
  const a=m.alternative;
  if(![4,32].includes(a.stride)||!Number.isSafeInteger(a.count)||a.count<=0||a.count*a.stride!==m.rawBytes||!Number.isSafeInteger(m.rawBytes)||m.rawBytes>maxCodecBytes||!Number.isSafeInteger(a.bytes)||a.bytes<=0||a.bytes>maxCodecBytes||!Number.isSafeInteger(a.decodedBytes)||a.decodedBytes<=0||a.decodedBytes>maxCodecBytes||!/^[a-f0-9]{64}$/.test(a.sha256))throw Error('Invalid scene codec descriptor');
  const decoder=await getDecoder(m.decoderURL);
  const packed=m.transport?.codec===modernCodec?m.transport.buffer:await compressed(a.url,nextURL(m,true));
  if(packed.byteLength!==a.bytes)throw Error('Incomplete scene codec transport');
  // Transport SHA pins the offline package; runtime retains gzip integrity and final raw SHA.
  const encoded=await inflate(packed);
  if(encoded.byteLength!==a.decodedBytes)throw Error('Incomplete scene codec stream');
  const raw=new Uint8Array(m.rawBytes);
  decoder.decodeVertexBuffer(raw,a.count,a.stride,new Uint8Array(encoded));
  // The attributes codec returns original opaque bytes: never legacy-unshuffle.
  return prepare(raw.buffer,m,true);
 }
 async function decodeLegacy(m){
  let bytes;
  if(m.encoded){const s=atob(m.encoded),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);bytes=a;}
  else bytes=m.transport?.codec==='legacy'?m.transport.buffer:await compressed(m.url,nextURL(m,modernCapable(m)));
  const inflated=await inflate(bytes);
  if(inflated.byteLength!==m.rawBytes)throw Error('Incomplete scene chunk');
  const buffer=m.shuffle?unshuffle(inflated,m.shuffle):inflated;
  return prepare(buffer,m,false);
 }
 async function decodeDelta(m){
  const [unit,lanes]=deltaCodecs[m.transport.codec],width=unit*lanes;
  if(!Number.isSafeInteger(m.rawBytes)||m.rawBytes<=0||m.rawBytes>maxCodecBytes||m.rawBytes%width||!Number.isSafeInteger(m.transport.bytes)||m.transport.bytes<=0||m.transport.bytes>maxCodecBytes||m.transport.buffer.byteLength!==m.transport.bytes)throw Error('Invalid startup codec descriptor');
  const inflated=await inflate(m.transport.buffer);
  if(inflated.byteLength!==m.rawBytes)throw Error('Incomplete startup codec stream');
  if(typeof m.transport.buffer.transfer==='function')m.transport.buffer.transfer(0);
  const little=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
  const fast=little&&unit===4&&lanes===8?unshuffle32SIMD(inflated,true):null,buffer=fast===null?unshuffle(inflated,width):fast;
  if(typeof inflated.transfer==='function')inflated.transfer(0);
  if(fast!==null)return prepare(buffer,m,true);
  if(little&&unit===4&&lanes===8){
   const w=new Uint32Array(buffer);
   for(let i=0;i<8;i++){const z=w[i];w[i]=(z>>>1)^-(z&1);}
   // Eight independent integer lanes preserve every bit and avoid a per-word
   // modulo/dispatch operation in the largest vertex streams.
   for(let i=8;i<w.length;i+=8){
    let z=w[i];w[i]=((w[i-8]|0)+((z>>>1)^-(z&1)))|0;
    z=w[i+1];w[i+1]=((w[i-7]|0)+((z>>>1)^-(z&1)))|0;
    z=w[i+2];w[i+2]=((w[i-6]|0)+((z>>>1)^-(z&1)))|0;
    z=w[i+3];w[i+3]=((w[i-5]|0)+((z>>>1)^-(z&1)))|0;
    z=w[i+4];w[i+4]=((w[i-4]|0)+((z>>>1)^-(z&1)))|0;
    z=w[i+5];w[i+5]=((w[i-3]|0)+((z>>>1)^-(z&1)))|0;
    z=w[i+6];w[i+6]=((w[i-2]|0)+((z>>>1)^-(z&1)))|0;
    z=w[i+7];w[i+7]=((w[i-1]|0)+((z>>>1)^-(z&1)))|0;
   }
  }else if(little){
   const words=unit===2?new Uint16Array(buffer):new Uint32Array(buffer);
   for(let i=0;i<lanes;i++){const z=words[i];words[i]=(z>>>1)^-(z&1);}
   for(let i=lanes;i<words.length;i++){const z=words[i];words[i]=words[i-lanes]+((z>>>1)^-(z&1));}
  }else{
   const view=new DataView(buffer),previous=new Uint32Array(lanes);
   for(let i=0;i<m.rawBytes/unit;i++){const lane=i%lanes,z=unit===2?view.getUint16(i*unit,true):view.getUint32(i*unit,true),v=(previous[lane]+((z>>>1)^-(z&1)))>>>0;if(unit===2)view.setUint16(i*unit,v&65535,true);else view.setUint32(i*unit,v,true);previous[lane]=unit===2?v&65535:v;}
  }
  return prepare(buffer,m,true);
 }
 async function prepare(buffer,m,required){
  if(buffer.byteLength!==m.rawBytes)throw Error('Incomplete scene chunk');
  const verified=verify(buffer,m.sha256,required);verified.catch(()=>{});
  const compiled=[],transfers=[buffer],records=m.buckets||[];
  // Directly compile typed metadata views into one aligned per-chunk arena.
  // The original records retain their own buffer and every view keeps its type.
  let metadataBytes=0,metadataOffset=0;
  const reserve=(Type,n)=>{metadataBytes=Math.ceil(metadataBytes/Type.BYTES_PER_ELEMENT)*Type.BYTES_PER_ELEMENT+n*Type.BYTES_PER_ELEMENT;};
  for(const record of records){
   const n=record.count;
   if(record.data.length!==n*28||record.spatial.length!==n*5)throw Error('Incomplete prepared scene bucket');
   if(record.detailWidth)reserve(Float64Array,n);reserve(Uint8Array,n);
   if(n>=128){reserve(Float64Array,Math.ceil(n/64)*5);reserve(Float64Array,Math.ceil(n/64)*4);reserve(Uint8Array,Math.ceil(n/64));}
  }
  const metadata=records.length?new ArrayBuffer(metadataBytes):null;
  const allocate=(Type,n)=>{metadataOffset=Math.ceil(metadataOffset/Type.BYTES_PER_ELEMENT)*Type.BYTES_PER_ELEMENT;const view=new Type(metadata,metadataOffset,n);metadataOffset+=view.byteLength;return view;};
  if(metadata)transfers.push(metadata);
  // Overlap local metadata work with asynchronous checksum verification.
  // Instance records themselves are never reordered or rewritten.
  for(const record of records){
   const bucket={data:new Float32Array(buffer,record.data.offset,record.data.length),spatial:new Float32Array(buffer,record.spatial.offset,record.spatial.length),detailWidth:record.detailWidth};
   if(bucket.data.length!==record.count*28||bucket.spatial.length!==record.count*5)throw Error('Incomplete prepared scene bucket');
   self.compileVisibility(bucket,allocate);delete bucket.data;delete bucket.spatial;delete bucket.detailWidth;
   compiled.push(bucket);
  }
  if(metadataOffset!==metadataBytes)throw Error('Incomplete visibility metadata arena');
  await verified; // Never publish or upload records before checksum success.
  return{buffer,compiled,transfers};
 }
 self.onmessage=async({data:m})=>{try{
  let result,codec='legacy',fallbackReason;
  if(deltaCodecs[m.transport?.codec]&&!deltaDisabled){
   try{result=await decodeDelta(m);codec=m.transport.codec;}
   catch(e){deltaDisabled=true;discardPrefetch();fallbackReason=String(e).slice(0,160);result=await decodeLegacy(m);}
  }else if(modernAvailable(m)){
   try{result=await decodeModern(m);codec=modernCodec;}
   catch(e){modernDisabled=true;discardPrefetch();fallbackReason=String(e).slice(0,160);result=await decodeLegacy(m);}
  }else result=await decodeLegacy(m);
  // Both representations share this one final publication. Legacy failure is terminal.
  self.postMessage({index:m.index,buffer:result.buffer,compiled:result.compiled,codec,fallbackReason},result.transfers);
 }catch(e){self.postMessage({index:m.index,error:String(e)});}};`;
 const yieldUI=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 function localCodecURL(base,file){
  if(typeof file!=='string'||!file||file.includes('\\')||file.startsWith('/')||file.split('/').some(part=>part==='..')||!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(file))return null;
  try{const url=new URL(file,base);return /^https?:$/.test(url.protocol)&&url.origin===location.origin&&url.href.startsWith(base)?url.href:null;}catch{return null;}
 }
 function codecOptions(m,base){
  if(!/^https?:$/.test(globalThis.location?.protocol)||typeof WebAssembly!=='object'||!globalThis.crypto?.subtle)return()=>null;
  const decoderURL=localCodecURL(base,m.codecResources?.decoder?.file);
  if(!decoderURL)return()=>null;
  return chunk=>{
   const a=chunk?.alternative;if(a?.codec!=='gzip-meshopt-attributes-v1')return null;
   const url=localCodecURL(base,a.file);return url?{...a,url,decoderURL}:null;
  };
 }
 function localChunk(base,index,chunk){
  if(pendingFiles.has(chunk.key))return pendingFiles.get(chunk.key).promise;
  const script=document.createElement('script');script.src=base+chunk.fallback;
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  const finish=()=>{script.remove();pendingFiles.delete(chunk.key);};
  pendingFiles.set(chunk.key,{promise,resolve:encoded=>{finish();resolve(encoded);}});
  script.onerror=()=>{finish();reject(Error('Scene data file is missing: '+chunk.fallback));};document.head.append(script);return promise;
 }
 function receive(key,encoded){pendingFiles.get(key)?.resolve(encoded);}
 // Begin CPU-heavy instance preparation while later mesh chunks still decode.
 // This only schedules chunks: manifest bucket order and all record bytes stay intact.
 function decodeOrder(chunks,content){
  const instances=[],geometry=[],order=[];
  chunks.forEach((_,i)=>(content[i].buckets.length?instances:geometry).push(i));
  instances.sort((a,b)=>chunks[b].rawBytes-chunks[a].rawBytes||a-b);
  for(let i=0;i<Math.max(instances.length,geometry.length);i++){
   if(i<instances.length)order.push(instances[i]);if(i<geometry.length)order.push(geometry[i]);
  }
  return order;
 }
 // Transport contains the same separately verified compressed chunks. Read only
 // requested chunks; decoder jobs, original record order and upload budgets stay
 // unchanged. Legacy files and local-file scripts remain independently usable.
 function createTransport(m,base,order,alternativeFor){
  const t=m.transport,limit=32*1024*1024;
  if(!t||t.version!==1||t.sourceHash!==m.sourceHash||!Array.isArray(t.parts)||!t.parts.length||!/^https?:$/.test(globalThis.location?.protocol)||typeof ReadableStream!=='function'||typeof DecompressionStream!=='function'||typeof WebAssembly!=='object'||!globalThis.crypto?.subtle)return null;
  const entries=[];
  for(let pi=0;pi<t.parts.length;pi++){
   const p=t.parts[pi];let total=0;
   if(!/^startup-[a-f0-9]{24}\.bin$/.test(p.file)||!localCodecURL(base,p.file)||!Number.isSafeInteger(p.bytes)||p.bytes<=0||p.bytes>limit||!Array.isArray(p.entries)||!p.entries.length)return null;
   for(const e of p.entries){
    if(e.index!==order[entries.length])return null;
    const c=m.chunks[e.index],a=c&&alternativeFor(c),modern=a&&a.bytes<c.bytes,selected=modern?a:c;
    const delta={'gzip-u32x8-zigzag-v1':[4,8],'gzip-u32-zigzag-v1':[4,1],'gzip-u16-zigzag-v1':[2,1]}[e.codec];
    if(!selected||!Number.isSafeInteger(e.bytes)||e.bytes<=0||e.bytes>limit)return null;
    if(delta){const [unit,lanes]=delta;if(c.kind!=='mesh'||!Number.isSafeInteger(c.rawBytes)||c.rawBytes<=0||c.rawBytes%(unit*lanes)||!(lanes===8?[0,32].includes(c.shuffle):c.shuffle===unit)||e.bytes>selected.bytes*.95)return null;}
    else if(e.codec!==(modern?'gzip-meshopt-attributes-v1':'legacy')||e.bytes!==selected.bytes)return null;
    entries.push({...e,part:pi});total+=e.bytes;
   }
   if(total!==p.bytes)return null;
  }
  if(entries.length!==order.length)return null;
  if(entries.some(e=>e.codec==='gzip-u32x8-zigzag-v1')&&(typeof WebAssembly.validate!=='function'||!WebAssembly.validate(deltaKernelBytes)))return null;
  const controller=new AbortController(),demands=new Map(),requested=new Set(),stats={version:1,mode:'stream',requests:0,parts:0,chunks:0,bytes:0,heldBytes:0,peakCompressedBytes:0,disposed:false};
  let reader,part=-1,received=0,cursor=0,running=null,closed=false,failure;
  const peak=()=>{stats.peakCompressedBytes=Math.max(stats.peakCompressedBytes,stats.heldBytes);};
  const interrupted=()=>Error('Scene stream loading was interrupted');
  async function openPart(index){
   const p=t.parts[index];stats.requests++;
   const r=await fetch(localCodecURL(base,p.file),{signal:controller.signal});
   if(!r.ok||!r.body?.getReader){try{await r.body?.cancel();}catch{}throw Error('Scene stream HTTP '+r.status);}
   if(closed){try{await r.body.cancel();}catch{}throw interrupted();}
   try{reader=r.body.getReader({mode:'byob'});}catch{try{await r.body.cancel();}catch{}throw Error('Scene stream byte reader unavailable');}
   part=index;received=0;
  }
  async function finishPart(){
   const last=await reader.read(new Uint8Array(1));
   if(last.value?.byteLength||!last.done)throw Error('Unexpected scene stream bytes');
   if(typeof last.value?.buffer.transfer==='function')last.value.buffer.transfer(0);
   if(received!==t.parts[part].bytes)throw Error('Incomplete scene stream');
   reader.releaseLock();reader=null;stats.parts++;
  }
  function fail(error){
   failure ||= error;controller.abort();reader?.cancel().catch(()=>{});
   for(const pending of demands.values())pending.reject(failure);demands.clear();
  }
  async function pump(){
   try{
    while(cursor<entries.length&&!closed){
     const e=entries[cursor],pending=demands.get(e.index);if(!pending)return;
     if(part!==e.part)await openPart(e.part);
     let buffer=new ArrayBuffer(e.bytes),used=0;stats.heldBytes+=e.bytes;peak();
     try{
      while(used<e.bytes){
       // The byte reader transfers ownership of this exact buffer on every
       // read. Re-adopt it; do not allocate/copy disposable network chunks.
       const target=new Uint8Array(buffer,used,e.bytes-used),r=await reader.read(target);
       if(r.value)buffer=r.value.buffer;
       if(closed)throw interrupted();
       if(!r.value||r.value.byteOffset!==used||buffer.byteLength!==e.bytes)throw Error('Invalid scene stream ownership');
       if(r.value.byteLength){used+=r.value.byteLength;received+=r.value.byteLength;stats.byobReads=(stats.byobReads||0)+1;if(target.buffer.byteLength===0)stats.byobTransfers=(stats.byobTransfers||0)+1;}
       if(r.done&&used<e.bytes)throw Error('Incomplete scene stream chunk');
      }
     }catch(error){stats.heldBytes-=e.bytes;if(typeof buffer.transfer==='function')buffer.transfer(0);throw error;}
     demands.delete(e.index);cursor++;stats.chunks++;stats.bytes+=e.bytes;
     pending.resolve({buffer,bytes:e.bytes,codec:e.codec});
     if(cursor===entries.length||entries[cursor].part!==part)await finishPart();
    }
   }catch(error){fail(error);}
  }
  function kick(){if(!running){running=pump().finally(()=>{running=null;if(!closed&&!failure&&demands.has(entries[cursor]?.index))kick();});}}
  return{stats,
   async start(){try{await openPart(0);return true;}catch(error){if(closed)throw error;stats.mode='legacy';stats.initialFallback=String(error);fail(error);return false;}},
   get(index){
    if(failure||closed)return Promise.reject(failure||interrupted());
    if(requested.has(index)||!entries.some(e=>e.index===index))return Promise.reject(Error('Invalid scene stream request'));
    requested.add(index);const promise=new Promise((resolve,reject)=>demands.set(index,{resolve,reject}));kick();return promise;
   },
   release(bytes){stats.heldBytes-=bytes;},
   async finish(){if(running)await running;if(failure)throw failure;if(cursor!==entries.length||reader)throw Error('Incomplete scene stream publication');},
   dispose(){if(closed)return;closed=true;stats.disposed=true;fail(interrupted());}
  };
 }
 function warmup(){
  const workerURL=URL.createObjectURL(new Blob([workerSource,'\nconst essential=new Set('+JSON.stringify(Y.Visibility.essentialMaterials)+');self.compileVisibility='+Y.Visibility.compile.toString()+';'],{type:'text/javascript'})),workers=[];
  let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;workers.forEach(w=>w.terminate());URL.revokeObjectURL(workerURL);};
  try{for(let i=0;i<2;i++)workers.push(new Worker(workerURL));}catch(error){dispose();throw error;}
  return{workers,dispose};
 }
 async function load(engine,onProgress=()=>{},prepared){
  const m=Y.SCENE_PACKAGE46;if(!m||(m.version!==2&&m.version!==3)||(m.version===3&&(![1,2].includes(m.normalTransformFormat194)||![1,2].includes(Y.Engine.normalTransformFormat194)||Y.Engine.normalTransformFormat194<m.normalTransformFormat194)))throw Error('Prepared scene manifest is missing or incompatible');
  const started=performance.now(),base=new URL(m.base,document.baseURI).href;
  const alternativeFor=codecOptions(m,base),codecStats={modernChunks:0,legacyChunks:0,fallbackChunks:0,selectedCompressedBytes:0};
  if(engine.stats)engine.stats.sceneCodec=codecStats;
  const pool=prepared||warmup(),workers=pool.workers,rejectJobs=new Set();let cursor=0,completed=0,stream,stopped=false;
  const stop=()=>{if(stopped)return;stopped=true;stream?.dispose();for(const reject of rejectJobs)reject(Error('Scene loading was interrupted'));rejectJobs.clear();pool.dispose();};
  engine.sceneLoading46=stop;
  try{
  const chunks=m.chunks.map(()=>({meshes:[],indices:[],buckets:[]}));
  m.meshes.forEach((mesh,index)=>{chunks[mesh.buffer.chunk].meshes.push({mesh,index});if(mesh.indices)chunks[mesh.indices.chunk].indices.push({mesh,index});});
  m.buckets.forEach(bucket=>chunks[bucket.data.chunk].buckets.push(bucket));
  const order=decodeOrder(m.chunks,chunks);
  stream=createTransport(m,base,order,alternativeFor);
  if(stream&&engine.stats)engine.stats.sceneTransport=stream.stats;
  engine.beginPrepared(m);
  const atlasSource=await textureSource('atlas',base+m.atlas),atlas=new Image();const atlasReady=new Promise((resolve,reject)=>{atlas.onload=resolve;atlas.onerror=()=>reject(Error('Scene lettering atlas could not load'));atlas.src=atlasSource;});
  // Attach a handler immediately, even while the chunk workers are still active.
  atlasReady.catch(()=>{});
  if(stream&&!await stream.start()){stream.dispose();stream=null;}
  if(stopped||engine.disposed)throw Error('Scene loading was interrupted');
  const decode=(worker,index,chunk,encoded,prefetchURL,prefetchAlternative,transport)=>new Promise((resolve,reject)=>{
   rejectJobs.add(reject);
   const alternative=alternativeFor(chunk);
   worker.onmessage=({data:r})=>{rejectJobs.delete(reject);if(r.error){reject(Error(r.error));return;}const modern=r.codec==='gzip-meshopt-attributes-v1',delta=['gzip-u32x8-zigzag-v1','gzip-u32-zigzag-v1','gzip-u16-zigzag-v1'].includes(r.codec);if(delta)codecStats.deltaChunks=(codecStats.deltaChunks||0)+1;else codecStats[modern?'modernChunks':'legacyChunks']++;if(r.fallbackReason)codecStats.fallbackChunks++;codecStats.selectedCompressedBytes+=delta?transport.bytes:modern?alternative.bytes:chunk.bytes;resolve(r);};
   worker.onerror=e=>{rejectJobs.delete(reject);reject(Error(e.message||'Scene decoder failed'));};
   try{worker.postMessage({index,url:base+chunk.file,encoded,prefetchURL,prefetchAlternative,alternative,transport,decoderURL:alternative?.decoderURL,rawBytes:chunk.rawBytes,shuffle:chunk.shuffle,sha256:chunk.sha256,buckets:chunks[index].buckets.map(record=>({count:record.count,data:{offset:record.data.offset,length:record.data.length},spatial:{offset:record.spatial.offset,length:record.spatial.length},detailWidth:m.meshes[record.mesh].detailWidth||0}))},transport?[transport.buffer]:[]);}finally{if(transport)stream.release(transport.bytes);}
  });
   const takeIndex=()=>cursor<order.length?order[cursor++]:null,first=workers.map(takeIndex);
   await Promise.all(workers.map(async(worker,wi)=>{
    let reserved=first[wi];
    // One pending decode per worker overlaps the current chunk's bounded upload.
    const requestNext=()=>{
     if(reserved===null)return null;
     const index=reserved,chunk=m.chunks[index];reserved=takeIndex();
     const prefetchURL=!stream&&location.protocol!=='file:'&&reserved!==null?base+m.chunks[reserved].file:undefined;
     const result=(async()=>{const encoded=location.protocol==='file:'?await localChunk(base,index,chunk):undefined,transport=stream?await stream.get(index):undefined;if(stopped){if(transport){stream.release(transport.bytes);if(typeof transport.buffer.transfer==='function')transport.buffer.transfer(0);}throw Error('Scene loading was interrupted');}return decode(worker,index,chunk,encoded,prefetchURL,!stream&&reserved!==null?alternativeFor(m.chunks[reserved]):null,transport);})();
     result.catch(()=>{});return{index,result};
    };
    // Carry the same upload budget across chunk boundaries. A small chunk
    // need not add an idle frame immediately after an in-chunk UI yield.
    let next=requestNext(),checkpoint=performance.now();
    while(next){
     const {index,result}=next,waiting=performance.now();
     const {buffer,compiled}=await result;
     // Decoder wait does not consume the main-thread upload work budget.
     // Preserve accumulated upload time across chunks, excluding only this await.
     checkpoint+=performance.now()-waiting;next=requestNext();
     const content=chunks[index];
     if(engine.disposed)throw Error('Scene loading was interrupted');
     for(const{mesh,index:mi}of content.meshes){engine.preparedVertices(mi,new Float32Array(buffer,mesh.buffer.offset,mesh.buffer.length));if(performance.now()-checkpoint>7){await yieldUI();checkpoint=performance.now();}}
     for(const{mesh,index:mi}of content.indices){const Type=mesh.indexType==='uint16'?Uint16Array:Uint32Array;engine.preparedIndices(mi,new Type(buffer,mesh.indices.offset,mesh.vertexCount));if(performance.now()-checkpoint>7){await yieldUI();checkpoint=performance.now();}}
     for(let bi=0;bi<content.buckets.length;bi++){const bucket=content.buckets[bi];engine.preparedInstances(bucket,new Float32Array(buffer,bucket.data.offset,bucket.data.length),new Float32Array(buffer,bucket.spatial.offset,bucket.spatial.length),compiled[bi]);if(performance.now()-checkpoint>7){await yieldUI();checkpoint=performance.now();}}
     // WebGL has copied every vertex/index view by this point. Explicitly release
     // geometry-only backing storage instead of retaining it until a later GC.
     // Instance chunks stay attached: visibility caches still use their views.
     if(!content.buckets.length&&typeof buffer.transfer==='function')buffer.transfer(0);
     onProgress(++completed,m.chunks.length);if(performance.now()-checkpoint>7){await yieldUI();checkpoint=performance.now();}
    }
   }));
   if(stream)await stream.finish();
   await atlasReady;if(engine.disposed)throw Error('Scene loading was interrupted');engine.setAtlas(atlas);await engine.finishPrepared(yieldUI);
   const by=new Map(Y.CAMPUS.features.map(f=>[f.properties.pickId,f]));
   const campus={...m.campus,registry:new Map(m.campus.registryIds.map(id=>[id,by.get(id)]))};delete campus.registryIds;
   Y.sceneLoad46={ms:performance.now()-started,compressedBytes:m.packedStats.compressedBytes,chunks:m.chunks.length,sourceHash:m.sourceHash,codecStats};
   engine.preparedSceneComplete?.(m);
   return campus;
  }finally{stop();if(engine.sceneLoading46===stop)delete engine.sceneLoading46;}
 }
 Y.SceneCache46={warmup,load,receive,textureSource,decodeOrder};
})(YY);
