/** Exercise actual texture setup without WebGL: capabilities cap filtering;
 * model material/colour data and source pixel dimensions remain unchanged. */
const assert=require('assert'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),THREE=require('three');
const filename=path.resolve(__dirname,'../../src/Application/Utils/Resources.ts'),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;
mod.require=name=>{
 if(name==='three')return THREE;
 if(name.includes('GLTFLoader')||name.includes('meshopt_decoder'))return {};
 if(name==='./EventEmitter'||name==='../Application'||name==='./Loading')return {default:class{}};
 if(name==='../UI/EventBus')return {default:{}};
 return require(name);
};
mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText,filename);
for(const max of [0,1,2,16]) {
 const resources=Object.create(mod.exports.default.prototype);resources.application={renderer:{instance:{capabilities:{getMaxAnisotropy:()=>max}}}};resources.items={texture:{},gltfModel:{}};resources.loaded=0;resources.toLoad=10;resources.loading={trigger(){}};
 const texture=new THREE.Texture({width:736,height:1041});texture.encoding=THREE.sRGBEncoding;
 resources.sourceLoaded({type:'texture',name:'test'},texture);
 assert.equal(texture.anisotropy,Math.min(4,max||1));assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(texture.magFilter,THREE.LinearFilter);assert.equal(texture.encoding,THREE.sRGBEncoding);assert.deepEqual([texture.image.width,texture.image.height],[736,1041]);
 const material=new THREE.MeshStandardMaterial({color:0x573a27,map:texture,normalMap:new THREE.Texture(),roughness:.7});const colour=material.color.clone();
 const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material));resources.sourceLoaded({type:'gltfModel',name:'model'},{scene});
 assert.equal(material.normalMap.anisotropy,Math.min(4,max||1));assert(material.color.equals(colour));assert.equal(material.roughness,.7);assert.equal(resources.loaded,2);
}
console.log('PASS: existing textures keep their size, colour space and materials; trilinear filtering and hardware-capped anisotropy work on unsupported/1x/2x/16x devices');
