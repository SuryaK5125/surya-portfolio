/** Real camera/raycast regression: selecting an object from orbit is a click,
 * never a drag; focus releases orbit and returns to the normal navigation. */
const assert=require('assert'),fs=require('fs'),path=require('path'),Module=require('module');
const ts=require('typescript'),THREE=require('three'),TWEEN=require('@tweenjs/tween.js');
const root=path.resolve(__dirname,'../..'),filename=path.join(root,'src/Application/Camera/Camera.ts');
const events=[],listeners=new Map(),webgl={style:{pointerEvents:'auto'}},target={closest(){return null;}};
global.document={body:{style:{}},getElementById(){return webgl;},addEventListener(name,fn){const handlers=listeners.get(name)||[];handlers.push(fn);listeners.set(name,handlers);}};
function dispatch(name,event={}){event.target??=target;event.button??=0;event.preventDefault??=function(){this.prevented=true;};(listeners.get(name)||[]).forEach(fn=>fn(event));}
const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;
mod.require=name=>{
 if(name==='three')return THREE;
 if(name==='@tweenjs/tween.js')return {default:TWEEN};
 if(name==='bezier-easing')return {default:require(name)};
 if(name==='../Utils/EventEmitter'||name==='../Application')return {default:class{}};
 if(name==='three/examples/jsm/controls/OrbitControls'||name==='./CameraKeyframes')return {};
 if(name==='../World/SceneLayout')return {CAMERA:{}};
 if(name==='../UI/EventBus')return {default:{dispatch(name,value){events.push({name,value});}}};
 return require(name);
};
mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText,filename);
const Camera=mod.exports.default,keys=mod.exports.CameraKey;
function run(aspect){
 listeners.clear();events.length=0;
 const camera=Object.create(Camera.prototype),scene=new THREE.Scene();
 camera.scene=scene;camera.sizes={width:aspect*720,height:720};
 camera.instance=new THREE.PerspectiveCamera(35,aspect,5,120000);
 camera.position=new THREE.Vector3();camera.focalPoint=new THREE.Vector3();
 camera.interactionRay=new THREE.Raycaster();camera.interactionPointer=new THREE.Vector2();
 camera.orbitControls={enabled:true,target:new THREE.Vector3(0,0,0),update(){}};
 camera.keyframes={};
 for(const [key,position] of [[keys.DESK,[0,150,900]],[keys.DRAWER,[-150,280,500]],[keys.MONITOR,[120,60,300]],[keys.IDLE,[0,180,1000]],[keys.ORBIT_CONTROLS_START,[0,150,900]]])camera.keyframes[key]={position:new THREE.Vector3(...position),focalPoint:new THREE.Vector3(),update(){}};
 const internal=new Map();camera.on=(name,fn)=>internal.set(name,fn);camera.trigger=name=>internal.get(name)?.();
 const front=new THREE.Mesh(new THREE.BoxGeometry(90,70,10),new THREE.MeshBasicMaterial());front.position.set(-150,-50,80);scene.add(front);
 const timer=new THREE.Group();timer.position.set(-100,65,0);timer.add(new THREE.Mesh(new THREE.BoxGeometry(70,20,35),new THREE.MeshBasicMaterial()));scene.add(timer);
 const laptop=new THREE.Group();laptop.position.set(120,40,50);laptop.add(new THREE.Mesh(new THREE.BoxGeometry(120,90,12),new THREE.MeshBasicMaterial()));scene.add(laptop);
 const actions=[],drawer={front,timer,open:false,recordsPanel:{show(){actions.push('records');},hide(){}},setOpen(open,event,focus=true){actions.push({open,focus});this.open=open;if(focus)camera.transition(open?keys.DRAWER:keys.DESK);}};
 const screen={monitorActive:false,group:new THREE.Group()};
 camera.application={world:{laptop:{model:laptop},monitorScreen:screen,deskAndChair:{drawer}}};
 camera.setMonitorListeners();camera.setFreeCamPicking();camera.setTouchPicking();
 function free(open=false){TWEEN.removeAll();drawer.open=open;screen.monitorActive=false;camera.freeCam=true;camera.currentKeyframe=keys.ORBIT_CONTROLS_START;camera.targetKeyframe=undefined;camera.introPlaying=false;camera.orbitControls.enabled=true;camera.instance.position.set(0,150,900);camera.instance.lookAt(0,0,0);camera.instance.updateMatrixWorld(true);camera.position.copy(camera.instance.position);camera.focalPoint.set(0,0,0);webgl.style.pointerEvents='auto';actions.length=0;}
 function at(object){scene.updateMatrixWorld(true);camera.instance.updateMatrixWorld(true);const point=object.getWorldPosition(new THREE.Vector3()).project(camera.instance);return {clientX:(point.x+1)*camera.sizes.width/2,clientY:(1-point.y)*camera.sizes.height/2};}
 function click(object){const point=at(object);dispatch('pointerdown',{...point});dispatch('pointerup',{...point});dispatch('click',{...point});}
 function settle(ms){TWEEN.update(TWEEN.now()+ms+20);TWEEN.removeAll();camera.update();}
 free();click(front);
 assert(!camera.freeCam&&!camera.orbitControls.enabled&&drawer.open);assert.equal(webgl.style.pointerEvents,'none');assert.equal(camera.targetKeyframe,keys.DRAWER);
 assert(camera.position.equals(new THREE.Vector3(0,150,900)),'focus jumps before tween');settle(1000);assert.equal(camera.currentKeyframe,keys.DRAWER);
 assert(events.some(event=>event.name==='freeCamFocus'),'Free Camera control did not receive its reset event');
 free(true);click(front);assert(!drawer.open&&camera.targetKeyframe===keys.DESK);settle(1000);
 free(true);click(laptop);assert(!drawer.open&&screen.monitorActive&&!camera.freeCam);assert.deepEqual(actions,[{open:false,focus:false}]);assert.equal(camera.targetKeyframe,keys.MONITOR);settle(2000);
 camera.trigger('leftMonitor');settle(1000);assert.equal(camera.currentKeyframe,keys.DESK);assert(!drawer.open);
 free(true);click(timer);assert.deepEqual(actions,[{open:true,focus:true},'records']);assert.equal(camera.targetKeyframe,keys.DRAWER);settle(1000);
 for(const object of [front,laptop]){
   free();const point=at(object);dispatch('pointerdown',{...point});dispatch('pointermove',{...point,clientX:point.clientX+30});dispatch('pointermove',{...point});dispatch('pointerup',{...point});dispatch('click',{...point});
   assert(camera.freeCam&&camera.orbitControls.enabled&&!actions.length,'orbit drag selected an object');
 }
 free();let point=at(laptop);dispatch('pointerdown',{...point});dispatch('pointercancel',{});dispatch('click',{...point});assert(camera.freeCam);
 free();point=at(laptop);dispatch('pointerdown',{...point});dispatch('pointerdown',{...point,isPrimary:false});dispatch('click',{...point});assert(camera.freeCam,'multi-touch selected the laptop');
 free();point=at(laptop);dispatch('pointerdown',{...point,button:2});dispatch('click',{...point,button:2});assert(camera.freeCam);
 free();point=at(laptop);const overlay={closest(){return {};}};dispatch('pointerdown',{...point,target:overlay});dispatch('click',{...point,target:overlay});assert(camera.freeCam,'overlay click leaked into scene');
 // A real foreground mesh must occlude selection; hidden parents must not.
 const blocker=new THREE.Group(),block=new THREE.Mesh(new THREE.BoxGeometry(200,150,20),new THREE.MeshBasicMaterial());blocker.add(block);blocker.position.set(100,40,180);scene.add(blocker);
 free();click(laptop);assert(camera.freeCam&&!actions.length,'selection passed through foreground geometry');
 blocker.visible=false;click(laptop);assert(!camera.freeCam&&camera.targetKeyframe===keys.MONITOR,'hidden geometry blocked laptop selection');settle(2000);
 scene.remove(blocker);
 // Normal scene touch uses release coordinates and rejects drag/pinch/cancel.
 function touch(object,kind='tap') {
   const p=at(object),event={...p,pointerType:'touch',pointerId:1,isPrimary:true};
   dispatch('pointerdown',{...event});
   assert(!actions.length,'touch activated on pointerdown');
   if(kind==='drag') {dispatch('pointermove',{...event,clientX:p.clientX+25});dispatch('pointermove',{...event});}
   if(kind==='pinch') dispatch('pointerdown',{...event,pointerId:2,isPrimary:false});
   if(kind==='cancel') dispatch('pointercancel',{...event});
   dispatch('pointerup',{...event});
 }
 for(const kind of ['drag','pinch','cancel']) {
   free();camera.freeCam=false;camera.currentKeyframe=keys.DESK;
   touch(laptop,kind);assert(!actions.length&&!screen.monitorActive,'touch gesture selected laptop');
 }
 free();camera.freeCam=false;camera.currentKeyframe=keys.DESK;
 touch(front);assert(drawer.open&&camera.targetKeyframe===keys.DRAWER);settle(1000);
 actions.length=0;touch(laptop);assert(!drawer.open&&screen.monitorActive&&camera.targetKeyframe===keys.MONITOR);
 assert.deepEqual(actions,[{open:false,focus:false}],'touch laptop handoff competed with drawer camera');settle(2000);
 camera.trigger('leftMonitor');settle(1000);assert.equal(camera.currentKeyframe,keys.DESK);
 // State handoff uses the actual live orbit pose, even when the last frame's
 // interpolated position differs, and resize keeps the same picking mapping.
 free();camera.position.set(0,0,0);click(front);assert(camera.position.equals(camera.instance.position));settle(1000);
 free();camera.freeCam=false;camera.targetKeyframe=keys.ORBIT_CONTROLS_START;camera.focalPoint.set(9,8,7);
 const enteringFocus=camera.focalPoint.clone();camera.leaveFreeCamForFocus();
 assert(camera.focalPoint.equals(enteringFocus)&&!camera.orbitControls.enabled,'cancelling orbit entry jumped to the orbit target');
}
for(const aspect of [16/9,390/844])run(aspect);
TWEEN.removeAll();delete global.document;
console.log('PASS: real Free Camera rays select drawer, laptop and timer; smooth focus/UI reset and desk return; drags, multi-touch, cancellation, overlays, right-click and occlusion respected at desktop/mobile ratios; normal touch taps activate on release and preserve drawer-to-laptop navigation');
