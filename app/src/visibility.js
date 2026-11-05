/* Projected-detail policy. Does not remove campus objects or mutate their footprints.
   Shared by main, reflected, shadow and picking passes; inspected objects stay complete. */
(function(Y){'use strict';
 const essential=new Set([0,4,7,8,15,17,21]);
 function keepDetail(size,distance,focal,options={}){
  if(options.enabled===false||options.isolate||options.id===options.selected||essential.has(options.material))return true;
  if(distance<260)return true;
  return size*focal/Math.max(1,distance)>=1.6;
 }
 function bounds(geometry){let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<geometry.v.length;i+=8)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],geometry.v[i+j]);hi[j]=Math.max(hi[j],geometry.v[i+j]);}return{center:lo.map((v,i)=>(v+hi[i])/2),half:lo.map((v,i)=>(hi[i]-v)/2)};}
 function prepare(data,geometry){const{center:c,half:h}=bounds(geometry),out=new Float32Array(data.length/28*5);for(let i=0,n=0;i<data.length;i+=28,n+=5){out[n]=data[i]*c[0]+data[i+4]*c[1]+data[i+8]*c[2]+data[i+12];out[n+1]=data[i+1]*c[0]+data[i+5]*c[1]+data[i+9]*c[2]+data[i+13];out[n+2]=data[i+2]*c[0]+data[i+6]*c[1]+data[i+10]*c[2]+data[i+14];const ext=[0,1,2].map(j=>Math.abs(data[i+j])*h[0]+Math.abs(data[i+4+j])*h[1]+Math.abs(data[i+8+j])*h[2]);out[n+3]=Math.hypot(...ext)+1.2;const sides=[0,4,8].map((k,j)=>2*h[j]*Math.hypot(data[i+k],data[i+k+1],data[i+k+2])).sort((a,b)=>a-b);out[n+4]=sides[1];}return out;}
 function keepSurfaceDetail(width,distance,focal,enabled=true){return enabled===false||width*focal/Math.max(1,distance)>=.85;}
 function sphereVisible(planes,x,y,z,r){for(let k=0;k<planes.length;k++){const p=planes[k];if(p[0]*x+p[1]*y+p[2]*z+p[3]<-r)return false;}return true;}
 function compile(bucket,allocate){
  const data=bucket.data,sp=bucket.spatial,n=data.length/28,ids=new Set(),materials=new Set(),surface=bucket.detailWidth?(allocate?allocate(Float64Array,n):new Float64Array(n)):null,flags=(allocate?allocate(Uint8Array,n):new Uint8Array(n));
  const groups=bucket.groups=n>=128?(allocate?allocate(Float64Array,Math.ceil(n/64)*5):new Float64Array(Math.ceil(n/64)*5)):null;
  const detail=bucket.groupDetail=groups?(allocate?allocate(Float64Array,Math.ceil(n/64)*4):new Float64Array(Math.ceil(n/64)*4)):null,routes=bucket.groupRoutes=groups?(allocate?allocate(Uint8Array,Math.ceil(n/64)):new Uint8Array(Math.ceil(n/64))):null;
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity,maxPart=0;
  let ax=Infinity,ay=Infinity,az=Infinity,bx=-Infinity,by=-Infinity,bz=-Infinity,part=0;
  let minDetail=Infinity,minSurface=Infinity,maxDetail=0,maxSurface=0,hasRoute=0;
  let previousId=NaN,previousMaterial=NaN,previousEssential=0;
  // Build bucket and group metadata in one traversal of the decoded records.
  // Folding consecutive group bounds preserves the original extrema exactly.
  for(let i=0,j=0,k=0;i<data.length;i+=28,j+=5,k++){
   const x=sp[j],y=sp[j+1],z=sp[j+2],r=sp[j+3];
   ax=Math.min(ax,x-r);ay=Math.min(ay,y-r);az=Math.min(az,z-r);bx=Math.max(bx,x+r);by=Math.max(by,y+r);bz=Math.max(bz,z+r);
   const id=data[i+21],material=data[i+20];
   if(id!==previousId){ids.add(id);previousId=id;}
   if(material!==previousMaterial){materials.add(material);previousEssential=essential.has(material)?1:0;previousMaterial=material;}
   part=Math.max(part,Math.abs(data[i+23]));flags[k]=previousEssential;
   if(surface)surface[k]=bucket.detailWidth*Math.min(Math.hypot(data[i],data[i+1],data[i+2]),Math.hypot(data[i+4],data[i+5],data[i+6]),Math.hypot(data[i+8],data[i+9],data[i+10]));
   if(groups){
    const size=Math.abs(sp[j+4]),width=material===38?sp[j+4]:(surface?surface[k]:0);
    if(!previousEssential)minDetail=Math.min(minDetail,size);
    if(width)minSurface=Math.min(minSurface,Math.abs(width));
    maxDetail=Math.max(maxDetail,previousEssential?Infinity:size);maxSurface=Math.max(maxSurface,width?Math.abs(width):Infinity);
    if(id>=950000&&id<960000)hasRoute=1;
   }
   if((k&63)===63||k===n-1){
    x0=Math.min(x0,ax);y0=Math.min(y0,ay);z0=Math.min(z0,az);x1=Math.max(x1,bx);y1=Math.max(y1,by);z1=Math.max(z1,bz);maxPart=Math.max(maxPart,part);
    if(groups){const g=k>>6,q=g*5,d=g*4;
     groups[q]=(ax+bx)/2;groups[q+1]=(ay+by)/2;groups[q+2]=(az+bz)/2;groups[q+3]=Math.hypot(bx-ax,by-ay,bz-az)/2+1e-7;groups[q+4]=part;
     detail[d]=minDetail;detail[d+1]=minSurface;detail[d+2]=maxDetail;detail[d+3]=maxSurface;routes[g]=hasRoute;
    }
    ax=ay=az=Infinity;bx=by=bz=-Infinity;part=0;minDetail=minSurface=Infinity;maxDetail=maxSurface=hasRoute=0;
   }
  }
  bucket.ids=ids;bucket.materials=materials;bucket.uniformMaterial=materials.size===1?materials.values().next().value:null;bucket.uniformId=ids.size===1?ids.values().next().value:null;bucket.maxPart=maxPart;bucket.surfaceWidths=surface;bucket.essentialFlags=flags;
  bucket.coarse=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,Math.hypot(x1-x0,y1-y0,z1-z0)/2];
  // compile is serialized alone into the decode worker; keep this proof local.
  const c=bucket.coarse;
  bucket.singleSphere=!!(data.length===28&&!groups&&c[0]===sp[0]&&c[1]===sp[1]&&c[2]===sp[2]&&Number.isFinite(sp[0])&&Number.isFinite(sp[1])&&Number.isFinite(sp[2])&&Number.isFinite(sp[3])&&Number.isFinite(c[3])&&c[3]>=sp[3]&&Number.isFinite(data[23]));
 }
 function prepareSingle(bucket){
  const data=bucket.data,sp=bucket.spatial,c=bucket.coarse;
  bucket.singleSphere=!!(data.length===28&&!bucket.groups&&c[0]===sp[0]&&c[1]===sp[1]&&c[2]===sp[2]&&Number.isFinite(sp[0])&&Number.isFinite(sp[1])&&Number.isFinite(sp[2])&&Number.isFinite(sp[3])&&Number.isFinite(c[3])&&c[3]>=sp[3]&&Number.isFinite(data[23]));
 }
 const smallInsideProofs=new WeakMap();
 function prepareSmallInside(bucket,epoch){
  smallInsideProofs.delete(bucket);
  const d=bucket.data,sp=bucket.spatial,c=bucket.coarse,n=d?.length/28;
  if(!epoch||!(d instanceof Float32Array)||!(sp instanceof Float32Array)||n<8||n>=128||!Number.isInteger(n)||sp.length!==n*5||bucket.count!==n||bucket.groups!==null||!c||c.length!==4||!c.every(Number.isFinite)||c[3]<0)return false;
  const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(let k=0;k<n;k++){const j=k*5;
   if(!Number.isFinite(sp[j])||!Number.isFinite(sp[j+1])||!Number.isFinite(sp[j+2])||!Number.isFinite(sp[j+3])||sp[j+3]<0||!Number.isFinite(d[k*28+23]))return false;
   for(let a=0;a<3;a++){bounds[a]=Math.min(bounds[a],sp[j+a]);bounds[a+3]=Math.max(bounds[a+3],sp[j+a]);}
  }
  smallInsideProofs.set(bucket,{epoch,data:d,spatial:sp,coarse:c,count:n,bounds,scale:[0,1,2].map(k=>Math.max(Math.abs(bounds[k]),Math.abs(bounds[k+3])))});return true;
 }
 function smallInside(bucket,planes,state,out,epoch){
  if(!epoch||bucket.data.length<224||bucket.data.length>=3584)return false;
  const proof=epoch&&smallInsideProofs.get(bucket);
  if(!proof||proof.epoch!==epoch||proof.data!==bucket.data||proof.spatial!==bucket.spatial||proof.coarse!==bucket.coarse||proof.count!==bucket.count||bucket.data.length!==proof.count*28||bucket.spatial.length!==proof.count*5||bucket.groups!==null||state.explode!==0||out?.buffer===bucket.data.buffer||out?.buffer===bucket.spatial.buffer)return false;
  const a=proof.bounds,abs=proof.scale;
  for(let k=0;k<planes.length;k++){
   const p=planes[k],px=p[0],py=p[1],pz=p[2],pw=p[3];
   if(!Number.isFinite(px)||!Number.isFinite(py)||!Number.isFinite(pz)||!Number.isFinite(pw))return false;
   const x=px*a[px<0?3:0],y=py*a[py<0?4:1],z=pz*a[pz<0?5:2],lower=x+y+z+pw;
   const scale=Math.abs(px)*abs[0]+Math.abs(py)*abs[1]+Math.abs(pz)*abs[2]+Math.abs(pw)+1;
   const error=32*Number.EPSILON*scale;
   if(!Number.isFinite(lower)||!Number.isFinite(error)||!(lower>error))return false;
  }
  return true;
 }
 // Private optional binary64 SIMD batch kernel; the original scalar path
 // remains authoritative for unsupported contexts, epochs and resources.
 const wasmArenas195=new WeakMap(),wasmProofs195=new WeakMap(),wasmContexts195=new WeakSet(),wasmArrayIterator195=Array.prototype[Symbol.iterator],wasmMapIterator195=Map.prototype[Symbol.iterator];
 let wasmModule195,wasmEngineMethods195;
 const wasmLittleEndian195=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
 function wasmArena195(epoch){
  if(!epoch||typeof epoch!=='object'||!wasmLittleEndian195)return null;
  if(wasmArenas195.has(epoch))return wasmArenas195.get(epoch);
  let arena=null;
  try{
   if(wasmModule195===undefined){
    try{wasmModule195=new WebAssembly.Module(Uint8Array.from(atob('AGFzbQEAAAABDAFgB39/f39/f38BfwMCAQAFBgEBgAKAAgcSAgZtZW1vcnkCAAVncm91cAAACvIEAe8EAgl/C3sCQANAIAcgA08NASAAIAIgB2pBAnRqIQggACABQQZsaiACIAdqQQN0aiEJIAj9XQIA/V8hECAIIAFq/V0CAP1fIREgCCABQQJsav1dAgD9XyESIAggAUEDbGr9XQIA/V8hE/0M/////////////////////yEUIAdBAWogA08EQP0M//////////8AAAAAAAAAACEUCyAERQRAQQAhCgJAA0AgCiAGQQV0Tw0BIBQgCisDAP0UIBD98gEgCisDCP0UIBH98gH98AEgCisDEP0UIBL98gH98AEgCisDGP0U/fABIBP97QH9Sf1PIRQgFP1TRQ0BIApBIGohCgwACwsLIBT9xAEhDCAFIAxBAEdxBEAgEEGACCsDAP0U/fEBIRUgEUGICCsDAP0U/fEBIRYgEkGQCCsDAP0U/fEBIRcgFSAV/fIBIBYgFv3yAf3wASAXIBf98gH98AEhGCAJ/QADACEZIBlBmAgrAwD9FP3yAUQzMzMzMzPrP/0U/fMBIRogFCAZRAAAAAAAAAAA/RT9SEQAAAAAAADwP/0UIBj99QEgGiAa/fIB/Ur9Tv1PIRQgCCABQQRsav1dAgD9X0GYCCsDAP0U/fIBRJqZmZmZmfk//RT98wEhGiAUIAggAUEFbGr9XQIA/V9EAAAAAAAAAAD9FP1HIBhEAAAAAACB8ED9FP1MIBggGiAa/fIB/Ur9Tv1O/U8hFAsgFP3EASELIA8gDGkgC2lraiEPIAdBIEkEQCANIAsgB3RyIQ0FIA4gCyAHQSBrdHIhDgsgB0ECaiEHDAALC0GAECANNgIAQYQQIA42AgAgDwsAqwEEbmFtZQKjAQEAGwAEYmFzZQEGc3RyaWRlAgVzdGFydAMFY291bnQEBmluc2lkZQUHZW5hYmxlZAYGcGxhbmVzBwFqCAJhdAkEYXQ2NAoFcGxhbmULBGJpdHMMB3Zpc2libGUNAmxvDgJoaQ8GY3VsbGVkEAF4EQF5EgF6EwFyFAZhY3RpdmUVAmR4FgJkeRcCZHoYCGRpc3RhbmNlGQV3aWR0aBoFbGltaXQ='),c=>c.charCodeAt(0)));}catch{wasmModule195=false;}
   }
   if(wasmModule195){const instance=new WebAssembly.Instance(wasmModule195),buffer=instance.exports.memory.buffer;
    if(buffer.byteLength===16777216)arena={instance,buffer,f32:new Float32Array(buffer),f64:new Float64Array(buffer),u32:new Uint32Array(buffer),used:4096,buckets:0,instances:0,failed:false,token:null};
   }
  }catch{}
  wasmArenas195.set(epoch,arena);return arena;
 }
 function releaseWasm195(epoch){
  const a=epoch&&wasmArenas195.get(epoch);if(!a)return;
  a.failed=true;a.token=null;a.instance=null;a.buffer=null;a.f32=null;a.f64=null;a.u32=null;wasmArenas195.delete(epoch);
 }
 function* prepareWasm195(bucket,epoch){
  wasmProofs195.delete(bucket);
  const own=k=>Object.getOwnPropertyDescriptor(bucket,k)?.value;
  const data=own('data'),sp=own('spatial'),groups=own('groups'),flags=own('essentialFlags'),surface=own('surfaceWidths'),count=own('count'),n=data?.length/28;
  if(!epoch||!(data instanceof Float32Array)||!(sp instanceof Float32Array)||!(groups instanceof Float64Array)||!(flags instanceof Uint8Array)||(surface!==null&&!(surface instanceof Float64Array))||!Number.isInteger(n)||n<128||count!==n||sp.length!==n*5||flags.length!==n||surface&&surface.length!==n||groups.length!==Math.ceil(n/64)*5)return;
  if([data,sp,groups,flags,surface].some(a=>a&&(Object.getPrototypeOf(a.buffer)!==ArrayBuffer.prototype||a.buffer.resizable)))return;
  const arena=wasmArena195(epoch);if(!arena||arena.failed)return;
  const padded=(n+1)&~1,stride=padded*4,base=arena.used,next=base+stride*8;
  if(!Number.isSafeInteger(next)||next>arena.buffer.byteLength)return;
  // Reserve before yielding. Invalid records leave a bounded unused reservation;
  // they never rewind past another concurrent builder's published allocation.
  arena.used=next;const f=arena.f32,offset=base/4,widthOffset=(base+stride*6)/8;
  try{for(let k=0;k<n;k++){
   const j=k*5,i=k*28,id=data[i+21],x=sp[j],y=sp[j+1]+(id===0?0*data[i+23]:0),z=sp[j+2],r=sp[j+3],size=sp[j+4],width=data[i+20]===38?size:(surface?surface[k]:0);
   if(![id,x,y,z,r,size,width].every(Number.isFinite)||r<0||(id>=950000&&id<960000))return;
   f[offset+k]=x;f[offset+padded+k]=y;f[offset+padded*2+k]=z;f[offset+padded*3+k]=r;f[offset+padded*4+k]=size;f[offset+padded*5+k]=flags[k]||id===0?1:0;arena.f64[widthOffset+k]=width;
    // Original binary32 fields and Boolean only; width stays binary64.
    // Effective Y includes the original signed-zero addition.
    if(!Object.is(f[offset+padded+k],y))return;
   if((k&63)===63){yield;if(arena.failed)return;}
  }}catch{return;}
  wasmProofs195.set(bucket,{epoch,data,sp,groups,flags,surface,count:n,arena,base,stride,lo:0,hi:0});arena.buckets++;arena.instances+=n;
 }
 function registerWasmEngine195(proto){
  const names=['buildVisiblePlan','visibleRanges','instanceCache','groupDraws','mergePage208','schedulePackedVisibility206','cancelPackedVisibility206'];
  if(names.some(k=>typeof proto[k]!=='function'))return;
  wasmEngineMethods195={proto,methods:Object.fromEntries(names.map(k=>[k,proto[k]])),select:Y.Visibility.select,packed:Y.Visibility.packedSelect195,indexed:Y.Visibility.indexedBuckets,prepare:Y.Visibility.preparePacked206};
 }
 function wasmContext195(planes,eye,focal,state,scratch,epoch,engine){
  const trusted=wasmEngineMethods195,arena=epoch&&wasmArenas195.get(epoch);
  if(!trusted||Y.Visibility.preparePacked206!==trusted.prepare||!arena||arena.failed||Object.getPrototypeOf(engine)!==trusted.proto||Object.getOwnPropertyDescriptor(Y.Visibility,'select')?.value!==trusted.select||Object.getOwnPropertyDescriptor(Y.Visibility,'packedSelect195')?.value!==trusted.packed||Object.getOwnPropertyDescriptor(Y.Visibility,'indexedBuckets')?.value!==trusted.indexed||!Number.isFinite(focal))return null;
  for(const[k,v]of Object.entries(trusted.methods)){const d=Object.getOwnPropertyDescriptor(engine,k)||Object.getOwnPropertyDescriptor(trusted.proto,k);if(d?.value!==v)return null;}
  const buckets=Object.getOwnPropertyDescriptor(engine,'buckets')?.value,data=Object.getOwnPropertyDescriptor(scratch,'data')?.value;
  if(!(buckets instanceof Map)||Object.getPrototypeOf(buckets)!==Map.prototype||Object.getOwnPropertyDescriptor(buckets,Symbol.iterator)||Map.prototype[Symbol.iterator]!==wasmMapIterator195||Array.prototype[Symbol.iterator]!==wasmArrayIterator195||!(data instanceof Float32Array)||Object.getPrototypeOf(scratch)!==Object.prototype)return null;
  const stateKeys=['selected','isolate','explode','vegetation','detailLOD'];
  if(Object.getPrototypeOf(state)!==Object.prototype&&Object.getPrototypeOf(state)!==null)return null;
  const values={};for(const k of stateKeys){const d=Object.getOwnPropertyDescriptor(state,k);if(d&&!('value'in d)||!d&&k in state)return null;values[k]=d?.value;}
  if(values.selected!==0||values.isolate!==0||values.explode!==0||values.vegetation!==true||![undefined,true,false].includes(values.detailLOD))return null;
  if(!Array.isArray(eye)||Object.getPrototypeOf(eye)!==Array.prototype||eye.length!==3)return null;
  const xyz=[];for(let k=0;k<3;k++){const x=Object.getOwnPropertyDescriptor(eye,String(k))?.value;if(!Number.isFinite(x))return null;xyz.push(x);}
  if(!Array.isArray(planes)||Object.getPrototypeOf(planes)!==Array.prototype||planes.length<1||planes.length>32||Object.getOwnPropertyDescriptor(planes,Symbol.iterator))return null;
  const coefficients=[];for(let k=0;k<planes.length;k++){
   const p=Object.getOwnPropertyDescriptor(planes,String(k))?.value;
   if(!Array.isArray(p)||Object.getPrototypeOf(p)!==Array.prototype||p.length!==4)return null;
   for(let j=0;j<4;j++){const value=Object.getOwnPropertyDescriptor(p,String(j))?.value;if(!Number.isFinite(value))return null;coefficients.push(value);}
  }
  const token={planes,eye,focal,state,scratch,epoch,arena,xyz,coefficients,detailLOD:values.detailLOD,enabled:values.detailLOD!==false};wasmContexts195.add(token);return token;
 }
 function endWasmContext195(token){if(token)wasmContexts195.delete(token);}
 function wasmProof195(bucket,data,sp,groups,planes,eye,focal,state,out,epoch,token){
  if(!token||!wasmContexts195.has(token)||token.epoch!==epoch||token.planes!==planes||token.eye!==eye||token.focal!==focal||token.state!==state||token.scratch.data!==out||token.arena.failed)return null;
  if(state.selected!==0||state.isolate!==0||state.explode!==0||state.vegetation!==true||state.detailLOD!==token.detailLOD)return null;
  const proof=wasmProofs195.get(bucket);
  if(!proof||proof.epoch!==epoch||proof.arena!==token.arena||proof.data!==data||proof.sp!==sp||proof.groups!==groups||proof.flags!==bucket.essentialFlags||proof.surface!==bucket.surfaceWidths||proof.count!==bucket.count||data.length!==proof.count*28||sp.length!==proof.count*5||groups.length!==Math.ceil(proof.count/64)*5||proof.flags.length!==proof.count||proof.surface&&proof.surface.length!==proof.count)return null;
  if(data.buffer===out.buffer||sp.buffer===out.buffer||groups.buffer===out.buffer||proof.flags.buffer===out.buffer||proof.surface&&proof.surface.buffer===out.buffer)return null;
  return proof;
 }
 function wasmGroup195(proof,token,start,count,inside,enabled){
  const a=proof.arena;if(a.failed||enabled!==token.enabled)return null;
  try{
   if(a.token!==token){a.f64.set(token.coefficients,0);a.f64.set([...token.xyz,token.focal],128);a.token=token;}
   const culled=a.instance.exports.group(proof.base,proof.stride,start,count,inside?1:0,enabled?1:0,token.planes.length);proof.lo=a.u32[512];proof.hi=a.u32[513];return culled;
  }catch{a.failed=true;return null;}
 }
 function wasmStatus195(epoch){const a=epoch&&wasmArenas195.get(epoch);return a?{memoryBytes:a.buffer.byteLength,usedBytes:a.used,buckets:a.buckets,instances:a.instances,usedAtLeastOnce:a.token!==null,failed:a.failed}:null;}

 function select(bucket,planes,eye,focal,state,scratch,ownedScratch=false,appendToStream=false,result={count:0,culled:0},insideEpoch=null){
  // Engine may provide one synchronous result slot; ordinary callers still
  // receive a fresh object. Reset before any early exit or possible error.
  result.count=0;result.culled=0;
  const data=bucket.data,sp=bucket.spatial,iso=state.isolate,only=bucket.uniformId,coarse=bucket.coarse;
  if(iso&&!bucket.ids.has(iso)&&!bucket.ids.has(999999))return result;
  if(only!==null&&((state.vegetation===false&&only>=800000&&only<900000)||(only>=950000&&only<960000&&!state.routeEdges?.has(only-950000))))return result;
  // A finite, concentric single instance can use its exact scalar sphere once.
  // Any displacement or ambiguous metadata retains the original two-stage path.
  let singleInside=false;
  if(bucket.singleSphere&&state.explode===0&&(scratch?scratch.data:bucket.visible)){
   const y=sp[1]+(data[21]===state.selected?(state.explode||0)*data[23]:0);
   if(!sphereVisible(planes,sp[0],y,sp[2],sp[3]))return result;
   singleInside=true;
  }else if(!sphereVisible(planes,coarse[0],coarse[1],coarse[2],coarse[3]+Math.abs(state.explode||0)*bucket.maxPart))return result;
  const offset=appendToStream?scratch.used:0;
  let out=scratch?scratch.data:bucket.visible;if(!out){out=new Float32Array(Math.min(64,bucket.count)*28);if(scratch)scratch.data=out;else bucket.visible=out;}let count=0,culled=0;
  const enabled=state.detailLOD!==false,selected=state.selected,surface=bucket.surfaceWidths,flags=bucket.essentialFlags,groups=bucket.groups;
  let inside=singleInside||smallInside(bucket,planes,state,out,insideEpoch);
  // A native one-record source needs the same scalar decisions, but no group
  // traversal or accepted-run bookkeeping. Groups and source/output aliases
  // retain the generic path, including its exact detached-buffer exceptions.
  if(data.length===28&&!groups&&data.buffer!==out.buffer){
   const i=0,j=0,k=0;
   singleton:{
   const id=data[i+21];if(iso&&id!==iso&&id!==999999)break singleton;
   if((state.vegetation===false&&id>=800000&&id<900000)||(id>=950000&&id<960000&&!state.routeEdges?.has(id-950000)))break singleton;
   const x=sp[j],y=sp[j+1]+(id===selected?(state.explode||0)*data[i+23]:0),z=sp[j+2],r=sp[j+3];
   if(!inside&&!sphereVisible(planes,x,y,z,r))break singleton;
   if(enabled){
    const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],distanceSq=dx*dx+dy*dy+dz*dz,width=data[i+20]===38?sp[j+4]:(surface?surface[k]:0);
    const surfaceLimit=width*focal/.85;
    if(width&&Math.max(1,distanceSq)>surfaceLimit*surfaceLimit){culled++;break singleton;}
    if(!iso&&id!==selected&&!flags[k]&&distanceSq>=260*260){const limit=sp[j+4]*focal/1.6;if(distanceSq>limit*limit){culled++;break singleton;}}
   }
   if(offset+(count+1)*28>out.length){
    const length=appendToStream?Math.max(offset+(count+1)*28,Math.ceil(out.length*1.25)):Math.min(data.length,Math.max(28,out.length*2));let next;
    // Engine consumes each prefix synchronously before reusing its own scratch.
    if(ownedScratch&&scratch&&out.byteOffset===0&&out.byteLength===out.buffer.byteLength&&typeof out.buffer.transfer==='function')next=new Float32Array(out.buffer.transfer(length*4));
    else{next=new Float32Array(length);next.set(out);}
    out=next;if(scratch)scratch.data=next;else bucket.visible=next;
   }
    out.set(data,offset);count=1;
   }
   result.count=count;result.culled=culled;return result;
  }
  let runStart=-1,runEnd=0,runOutput=0;
  for(let i=0,j=0,k=0;i<data.length;i+=28,j+=5,k++){
   if(groups&&(k&63)===0){
    const q=(k>>6)*5,r=groups[q+3]+Math.abs(state.explode||0)*groups[q+4];let outside=false;inside=true;
    for(const p of planes){const distance=p[0]*groups[q]+p[1]*groups[q+1]+p[2]*groups[q+2]+p[3];if(distance< -r){outside=true;break;}if(distance<r)inside=false;}
    if(outside){i+=63*28;j+=63*5;k+=63;continue;}
    // Conservative group bounds can prove every existing per-instance test
    // would accept. Ambiguous detail thresholds and filtering use the scalar path.
    if(inside&&!iso&&state.vegetation!==false&&bucket.groupDetail&&!bucket.groupRoutes[k>>6]){
     const d=(k>>6)*4,distance=Math.hypot(groups[q]-eye[0],groups[q+1]-eye[1],groups[q+2]-eye[2]),far=distance+r,near=Math.max(0,distance-r);
     if(enabled&&((near>=260&&!bucket.ids.has(selected)&&near>bucket.groupDetail[d+2]*focal/1.6)||Math.max(1,near)>bucket.groupDetail[d+3]*focal/.85)){
      const rejected=Math.min(64,data.length/28-k);culled+=rejected;i+=(rejected-1)*28;j+=(rejected-1)*5;k+=rejected-1;continue;
     }
     if(!enabled||((far<260||far<bucket.groupDetail[d]*focal/1.6)&&Math.max(1,far)<bucket.groupDetail[d+1]*focal/.85)){
      const accepted=Math.min(64,data.length/28-k),end=i+accepted*28,needed=offset+(count+accepted)*28;
      if(needed>out.length){
       const length=appendToStream?Math.max(needed,Math.ceil(out.length*1.25)):Math.min(data.length,Math.max(needed,out.length*2));let next;
       if(ownedScratch&&scratch&&out.byteOffset===0&&out.byteLength===out.buffer.byteLength&&typeof out.buffer.transfer==='function')next=new Float32Array(out.buffer.transfer(length*4));
       else{next=new Float32Array(length);next.set(out);}out=next;if(scratch)scratch.data=next;else bucket.visible=next;
      }
      if(runStart>=0){out.set(data.subarray(runStart,runEnd),offset+runOutput*28);runStart=-1;}
      out.set(data.subarray(i,end),offset+count*28);count+=accepted;
      i+=(accepted-1)*28;j+=(accepted-1)*5;k+=accepted-1;continue;
     }
    }
   }
   const id=data[i+21];if(iso&&id!==iso&&id!==999999)continue;
   if((state.vegetation===false&&id>=800000&&id<900000)||(id>=950000&&id<960000&&!state.routeEdges?.has(id-950000)))continue;
   const x=sp[j],y=sp[j+1]+(id===selected?(state.explode||0)*data[i+23]:0),z=sp[j+2],r=sp[j+3];
   if(!inside&&!sphereVisible(planes,x,y,z,r))continue;
   if(enabled){
    const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],distanceSq=dx*dx+dy*dy+dz*dz,width=data[i+20]===38?sp[j+4]:(surface?surface[k]:0);
    const surfaceLimit=width*focal/.85;
    if(width&&Math.max(1,distanceSq)>surfaceLimit*surfaceLimit){culled++;continue;}
    if(!iso&&id!==selected&&!flags[k]&&distanceSq>=260*260){const limit=sp[j+4]*focal/1.6;if(distanceSq>limit*limit){culled++;continue;}}
   }
   if(offset+(count+1)*28>out.length){
    const length=appendToStream?Math.max(offset+(count+1)*28,Math.ceil(out.length*1.25)):Math.min(data.length,Math.max(28,out.length*2));let next;
    // Engine consumes each prefix synchronously before reusing its own scratch.
    if(ownedScratch&&scratch&&out.byteOffset===0&&out.byteLength===out.buffer.byteLength&&typeof out.buffer.transfer==='function')next=new Float32Array(out.buffer.transfer(length*4));
    else{next=new Float32Array(length);next.set(out);}
    out=next;if(scratch)scratch.data=next;else bucket.visible=next;
   }
   // Copy consecutive accepted records as one typed-array span. Visibility
   // decisions and order stay unchanged; gaps end a span, never its neighbors.
   if(runStart>=0&&runEnd!==i){out.set(data.subarray(runStart,runEnd),offset+runOutput*28);runStart=-1;}
   if(runStart<0){runStart=i;runOutput=count;}
   runEnd=i+28;count++;
  }
  if(runStart>=0)out.set(runStart===0&&runEnd===data.length?data:data.subarray(runStart,runEnd),offset+runOutput*28);
  result.count=count;result.culled=culled;return result;
 }
 function packedSelect195(bucket,planes,eye,focal,state,scratch,ownedScratch=false,appendToStream=false,result={count:0,culled:0},insideEpoch=null,fastContext195=null){
  // Engine may provide one synchronous result slot; ordinary callers still
  // receive a fresh object. Reset before any early exit or possible error.
  result.count=0;result.culled=0;
  const data=bucket.data,sp=bucket.spatial,iso=state.isolate,only=bucket.uniformId,coarse=bucket.coarse;
  if(iso&&!bucket.ids.has(iso)&&!bucket.ids.has(999999))return result;
  if(only!==null&&((state.vegetation===false&&only>=800000&&only<900000)||(only>=950000&&only<960000&&!state.routeEdges?.has(only-950000))))return result;
  // A finite, concentric single instance can use its exact scalar sphere once.
  // Any displacement or ambiguous metadata retains the original two-stage path.
  let singleInside=false;
  if(bucket.singleSphere&&state.explode===0&&(scratch?scratch.data:bucket.visible)){
   const y=sp[1]+(data[21]===state.selected?(state.explode||0)*data[23]:0);
   if(!sphereVisible(planes,sp[0],y,sp[2],sp[3]))return result;
   singleInside=true;
  }else if(!sphereVisible(planes,coarse[0],coarse[1],coarse[2],coarse[3]+Math.abs(state.explode||0)*bucket.maxPart))return result;
  const offset=appendToStream?scratch.used:0;
  let out=scratch?scratch.data:bucket.visible;if(!out){out=new Float32Array(Math.min(64,bucket.count)*28);if(scratch)scratch.data=out;else bucket.visible=out;}let count=0,culled=0;
  const enabled=state.detailLOD!==false,selected=state.selected,surface=bucket.surfaceWidths,flags=bucket.essentialFlags,groups=bucket.groups;
  let inside=singleInside||smallInside(bucket,planes,state,out,insideEpoch);
  const fast195=groups&&ownedScratch&&appendToStream&&wasmProof195(bucket,data,sp,groups,planes,eye,focal,state,out,insideEpoch,fastContext195);let fastMask195=false;
  // A native one-record source needs the same scalar decisions, but no group
  // traversal or accepted-run bookkeeping. Groups and source/output aliases
  // retain the generic path, including its exact detached-buffer exceptions.
  if(data.length===28&&!groups&&data.buffer!==out.buffer){
   const i=0,j=0,k=0;
   singleton:{
   const id=data[i+21];if(iso&&id!==iso&&id!==999999)break singleton;
   if((state.vegetation===false&&id>=800000&&id<900000)||(id>=950000&&id<960000&&!state.routeEdges?.has(id-950000)))break singleton;
   const x=sp[j],y=sp[j+1]+(id===selected?(state.explode||0)*data[i+23]:0),z=sp[j+2],r=sp[j+3];
   if(!inside&&!sphereVisible(planes,x,y,z,r))break singleton;
   if(enabled){
    const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],distanceSq=dx*dx+dy*dy+dz*dz,width=data[i+20]===38?sp[j+4]:(surface?surface[k]:0);
    const surfaceLimit=width*focal/.85;
    if(width&&Math.max(1,distanceSq)>surfaceLimit*surfaceLimit){culled++;break singleton;}
    if(!iso&&id!==selected&&!flags[k]&&distanceSq>=260*260){const limit=sp[j+4]*focal/1.6;if(distanceSq>limit*limit){culled++;break singleton;}}
   }
   if(offset+(count+1)*28>out.length){
    const length=appendToStream?Math.max(offset+(count+1)*28,Math.ceil(out.length*1.25)):Math.min(data.length,Math.max(28,out.length*2));let next;
    // Engine consumes each prefix synchronously before reusing its own scratch.
    if(ownedScratch&&scratch&&out.byteOffset===0&&out.byteLength===out.buffer.byteLength&&typeof out.buffer.transfer==='function')next=new Float32Array(out.buffer.transfer(length*4));
    else{next=new Float32Array(length);next.set(out);}
    out=next;if(scratch)scratch.data=next;else bucket.visible=next;
   }
    out.set(data,offset);count=1;
   }
   result.count=count;result.culled=culled;return result;
  }
  let runStart=-1,runEnd=0,runOutput=0;
  for(let i=0,j=0,k=0;i<data.length;i+=28,j+=5,k++){
   if(groups&&(k&63)===0){
    fastMask195=false;
    const q=(k>>6)*5,r=groups[q+3]+Math.abs(state.explode||0)*groups[q+4];let outside=false;inside=true;
    for(const p of planes){const distance=p[0]*groups[q]+p[1]*groups[q+1]+p[2]*groups[q+2]+p[3];if(distance< -r){outside=true;break;}if(distance<r)inside=false;}
    if(outside){i+=63*28;j+=63*5;k+=63;continue;}
    // Conservative group bounds can prove every existing per-instance test
    // would accept. Ambiguous detail thresholds and filtering use the scalar path.
    if(inside&&!iso&&state.vegetation!==false&&bucket.groupDetail&&!bucket.groupRoutes[k>>6]){
     const d=(k>>6)*4,distance=Math.hypot(groups[q]-eye[0],groups[q+1]-eye[1],groups[q+2]-eye[2]),far=distance+r,near=Math.max(0,distance-r);
     if(enabled&&((near>=260&&!bucket.ids.has(selected)&&near>bucket.groupDetail[d+2]*focal/1.6)||Math.max(1,near)>bucket.groupDetail[d+3]*focal/.85)){
      const rejected=Math.min(64,data.length/28-k);culled+=rejected;i+=(rejected-1)*28;j+=(rejected-1)*5;k+=rejected-1;continue;
     }
     if(!enabled||((far<260||far<bucket.groupDetail[d]*focal/1.6)&&Math.max(1,far)<bucket.groupDetail[d+1]*focal/.85)){
      const accepted=Math.min(64,data.length/28-k),end=i+accepted*28,needed=offset+(count+accepted)*28;
      if(needed>out.length){
       const length=appendToStream?Math.max(needed,Math.ceil(out.length*1.25)):Math.min(data.length,Math.max(needed,out.length*2));let next;
       if(ownedScratch&&scratch&&out.byteOffset===0&&out.byteLength===out.buffer.byteLength&&typeof out.buffer.transfer==='function')next=new Float32Array(out.buffer.transfer(length*4));
       else{next=new Float32Array(length);next.set(out);}out=next;if(scratch)scratch.data=next;else bucket.visible=next;
      }
      if(runStart>=0){out.set(data.subarray(runStart,runEnd),offset+runOutput*28);runStart=-1;}
      out.set(data.subarray(i,end),offset+count*28);count+=accepted;
      i+=(accepted-1)*28;j+=(accepted-1)*5;k+=accepted-1;continue;
     }
    }
    if(fast195){const skipped195=wasmGroup195(fast195,fastContext195,k,Math.min(64,data.length/28-k),inside,enabled);if(skipped195!==null){culled+=skipped195;fastMask195=true;}}
   }
   if(fastMask195){if(!(((k&63)<32?fast195.lo:fast195.hi)&(1<<(k&31))))continue;}else{
   const id=data[i+21];if(iso&&id!==iso&&id!==999999)continue;
   if((state.vegetation===false&&id>=800000&&id<900000)||(id>=950000&&id<960000&&!state.routeEdges?.has(id-950000)))continue;
   const x=sp[j],y=sp[j+1]+(id===selected?(state.explode||0)*data[i+23]:0),z=sp[j+2],r=sp[j+3];
   if(!inside&&!sphereVisible(planes,x,y,z,r))continue;
   if(enabled){
    const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],distanceSq=dx*dx+dy*dy+dz*dz,width=data[i+20]===38?sp[j+4]:(surface?surface[k]:0);
    const surfaceLimit=width*focal/.85;
    if(width&&Math.max(1,distanceSq)>surfaceLimit*surfaceLimit){culled++;continue;}
    if(!iso&&id!==selected&&!flags[k]&&distanceSq>=260*260){const limit=sp[j+4]*focal/1.6;if(distanceSq>limit*limit){culled++;continue;}}
   }
   }
   if(offset+(count+1)*28>out.length){
    const length=appendToStream?Math.max(offset+(count+1)*28,Math.ceil(out.length*1.25)):Math.min(data.length,Math.max(28,out.length*2));let next;
    // Engine consumes each prefix synchronously before reusing its own scratch.
    if(ownedScratch&&scratch&&out.byteOffset===0&&out.byteLength===out.buffer.byteLength&&typeof out.buffer.transfer==='function')next=new Float32Array(out.buffer.transfer(length*4));
    else{next=new Float32Array(length);next.set(out);}
    out=next;if(scratch)scratch.data=next;else bucket.visible=next;
   }
   // Copy consecutive accepted records as one typed-array span. Visibility
   // decisions and order stay unchanged; gaps end a span, never its neighbors.
   if(runStart>=0&&runEnd!==i){out.set(data.subarray(runStart,runEnd),offset+runOutput*28);runStart=-1;}
   if(runStart<0){runStart=i;runOutput=count;}
   runEnd=i+28;count++;
  }
  if(runStart>=0)out.set(runStart===0&&runEnd===data.length?data:data.subarray(runStart,runEnd),offset+runOutput*28);
  result.count=count;result.culled=culled;return result;
 }

 // Immutable compiled-bucket snapshot. Rebuild after compilation or scene changes.
 // Nodes bound centers and radii separately: this preserves the selector's scalar
 // radius convention even for non-unit planes. No group/instance tests change.
 // The optional epoch is an explicit owner guarantee: compiled geometry and
 // Map membership/order are immutable until the owner invalidates that epoch.
 // Generic public mutable Maps never acquire an index implicitly.
 function* buildBucketIndexSteps(buckets,epoch){
  if(!epoch||!(buckets instanceof Map)||buckets[Symbol.iterator]!==Map.prototype[Symbol.iterator])return null;
  const entries=[],fallback=[],bands=new Map();let i=0;
  for(const entry of buckets){
   entries.push(entry);const b=entry[1],c=b.coarse,p=b.maxPart;prepareSmallInside(b,epoch);
   if(!c||![c[0],c[1],c[2],c[3],p].every(Number.isFinite)||c[3]<0||p<0)fallback.push(i);
   else{
    const a=[c[0],c[1],c[2]],z=a.slice();let r=c[3],valid=true;
    if(b.singleSphere){const q=b.spatial;
     if(!q||![q[0],q[1],q[2],q[3]].every(Number.isFinite)||q[3]<0)valid=false;
     else{for(let j=0;j<3;j++){a[j]=Math.min(a[j],q[j]);z[j]=Math.max(z[j],q[j]);}r=Math.max(r,q[3]);}
    }
    if(!valid)fallback.push(i);
    else{const band=Math.floor(Math.log2(Math.max(r,1)));if(!bands.has(band))bands.set(band,[]);bands.get(band).push({i,a,z,r,p});}
   }
   i++;if((i&63)===0)yield;
  }
  function* split(rs){
   const a=[Infinity,Infinity,Infinity],z=[-Infinity,-Infinity,-Infinity];let r=0,p=0,k=0;
   for(const v of rs){for(let j=0;j<3;j++){a[j]=Math.min(a[j],v.a[j]);z[j]=Math.max(z[j],v.z[j]);}r=Math.max(r,v.r);p=Math.max(p,v.p);if((++k&63)===0)yield;}
   const node={a,z,r,p};yield;
   if(rs.length<=12)node.ids=rs.map(v=>v.i);
   else{
    let axis=0;for(let j=1;j<3;j++)if(z[j]-a[j]>z[axis]-a[axis])axis=j;
    const middle=a[axis]/2+z[axis]/2;let left=[],right=[];k=0;
    for(const v of rs){(v.a[axis]<middle?left:right).push(v);if((++k&63)===0)yield;}
    // Extremely skewed/identical centers split by ordinal, in bounded batches.
    if(Math.min(left.length,right.length)<rs.length/8){left=[];right=[];for(let n=0;n<rs.length;n++){(n<rs.length/2?left:right).push(rs[n]);if((n&63)===63)yield;}}
    node.left=yield* split(left);node.right=yield* split(right);
   }
   return node;
  }
  const children=[],a=[Infinity,Infinity,Infinity],z=[-Infinity,-Infinity,-Infinity];
  for(const rs of bands.values()){const child=yield* split(rs);children.push(child);for(let j=0;j<3;j++){a[j]=Math.min(a[j],child.a[j]);z[j]=Math.max(z[j],child.z[j]);}yield;}
  return {epoch,buckets,size:buckets.size,entries,fallback,root:{a,z,children}};
 }
 function buildBucketIndex(buckets,epoch){const steps=buildBucketIndexSteps(buckets,epoch);let step;do{step=steps.next();}while(!step.done);return step.value;}
 function indexedBuckets(index,buckets,planes,state,epoch){
  // Exotic public inputs retain their original indexed/iterator semantics.
  if(!epoch||!index||index.epoch!==epoch||index.buckets!==buckets||index.size!==buckets.size||buckets[Symbol.iterator]!==Map.prototype[Symbol.iterator]||!Array.isArray(planes)||planes[Symbol.iterator]!==Array.prototype[Symbol.iterator]||typeof state.explode!=='number'||!Number.isFinite(state.explode))return buckets;
  for(let k=0;k<planes.length;k++){const p=planes[k];if(!(Array.isArray(p)||ArrayBuffer.isView(p))||![p[0],p[1],p[2],p[3]].every(Number.isFinite))return buckets;}
  const root=index.root;
  if(root&&planes.every(p=>p[0]*(p[0]<0?root.z[0]:root.a[0])+p[1]*(p[1]<0?root.z[1]:root.a[1])+p[2]*(p[2]<0?root.z[2]:root.a[2])+p[3]>=0))return buckets;
  const ids=index.fallback.slice(),explode=Math.abs(state.explode);
  function visit(node,inside=0){
   if(!node)return;
   if(node.children){for(const child of node.children)visit(child,inside);return;}
   const r=node.r+explode*node.p;
   for(let k=0;k<planes.length;k++){
    if(k<31&&(inside&(1<<k)))continue;
    const p=planes[k],x=p[0]*(p[0]<0?node.a[0]:node.z[0]),y=p[1]*(p[1]<0?node.a[1]:node.z[1]),z=p[2]*(p[2]<0?node.a[2]:node.z[2]),d=x+y+z+p[3];
    // Outward roundoff allowance; overflow/ambiguous arithmetic never rejects.
    const error=32*Number.EPSILON*(Math.abs(x)+Math.abs(y)+Math.abs(z)+Math.abs(p[3])+Math.abs(r)+1);
    if(Number.isFinite(d)&&Number.isFinite(r)&&Number.isFinite(error)&&d < -r-error)return;
    if(!node.ids&&k<31){
     const lower=p[0]*(p[0]<0?node.z[0]:node.a[0])+p[1]*(p[1]<0?node.z[1]:node.a[1])+p[2]*(p[2]<0?node.z[2]:node.a[2])+p[3];
     // Descendant upper-corner terms are each >= this lower corner's terms.
     // Identical left-to-right arithmetic is monotone: finite lower >= 0
     // proves every descendant's original outside rejection must accept.
     if(Number.isFinite(lower)&&lower>=0)inside|=1<<k;
    }
   }
   if(node.ids)ids.push(...node.ids);else{visit(node.left,inside);visit(node.right,inside);}
  }
  visit(index.root);if(ids.length>buckets.size*.7)return buckets;
  // Restore Map order with a compact bitset rather than sorting thousands of
  // candidates. Empty 32-bucket spans cost one scalar word, not a bucket visit.
  const bits=new Uint32Array(Math.ceil(index.size/32)),ordered=[];
  for(const i of ids)bits[i>>>5]|=1<<(i&31);
  for(let word=0;word<bits.length;word++){let mask=bits[word];while(mask){const bit=31-Math.clz32(mask&-mask);ordered.push(index.entries[word*32+bit]);mask=(mask&(mask-1))>>>0;}}
  return ordered;
 }
 Y.Visibility={preparePacked206:prepareWasm195,packedSelect195,wasmContext195,endWasmContext195,registerWasmEngine195,wasmStatus195,releaseWasm195,prepareSmallInside,buildBucketIndex,buildBucketIndexSteps,indexedBuckets,essentialMaterials:Object.freeze([...essential]),keepDetail,keepSurfaceDetail,prepare,bounds,sphereVisible,compile,prepareSingle,select};
})(YY);
