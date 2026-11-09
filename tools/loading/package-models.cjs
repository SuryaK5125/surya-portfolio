/** Offline lossless delivery packaging. Sources remain editable, never decimated. */
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');
const { MeshoptEncoder } = require('meshoptimizer');
const root = path.resolve(__dirname, '../..');
const ext = 'EXT_meshopt_compression';
const files = ['Props/headphones', 'Props/mouse', 'Props/chair', 'Laptop/laptop', 'Porsche/porsche', 'Speaker/speaker'];
function readGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  const n = bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.subarray(20,20+n).toString()), bin: bytes.subarray(28+n) };
}
function writeGlb(json, bin) {
  const raw = Buffer.from(JSON.stringify(json));
  const j = Buffer.alloc((raw.length+3)&~3,32); raw.copy(j);
  const b = Buffer.alloc((bin.length+3)&~3); bin.copy(b);
  const h = Buffer.alloc(20); h.writeUInt32LE(0x46546c67); h.writeUInt32LE(2,4); h.writeUInt32LE(28+j.length+b.length,8); h.writeUInt32LE(j.length,12); h.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8); bh.writeUInt32LE(b.length); bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([h,j,bh,b]);
}
(async()=>{
  // Verify with exactly the decoder shipped by our installed Three.js version.
  const decoderText=fs.readFileSync(path.join(root,'node_modules/three/examples/jsm/libs/meshopt_decoder.module.js'),'utf8');
  const { MeshoptDecoder }=await import('data:text/javascript;base64,'+Buffer.from(decoderText).toString('base64'));
  await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
  const manifest=[];
  for (const name of files) {
    const source=path.join(root,'static/models',name+'.glb');
    const original=fs.readFileSync(source), {json,bin}=readGlb(original);
    const chunks=[];let offset=0, decodedOffset=0, compressedViews=0;
    const append=data=>{const start=offset;chunks.push(Buffer.from(data));offset+=data.length;const pad=(-offset)&3;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return start;};
    const imageViews=new Map((json.images||[]).map((image,i)=>[image.bufferView,i]));
    const imageChanges=[];
    for (let i=0;i<json.bufferViews.length;i++) {
      const view=json.bufferViews[i];
      const raw=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
      const imageIndex=imageViews.get(i);
      if(imageIndex!==undefined) {
        let data=raw;
        const image=json.images[imageIndex];
        if(image.mimeType==='image/png') {
          // Pillow's lossless WebP: require identical decoded pixels, no resize.
          const py=spawnSync('python',[path.join(__dirname,'lossless-image.py')],{input:raw,maxBuffer:16*1024*1024});
          if(py.status!==0) throw new Error(py.stderr.toString());
          if(py.stdout.length<raw.length) {
            data=py.stdout;image.mimeType='image/webp';
            for(const texture of json.textures||[]) if(texture.source===imageIndex) {
              texture.extensions={...texture.extensions,EXT_texture_webp:{source:imageIndex}};delete texture.source;
            }
            for(const key of ['extensionsUsed','extensionsRequired']) json[key]=[...new Set([...(json[key]||[]),'EXT_texture_webp'])];
            imageChanges.push({image:imageIndex,before:raw.length,after:data.length,pixels:'identical'});
          }
        }
        view.buffer=0;view.byteOffset=append(data);view.byteLength=data.length;
        continue;
      }
      const accessors=(json.accessors||[]).filter(a=>a.bufferView===i);
      const indexed=json.meshes.some(m=>m.primitives.some(p=>p.indices!==undefined&&json.accessors[p.indices].bufferView===i));
      const a=accessors[0],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
      const sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
      const stride=view.byteStride||(a&&sizes[a.componentType]*components[a.type]);
      // Only compress complete, aligned streams. Other data is kept unchanged.
      if(!stride||raw.length%stride||(!indexed&&(stride%4||stride>256))) {
        view.buffer=0;view.byteOffset=append(raw);continue;
      }
      const count=raw.length/stride, mode=indexed?'INDICES':'ATTRIBUTES';
      const encoded=MeshoptEncoder.encodeGltfBuffer(raw,count,stride,mode);
      const check=new Uint8Array(raw.length);
      MeshoptDecoder.decodeGltfBuffer(check,count,stride,encoded,mode,'NONE');
      assert.deepEqual(Buffer.from(check),raw,`${name} bufferView ${i} must round-trip byte for byte`);
      view.buffer=1;view.byteOffset=decodedOffset;decodedOffset+=raw.length;decodedOffset=(decodedOffset+3)&~3;
      view.extensions={...view.extensions,[ext]:{buffer:0,byteOffset:append(encoded),byteLength:encoded.length,byteStride:stride,count,mode,filter:'NONE'}};
      compressedViews++;
    }
    json.buffers=[{byteLength:offset},{byteLength:decodedOffset,extensions:{[ext]:{fallback:true}}}];
    for(const key of ['extensionsUsed','extensionsRequired']) json[key]=[...new Set([...(json[key]||[]),ext])];
    const output=writeGlb(json,Buffer.concat(chunks));
    fs.writeFileSync(source.replace('.glb','.meshopt.glb'),output);
    manifest.push({model:name,sourceSha256:createHash('sha256').update(original).digest('hex'),deliverySha256:createHash('sha256').update(output).digest('hex'),before:original.length,after:output.length,compressedViews,images:imageChanges});
    console.log(name+': '+original.length+' -> '+output.length+' bytes');
  }
  fs.writeFileSync(path.join(__dirname,'model-sizes.json'),JSON.stringify(manifest,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
