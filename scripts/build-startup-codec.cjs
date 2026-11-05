'use strict';
// Reversible integer differencing of opaque words. Never convert to floats,
// quantize attributes, reorder vertices/indices, or modify the original files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const definitions={
 'gzip-u32x8-zigzag-v1':{unit:4,lanes:8},
 'gzip-u32-zigzag-v1':{unit:4,lanes:1},
 'gzip-u16-zigzag-v1':{unit:2,lanes:1}
};
function shuffle(bytes,width,inverse=false){
 const result=new Uint8Array(bytes.length);let at=0;
 for(let lane=0;lane<width;lane++)for(let i=lane;i<bytes.length;i+=width){if(inverse)result[i]=bytes[at++];else result[at++]=bytes[i];}
 return result;
}
function definition(codec){const d=definitions[codec];if(!d)throw Error('Unknown startup codec');return d;}
function encodeRaw(raw,codec){
 const {unit,lanes}=definition(codec),width=unit*lanes;
 if(raw.byteLength%width)throw Error('Unaligned startup codec input');
 const input=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),delta=new Uint8Array(raw.byteLength),out=new DataView(delta.buffer),previous=new Uint32Array(lanes);
 for(let i=0;i<raw.byteLength/unit;i++){
  const lane=i%lanes,v=unit===2?input.getUint16(i*unit,true):input.getUint32(i*unit,true),d=unit===2?(v-previous[lane])<<16>>16:(v-previous[lane])>>>0,z=unit===2?((d<<1)^(d>>15))&65535:((d<<1)^(d>>31))>>>0;
  if(unit===2)out.setUint16(i*unit,z,true);else out.setUint32(i*unit,z,true);previous[lane]=v;
 }
 return shuffle(delta,width);
}
function decodeRaw(planes,codec){
 const {unit,lanes}=definition(codec),raw=shuffle(planes,unit*lanes,true);
 if(raw.byteLength%(unit*lanes))throw Error('Unaligned startup codec output');
 const view=new DataView(raw.buffer),previous=new Uint32Array(lanes);
 for(let i=0;i<raw.byteLength/unit;i++){
  const lane=i%lanes,z=unit===2?view.getUint16(i*unit,true):view.getUint32(i*unit,true),v=(previous[lane]+((z>>>1)^-(z&1)))>>>0;
  if(unit===2)view.setUint16(i*unit,v&65535,true);else view.setUint32(i*unit,v,true);previous[lane]=unit===2?v&65535:v;
 }
 return raw;
}
function codecFor(chunk){
 if(chunk.kind!=='mesh')return null;
 if([0,32].includes(chunk.shuffle)&&chunk.rawBytes%32===0)return 'gzip-u32x8-zigzag-v1';
 if(chunk.shuffle===2&&chunk.rawBytes%2===0)return 'gzip-u16-zigzag-v1';
 if(chunk.shuffle===4&&chunk.rawBytes%4===0)return 'gzip-u32-zigzag-v1';
 return null;
}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function main(){
 const root=path.resolve(__dirname,'..'),cache=path.join(root,'app/assets/runtime-v46/scene'),manifestBytes=fs.readFileSync(path.join(cache,'manifest.json')),manifest=JSON.parse(manifestBytes),chunks=[];
 let before=0,after=0;
 for(const [index,c]of manifest.chunks.entries()){
  const selected=Math.min(c.bytes,c.alternative?.bytes||Infinity);before+=selected;after+=selected;
  const codec=codecFor(c);if(!codec||c.rawBytes>64*1024**2)continue;
  const source=fs.readFileSync(path.join(cache,c.file)),inflated=new Uint8Array(zlib.gunzipSync(source)),raw=c.shuffle?shuffle(inflated,c.shuffle,true):inflated;
  if(raw.length!==c.rawBytes||sha(raw)!==c.sha256)throw Error('Original raw chunk checksum mismatch');
  const planes=encodeRaw(raw,codec),restored=decodeRaw(planes,codec);
  if(!Buffer.from(restored).equals(Buffer.from(raw)))throw Error('Lossless codec round trip failed');
  const compressed=zlib.gzipSync(planes,{level:9});if(compressed.length>selected*.95)continue;
  const digest=sha(compressed),file='startup-delta-'+digest.slice(0,24)+'.bin.gz';
  fs.writeFileSync(path.join(cache,file),compressed);
  chunks.push({index,file,codec,bytes:compressed.length,sha256:digest,rawSHA256:c.sha256,sourceFile:c.file,sourceSHA256:sha(source)});after+=compressed.length-selected;
 }
 const approval={schema:1,sourceHash:manifest.sourceHash,parentManifestSHA256:sha(manifestBytes),encoderSHA256:sha(fs.readFileSync(__filename)),chunks};
 fs.writeFileSync(path.join(root,'app/data/startup-codec-v1.json'),JSON.stringify(approval,null,2)+'\n');
 console.log(JSON.stringify({chunks:chunks.length,selectedBytesBefore:before,selectedBytesAfter:after,ratio:after/before,allProcessedRawBytesExactlyVerified:true}));
}
module.exports={definitions,shuffle,encodeRaw,decodeRaw,codecFor};
if(require.main===module)main();
