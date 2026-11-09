/** Loading regression coverage using the actual Resources class with controlled I/O. */
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),THREE=require('three');
const file=path.resolve(__dirname,'../../src/Application/Utils/Resources.ts');
let app,requests,events,handlers;
class Loader {
 setMeshoptDecoder(){return this;}
 load(url,done,progress,failed){requests.push({url,done,failed});}
}
class Emitter {
 constructor(){this.handlers={};}
 on(name,callback){(this.handlers[name]??=[]).push(callback);}
 trigger(name,args=[]){(this.handlers[name]||[]).forEach(callback=>callback(...args));}
}
const m=new Module(file,module);m.filename=file;m.paths=module.paths;
m.require=name=>{
 if(name==='three')return {...THREE,TextureLoader:Loader,CubeTextureLoader:Loader};
 if(name.includes('GLTFLoader'))return {GLTFLoader:Loader};
 if(name.includes('meshopt_decoder'))return {MeshoptDecoder:{}};
 if(name==='../Application')return {default:class {constructor(){return app;}}};
 if(name==='./EventEmitter')return {default:Emitter};
 if(name==='../UI/EventBus')return {default:{dispatch(name,detail){events.push({name,detail});}}};
 return require(name);
};
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2018,module:ts.ModuleKind.CommonJS}}).outputText,file);
const Resources=m.exports.default;
function setup(){requests=[];events=[];handlers={};global.document={baseURI:'http://localhost/',addEventListener(name,callback){handlers[name]=callback;}};app={loading:{trigger(name,args){events.push({name,args});}}};}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const model=()=>({scene:new THREE.Group()});
const critical={name:'desk',type:'gltfModel',path:'desk.glb'},poster={name:'poster',type:'texture',path:'poster.jpg',optional:true},cube={name:'cube',type:'gltfModel',path:'cube.glb',phase:'background'};
(async()=>{
 setup();const r=new Resources([critical,poster,cube]);let ready=0,background=0;r.on('ready',()=>ready++);r.on('backgroundReady',()=>background++);
 const hit={name:'http://localhost/desk.glb',transferSize:0,encodedBodySize:100};
 assert.equal(r.criticalFromCache([hit]),true);
 assert.equal(r.criticalFromCache([{...hit,transferSize:300,encodedBodySize:10000}]),true,'validated cache response transfers headers, not the cached body');
 assert.equal(r.criticalFromCache([{...hit,transferSize:400}]),false);
 assert.equal(r.criticalFromCache([{...hit,encodedBodySize:0}]),false);
 assert.equal(r.criticalFromCache([]),false);
 assert.deepEqual(requests.map(r=>r.url),['desk.glb','poster.jpg']);assert.equal(r.toLoad,2);
 requests[0].done(model());await flush();assert.equal(ready,0);
 requests[1].failed(new Error('optional missing'));await flush();assert.equal(ready,1);assert.equal(r.loaded,2);
 handlers.loadingScreenDone();const a=r.ensureBackground(),b=r.ensureBackground();assert.equal(a,b);assert.equal(requests.length,3);
 requests[2].failed(new Error('offline'));await assert.rejects(a);await flush();assert.equal(background,0);assert.equal(r.loaded,2);
 const retry=r.ensureBackground();assert.equal(requests.length,4);requests[3].done(model());await retry;
 assert.equal(background,1);assert.equal(r.loaded,2);assert.equal(events.filter(e=>e.name==='loadedSource').length,2);
 await r.ensureBackground();assert.equal(requests.length,4);
 setup();const broken=new Resources([critical]);let failedReady=false;broken.on('ready',()=>failedReady=true);requests[0].failed(new Error('offline'));await flush();
 assert.equal(failedReady,false);assert(events.some(e=>e.name==='loadingFailed'));
 console.log('PASS: critical readiness, optional artwork, deferred startup, deduplication, background retry and critical failure');
})().catch(error=>{console.error(error);process.exitCode=1;});
