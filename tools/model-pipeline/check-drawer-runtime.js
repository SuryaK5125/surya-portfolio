/** Exercise the actual cubing drawer, packaged solved cubes, original timer and
 * accessible records panel together. Source geometry is not copied into tests. */
const assert=require('assert'),fs=require('fs'),path=require('path'),Module=require('module');
const ts=require('typescript'),THREE=require('three');
const {readGltf,transformPoint}=require('./lib/gltf');
const root=path.resolve(__dirname,'../..'),scale=263.53;
const HENRY_DESK={scale,position:new THREE.Vector3(0,.502*scale,-.834*scale)};
const backgroundHandlers={};
const app={scene:new THREE.Scene(),time:{delta:16},world:{deskAndChair:{}},sizes:{width:1280,height:720}};
const transitions=[],viewEvents=[];
app.camera={instance:new THREE.PerspectiveCamera(35,1280/720,5,20000),freeCam:false,currentKeyframe:'desk',transition(key){transitions.push(key);this.currentKeyframe=key;if(key==='drawer'){this.instance.position.set(-670,930,1240);this.instance.lookAt(-650,-60,350);this.instance.updateMatrixWorld();}}};
app.camera.instance.position.set(-150,800,2050);app.camera.instance.lookAt(-150,160,-100);app.camera.instance.updateMatrixWorld();
const handlers=new Map();
class Element {
 constructor(tag){this.tag=tag;this.style={};this.children=[];this.listeners={};this.attributes={};this.hidden=false;this.keyboardFocus=true;}
 setAttribute(key,value){this.attributes[key]=value;}
 append(...children){children.forEach(c=>{this.children.push(c);c.parent=this;});}
 appendChild(child){this.append(child);}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name,event={}){(this.listeners[name]||[]).forEach(fn=>fn(event));}
 contains(node){for(let p=node;p;p=p.parent)if(p===this)return true;return false;}
 matches(){return this.keyboardFocus;}
 closest(){for(let p=this;p;p=p.parent)if(['drawer-controls','cubing-records'].includes(p.id))return p;return null;}
 getBoundingClientRect(){return {width:252,height:180,left:0,top:0};}
 focus(){const old=document.activeElement;document.activeElement=this;old?.fire('blur',{relatedTarget:this});this.fire('focus');}
}
global.document={createElement:tag=>new Element(tag),body:new Element('body'),addEventListener(name,fn,capture=false){const a=handlers.get(name)||[];a.push({fn,capture});handlers.set(name,a);}};
document.activeElement=document.body;
function dispatch(name,event){event.preventDefault??=function(){this.prevented=true;};event.stopImmediatePropagation??=function(){this.stopped=true;};for(const h of [...(handlers.get(name)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){h.fn(event);if(event.stopped)break;}}
const cache=new Map();
function load(relative){
 const filename=path.join(root,relative);if(cache.has(filename))return cache.get(filename);
 const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;
 mod.require=name=>{
  if(name.includes('CSS3DRenderer'))return {CSS3DObject:class{}};
  if(name==='../Application')return {default:class{constructor(){return app;}}};
  if(name==='../Camera/Camera')return {CameraKey:{IDLE:'idle',DESK:'desk',DRAWER:'drawer',MONITOR:'monitor'}};
  if(name==='./SceneLayout')return {HENRY_DESK};
  // Browser QA covers the real walnut finish; this fixture exercises geometry/input.
  if(name==='./DeskFinish')return {deskMaterials:()=>({woodFlat:new THREE.MeshBasicMaterial(),brassFlat:new THREE.MeshBasicMaterial()}),planarUV:()=>{}};
  if(name==='../UI/EventBus')return {default:{dispatch(name,value){viewEvents.push({name,value});}}};
  if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts')));
  return require(name);
 };
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText,filename);cache.set(filename,mod.exports);return mod.exports;
}
function mesh(positions,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));g.setIndex(indices);return new THREE.Mesh(g,new THREE.MeshBasicMaterial());}
function model(size){
 const gl=readGltf(path.join(root,`static/models/Props/cube-${size}x${size}.glb`)),scene=new THREE.Group();
 assert.equal(gl.primitives().length,1);assert(gl.json.meshes[0].primitives[0].attributes.COLOR_0!==undefined,'original sticker colours missing');
 assert(!JSON.stringify(gl.json.nodes).includes('Scrambled'));
 for(const{prim,world}of gl.primitives())scene.add(mesh(gl.readAccessor(prim.attributes.POSITION).map(p=>transformPoint(world,p)),gl.readAccessor(prim.indices)));
 return {scene};
}
app.resources={on(name,callback){backgroundHandlers[name]=callback;},ensureBackground(){return Promise.resolve();},items:{gltfModel:{cube2Model:model(2),cube3Model:model(3),cube4Model:model(4)}}};
const gl=readGltf(path.join(root,'static/models/World/environment.glb')),prim=gl.primitives().find(p=>p.node==='desk').prim;
const desk=mesh(gl.readAccessor(prim.attributes.POSITION),gl.readAccessor(prim.indices));desk.scale.setScalar(scale);desk.position.copy(HENRY_DESK.position);app.scene.add(desk);
const Drawer=load('src/Application/World/CubingDrawer.ts').default,drawer=new Drawer(desk);
assert.equal(drawer.contents.getObjectByName('Solved2x2'),undefined,'closed drawer contents must not be built on the critical path');
app.world.lighting={applyEnvironmentIntensity(){}};
backgroundHandlers.backgroundReady();
const contents=['Solved2x2','Solved3x3','Solved4x4','OriginalCubingTimer'].map(name=>drawer.contents.getObjectByName(name));
assert(contents.every(Boolean));assert(!drawer.contents.getObjectByName('XboxController'),'removed controller is still in the scene');assert.equal(drawer.contents.getObjectByName('TwoFittedBottleCompartments'),undefined);
assert.equal(drawer.open,false);assert.equal(drawer.progress,0);assert.equal(drawer.contents.visible,false);
app.scene.updateMatrixWorld(true);const closed=contents.map(o=>new THREE.Box3().setFromObject(o));
const top=-.68804*scale+HENRY_DESK.position.y,bottom=-1.1929*scale+HENRY_DESK.position.y;
const timerSize=closed[3].getSize(new THREE.Vector3());
let timerTriangles=0,timerDraws=0;
drawer.timer.traverse(o=>{if(o instanceof THREE.Mesh){timerTriangles+=(o.geometry.index?.count||o.geometry.getAttribute('position').count)/3;timerDraws++;}});
assert(timerSize.x>260&&timerSize.x<285&&timerSize.z>80&&timerSize.z<100&&timerSize.y<34,'timer dimensions are not handheld scale');
assert(timerTriangles<8000&&timerDraws<=8,'timer exceeded its geometry/material budget');
console.log(`Original timer: ${timerSize.x.toFixed(1)} x ${timerSize.z.toFixed(1)} x ${timerSize.y.toFixed(1)} mm; ${timerTriangles} triangles / ${timerDraws} material meshes`);
closed.forEach((b,i)=>{assert(b.max.y<top-8,'prop hits cabinet');assert(Math.abs(b.min.y-(bottom+18+2.7))<.05,'prop floats above the plain liner');for(const other of closed.slice(i+1))assert(!b.intersectsBox(other),'props overlap');});
const front=new THREE.Vector3((-3.45813-1.76203)/2*scale,-.95*scale+HENRY_DESK.position.y,1.60541*scale+HENRY_DESK.position.z);
function eventAt(point){const p=point.clone().project(app.camera.instance);return {button:0,clientX:(p.x+1)*640,clientY:(1-p.y)*360,target:document.body};}
const click={...eventAt(front),isTrusted:true,type:'mousedown'};dispatch('mousemove',click);assert.equal(document.body.style.cursor,'pointer');dispatch('mousedown',click);assert(drawer.open&&click.stopped);assert.equal(transitions.at(-1),'drawer');
assert.equal(viewEvents.filter(e=>e.name==='sceneSound'&&e.value.cue==='drawer-open').length,1,'trusted handle must emit one open sound');
const lower=eventAt(front.clone().add(new THREE.Vector3(0,-150,0)));dispatch('mousedown',lower);assert(!lower.stopped,'lower drawer must remain fixed');
for(let i=0;i<45;i++)drawer.update();app.scene.updateMatrixWorld(true);
assert.equal(drawer.progress,1);assert.equal(drawer.moving.position.z,drawer.travel);
const ray=new THREE.Raycaster();
contents.forEach((o,i)=>{
 const b=new THREE.Box3().setFromObject(o);assert(Math.abs(b.min.z-closed[i].min.z-drawer.travel)<.001,'prop did not move with drawer');
 const target=b.getCenter(new THREE.Vector3());target.y=b.max.y-.4;target.x+=(b.max.x-b.min.x)*.15;target.z-=(b.max.z-b.min.z)*.15;ray.set(app.camera.instance.position,target.clone().sub(app.camera.instance.position).normalize());
 const hit=ray.intersectObjects(app.scene.children,true).find(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});
 let own=false;for(let p=hit?.object;p;p=p.parent)if(p===o)own=true;assert(own,`${o.name} top blocked by ${hit?.object.name||hit?.object.type}`);
 console.log(`${o.name}: ${(top-b.max.y).toFixed(1)} mm vertical clearance; top visible from preserved drawer focus`);
});
async function run(){
 const panel=drawer.recordsPanel,timerBounds=new THREE.Box3().setFromObject(drawer.timer),point=timerBounds.getCenter(new THREE.Vector3());point.y=timerBounds.max.y-.4;
 dispatch('mousemove',eventAt(point));assert.equal(panel.element.hidden,false,'timer hover must show records');
 const format=panel.element.children[0].children[1];assert.equal(format.textContent,'Ao5');assert.equal(format.tabIndex,0);assert.equal(format.attributes['aria-describedby'],'cubing-average-help');assert.equal(format.children[0].attributes.role,'tooltip');assert.equal(format.children[0].textContent,'Average of 5');
 const records=panel.element.children[1].children.map(e=>e.textContent);assert.deepEqual(records,['2\u00d72','13.62 s','3\u00d73','33.59 s','4\u00d74','2:41.31']);
 dispatch('mousemove',{clientX:0,clientY:0,target:document.body});await new Promise(r=>setTimeout(r,180));assert(panel.element.hidden,'leaving must dismiss hover panel');
 dispatch('mousemove',eventAt(point));const escape={key:'Escape'};dispatch('keydown',escape);assert(panel.element.hidden&&drawer.open&&escape.stopped,'Escape must dismiss records before closing drawer');
 drawer.update();assert(panel.element.hidden,'dismissed hover must stay dismissed');
 drawer.recordsButton.focus();assert(!panel.element.hidden,'keyboard focus must reveal records');
 dispatch('mousemove',{clientX:0,clientY:0,target:document.body});await new Promise(r=>setTimeout(r,180));assert(!panel.element.hidden,'keyboard focus must retain panel');
 document.body.focus();await new Promise(r=>setTimeout(r,180));assert(panel.element.hidden,'focus leaving must dismiss panel');
 const timerClick=eventAt(point);dispatch('mousedown',timerClick);assert(!panel.element.hidden&&timerClick.stopped,'timer click/touch compatibility must show records');
 dispatch('pointerdown',{button:0,clientX:0,clientY:0,target:document.body});assert(panel.element.hidden,'outside click must dismiss panel');
 drawer.recordsButton.fire('click');assert(!panel.element.hidden,'touch/click records control failed');
 panel.position(650,430,1280,720,{left:420,right:800,top:300});
 assert(Number.parseFloat(panel.element.style.left)>=818,'records obscure drawer contents');
 assert.equal(panel.element.attributes['data-side'],'right');
 panel.position(195,430,390,844,{left:5,right:385,top:400});
 assert.equal(panel.element.attributes['data-side'],'above');
 assert(Number.parseFloat(panel.element.style.top)+180<400,'narrow viewport popup obscures contents');
 panel.element.children[0].children[2].fire('click');assert(panel.element.hidden,'dismiss control failed');
 drawer.viewButton.fire('click');assert(drawer.open&&drawer.recordsButton.disabled,'desk view must leave drawer open and disable its distant records control');
 assert.equal(transitions.at(-1),'desk');assert(panel.element.hidden);assert.deepEqual(viewEvents.at(-1),{name:'drawerFocusChange',value:false});
 drawer.viewButton.fire('click');assert(drawer.open&&!drawer.recordsButton.disabled);assert.equal(transitions.at(-1),'drawer');assert.deepEqual(viewEvents.at(-1),{name:'drawerFocusChange',value:true});
 assert.equal(viewEvents.filter(e=>e.name==='sceneSound').length,1,'records and camera-only controls must stay silent');
 const close={...eventAt(front.clone().add(new THREE.Vector3(0,0,drawer.travel))),isTrusted:true,type:'mousedown'};dispatch('mousedown',close);assert(!drawer.open&&close.stopped);assert.equal(transitions.at(-1),'desk');
 assert.equal(viewEvents.filter(e=>e.name==='sceneSound'&&e.value.cue==='drawer-close').length,1,'trusted handle must emit one close sound');
 for(let i=0;i<45;i++)drawer.update();app.scene.updateMatrixWorld(true);assert.equal(drawer.progress,0);assert.equal(drawer.contents.visible,false);assert(panel.element.hidden);
 contents.forEach((o,i)=>assert(new THREE.Box3().setFromObject(o).min.distanceTo(closed[i].min)<.001,'closed position drift'));
 drawer.setOpen(true);for(let i=0;i<10;i++)drawer.update();const partial=drawer.moving.position.z;drawer.setOpen(false);drawer.update();assert(drawer.moving.position.z>0&&drawer.moving.position.z<partial,'reversing should not snap');
 assert.equal(viewEvents.filter(e=>e.name==='sceneSound').length,2,'programmatic drawer movement must stay silent');
 drawer.setOpen(true,click);drawer.setOpen(true,click);
 drawer.controls.children[2].fire('click',{isTrusted:true,type:'click'});
 assert.equal(viewEvents.filter(e=>e.name==='sceneSound').length,4,'close control must sound once; unchanged state must stay silent');
 drawer.setOpen(true);dispatch('keydown',{key:'Escape',isTrusted:true,type:'keydown'});
 assert.equal(viewEvents.filter(e=>e.name==='sceneSound').length,5,'Escape close must emit a physical drawer sound');
 // Exercise the real screen handler with the real animated drawer and
 // capture/bubble ordering, through desktop use and both return controls.
 app.mouse={trigger(){}};app.world.deskAndChair.drawer=drawer;
 app.camera.trigger=name=>app.camera.transition(name==='enterMonitor'?'monitor':'desk');
 const Screen=load('src/Application/World/MonitorScreen.ts').default,screen=Object.create(Screen.prototype);
 screen.application=app;screen.camera=app.camera;screen.monitorActive=false;
 screen.initializeScreenEvents();screen.initializeExitControls();
 const inside={inComputer:true,target:{id:'computer-screen',closest(){return null;}}};
 for (const exit of ['Escape','requestLeaveMonitor']) {
    drawer.setOpen(true);for(let i=0;i<45;i++)drawer.update();
    drawer.recordsButton.fire('click');assert(!panel.element.hidden);
    const from=transitions.length;
    dispatch('mousedown',{...inside});dispatch('mouseup',{...inside});
    assert.deepEqual(transitions.slice(from),['monitor'],'handoff must never start a desk tween');
    assert(screen.monitorActive&&!drawer.open&&panel.element.hidden);
    const moving=drawer.moving.position.z;drawer.update();
    assert(drawer.moving.position.z>0&&drawer.moving.position.z<moving,'laptop entry must close smoothly');
    for(let i=0;i<45;i++)drawer.update();assert.equal(drawer.progress,0);assert(!drawer.contents.visible&&drawer.controls.hidden);
    dispatch('mousedown',{...inside});dispatch('mouseup',{...inside});assert.equal(transitions.length,from+1,'desktop use re-entered');
    if(exit==='Escape')dispatch('keydown',{key:'Escape'});else dispatch(exit,{});
    assert(!screen.monitorActive&&app.camera.currentKeyframe==='desk');
    drawer.update();assert.equal(drawer.progress,0);
 }
 console.log('PASS: real desk → drawer → laptop → desktop → desk handoff; animated closure, no intermediate desk tween; Escape and Back both return with drawer closed');
 panel.show('click');format.keyboardFocus=false;format.focus();panel.setHovered(false);panel.element.fire('pointerleave');await new Promise(r=>setTimeout(r,180));assert(!panel.element.hidden,'Ao5 pointer/touch focus must retain the help panel');
 document.body.focus();panel.element.fire('focusout',{relatedTarget:document.body});await new Promise(r=>setTimeout(r,180));assert(panel.element.hidden,'leaving Ao5 focus must dismiss the panel');
 // An early request never exposes an empty drawer, and newer navigation wins.
 drawer.setOpen(false);app.camera.currentKeyframe='desk';
 for (const outcome of ['open','cancel','laptop']) {
    drawer.contentsReady=false;let finish;
    app.resources.ensureBackground=()=>new Promise(resolve=>{finish=resolve;});
    drawer.setOpen(true);assert(!drawer.open&&drawer.pendingOpen);
    drawer.update();assert(drawer.recordsButton.disabled);
    if(outcome==='cancel')drawer.setOpen(false);
    if(outcome==='laptop')app.camera.currentKeyframe='monitor';
    drawer.contentsReady=true;finish();await Promise.resolve();await Promise.resolve();
    assert.equal(drawer.open,outcome==='open','pending request ignored cancellation or camera context');
    drawer.setOpen(false,undefined,false);app.camera.currentKeyframe='desk';
 }
 console.log('PASS: early drawer loading, disabled records, cancellation and laptop superseding a pending open');
 console.log('PASS: solved cube colours/fit, grounded original timer, default closure, top-only click, focus, movement, hover/focus/click records, dismissal, return without drift, trusted physical drawer cues and silent camera/records/programmatic actions');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
