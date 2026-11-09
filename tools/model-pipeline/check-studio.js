/** Geometry/frustum checks for the actual studio sweep and Free Camera limits. */
const assert = require('assert'), fs = require('fs'), path = require('path'), Module = require('module');
const ts = require('typescript'), THREE = require('three');
const root = path.resolve(__dirname, '../..'), cache = new Map();
let application;
function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = name => {
        if (name === 'three' && filename.endsWith('WallPosters.ts')) return { ...THREE, TextureLoader: class {
            load(_url, complete) { complete(new THREE.Texture({ width: 736, height: 1041 })); }
        } };
        if (name === 'three') return THREE;
        if (name === '../Application') return { default: class { constructor() { return application; } } };
        if (name === '../Utils/EventEmitter') return { default: class {} };
        if (name === './CameraKeyframes' || name === 'three/examples/jsm/controls/OrbitControls') return {};
        if (name.startsWith('.')) {
            const target = path.resolve(path.dirname(filename), name + '.ts');
            if (fs.existsSync(target)) return load(path.relative(root, target));
        }
        return require(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 } }).outputText, filename);
    cache.set(filename, mod.exports); return mod.exports;
}
const { STUDIO, createStudioSweep, studioCoveAt, createStudioBaseboard } = load('src/Application/World/StudioEnvironment.ts');
const { CAMERA, FLOOR_Y, WALL_Z, HENRY_DESK, CHAIR } = load('src/Application/World/SceneLayout.ts');
const Camera = load('src/Application/Camera/Camera.ts').default;
const sweep = createStudioSweep(), geometry = sweep.geometry;
assert(sweep.receiveShadow && !sweep.castShadow);
assert(!sweep.material.map && !sweep.material.bumpMap, 'studio must not add grain/texture maps');
assert.equal(sweep.material.side, THREE.FrontSide);
assert(geometry.index.count / 3 < 9000 && geometry.getAttribute('position').count < 4500, 'studio geometry budget exceeded');
const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), colors = geometry.getAttribute('color');
const columns = STUDIO.acrossSegments + 1, rows = positions.count / columns;
for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const index = row * columns + column;
    const n = new THREE.Vector3().fromBufferAttribute(normals, index);
    assert(Math.abs(n.length() - 1) < 1e-6);
    if (row) assert(n.angleTo(new THREE.Vector3().fromBufferAttribute(normals, index - columns)) <= Math.PI / 2 / STUDIO.curveSegments + .00001, 'hard normal discontinuity along cove');
    if (column) assert(n.angleTo(new THREE.Vector3().fromBufferAttribute(normals, index - 1)) < .15, 'hard normal discontinuity across cove');
    assert(positions.getY(index) >= FLOOR_Y);
    for (const value of [colors.getX(index),colors.getY(index),colors.getZ(index)]) assert(value >= .085 && value <= .53, 'surface palette outside the restrained sage/charcoal range');
    assert(Math.abs(colors.getX(index)-colors.getZ(index)) < .15, 'material variation has become over-saturated');
}
const board = createStudioBaseboard(); board.updateMatrixWorld(true);
const boardBounds = new THREE.Box3().setFromObject(board);
assert(Math.abs(boardBounds.min.y - FLOOR_Y) < .01 && boardBounds.max.y < FLOOR_Y + 100, 'baseboard is not grounded at realistic height');
assert(boardBounds.min.z > WALL_Z && boardBounds.max.z < WALL_Z + 18, 'baseboard is detached or unrealistically thick');
assert(WALL_Z + STUDIO.radius < boardBounds.max.z, 'floor fillet hides the baseboard');
assert(board.material.roughness > .9 && board.geometry.index.count / 3 <= 12 && !board.material.map, 'baseboard exceeds simple matte geometry budget');
const boardHits=[];board.raycast(new THREE.Raycaster(),boardHits);assert.equal(boardHits.length,0);
const clearance = HENRY_DESK.top.minZ - WALL_Z;
assert(clearance >= 50 && clearance <= 100, 'desktop must stay 5–10 cm from the wall');
// Check source desk vertices and triangle centres/edges, not a guessed tabletop
// box: the floor curve must clear the actual rear feet and cabinet too.
const { readGltf } = require('./lib/gltf');
const sourceDesk = readGltf(path.join(root, 'static/models/World/environment.glb'));
const deskPrimitive = sourceDesk.primitives().find(p => p.node === 'desk').prim;
const sourcePoints = sourceDesk.readAccessor(deskPrimitive.attributes.POSITION);
const deskPoints = sourcePoints.map(p => new THREE.Vector3(...p).multiplyScalar(HENRY_DESK.scale).add(HENRY_DESK.position));
const deskIndices = sourceDesk.readAccessor(deskPrimitive.indices).flat();
let minimumClearance = Infinity, testedDeskPoints = 0;
function checkDesk(point) {
    const { radius } = studioCoveAt(point.x);
    assert(radius === STUDIO.deskRadius, 'furniture must stay within the compact, flat-width sweep');
    const height = point.y - FLOOR_Y;
    assert(height >= 0, 'desk below floor');
    const wallZ = height >= radius ? WALL_Z : WALL_Z + radius * (1 - Math.sqrt(1 - (1 - height / radius) ** 2));
    const gap = point.z - wallZ;
    minimumClearance = Math.min(minimumClearance, gap);
    assert(gap > 20, 'desk or rear foot intersects the backdrop/cove'); testedDeskPoints++;
}
deskPoints.forEach(checkDesk);
for (let i = 0; i < deskIndices.length; i += 3) {
    const [a,b,c] = deskIndices.slice(i,i+3).map(index => deskPoints[index]);
    checkDesk(a.clone().add(b).add(c).divideScalar(3));
    for (const [p,q] of [[a,b],[b,c],[c,a]]) checkDesk(p.clone().add(q).multiplyScalar(.5));
}
const { POSTERS } = load('src/Application/World/PosterLayout.ts');
assert(FLOOR_Y + STUDIO.radius < Math.min(...POSTERS.map(p => p.bottom)) - 100, 'bottom poster does not have a flat vertical mounting surface');
assert.deepEqual(POSTERS.slice(0,3).map(p => p.id), ['f40','porsche-911','m3-e30'], 'current car poster arrangement was replaced');
assert.deepEqual(POSTERS.map(p=>p.id),['f40','porsche-911','m3-e30','star-destroyer','blue-orchid','tsubaki','gos-game','resident-evil-4'], 'latest poster arrangement changed');
global.document = { createElement() { return { getContext() { return { drawImage() {}, getImageData() { return {data:[230,230,230,255]}; } }; } }; } };
const { default: posters } = load('src/Application/World/WallPosters.ts');
const posterGroup = posters();
for (const def of POSTERS) {
    const sheet = posterGroup.getObjectByName(`Poster ${def.id}: paper`);
    assert(sheet && sheet.position.x === def.x && sheet.position.y === def.bottom + def.paper.height/2, 'authored poster layout changed');
}
posterGroup.children.forEach(p => {
    assert(p.position.z > WALL_Z && p.position.z < WALL_Z + 5, 'poster floats away from studio display plane');
    if (p.name.endsWith(': print')) assert(p.material.polygonOffset && p.material.polygonOffsetUnits < 0, 'thin poster print risks z-fighting at studio distances');
});
const inertHits = []; sweep.raycast(new THREE.Raycaster(), inertHits); assert.equal(inertHits.length, 0, 'scenery must not intercept object interactions');
sweep.raycast = THREE.Mesh.prototype.raycast; sweep.updateMatrixWorld(true);
const raycaster = new THREE.Raycaster(); let rays = 0;
function coverage(position, target, aspect, label) {
    const camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
    camera.position.copy(position); camera.lookAt(target); camera.updateMatrixWorld();
    for (let row = 0; row <= 8; row++) for (let column = 0; column <= 12; column++) {
        raycaster.setFromCamera(new THREE.Vector2(column / 6 - 1, row / 4 - 1), camera);
        raycaster.near = camera.near; raycaster.far = camera.far;
        assert(raycaster.intersectObject(sweep).length > 0, `exposed studio edge/void: ${label}, aspect ${aspect}, sample ${column},${row}`); rays++;
    }
}
for (const aspect of [16/9, 21/9, 32/9, 4/3, 390/844]) {
    const rig = Object.create(Camera.prototype);
    rig.instance = new THREE.PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far); rig.orbitControls = {};
    rig.updateOrbitLimits();
    const limit = rig.orbitControls.maxAzimuthAngle;
    assert(limit > .5 && limit <= CAMERA.orbit.maxAzimuth && rig.orbitControls.minAzimuthAngle === -limit);
    const horizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(CAMERA.fov/2))*aspect);
    assert(limit + horizontal <= THREE.MathUtils.degToRad(80) + 1e-8);
    for (const radius of [CAMERA.orbit.minDistance, CAMERA.orbit.maxDistance]) {
        for (const azimuth of [-limit, 0, limit]) for (const polar of [.03, Math.PI/4, Math.PI/2]) {
            const point = new THREE.Vector3().setFromSphericalCoords(radius, polar, azimuth).add(CAMERA.orbitStart.focalPoint);
            coverage(point, CAMERA.orbitStart.focalPoint, aspect, 'free camera');
        }
    }
    const dolly = Math.max(1, Math.min(CAMERA.desk.maxDolly, CAMERA.desk.referenceAspect/aspect));
    coverage(CAMERA.desk.position.clone().sub(CAMERA.desk.focalPoint).multiplyScalar(dolly).add(CAMERA.desk.focalPoint), CAMERA.desk.focalPoint, aspect, 'desk');
    const drawerDolly = Math.max(1, 1.35/aspect);
    coverage(CAMERA.drawer.position.clone().sub(CAMERA.drawer.focalPoint).multiplyScalar(drawerDolly).add(CAMERA.drawer.focalPoint), CAMERA.drawer.focalPoint, aspect, 'drawer');
    CAMERA.intro.path.forEach(view => coverage(view.position, view.focalPoint, aspect, 'intro'));
    for (const angle of [-CAMERA.idle.sweep, 0, CAMERA.idle.sweep]) {
        const point = new THREE.Vector3(Math.sin(angle)*CAMERA.idle.radius, CAMERA.idle.height, Math.cos(angle)*CAMERA.idle.radius).add(CAMERA.idle.focalPoint);
        coverage(point, CAMERA.idle.focalPoint, aspect, 'idle');
    }
}
// The actual resize handler must update the orbit limits, not just projection.
const resized = Object.create(Camera.prototype);
resized.instance = new THREE.PerspectiveCamera(CAMERA.fov, 390/844, CAMERA.near, CAMERA.far);
let orbitUpdates = 0;
resized.orbitControls = { update() { orbitUpdates++; } };
resized.updateOrbitLimits(); const portraitLimit = resized.orbitControls.maxAzimuthAngle;
resized.sizes = { width: 2560, height: 1080 }; resized.freeCam = true; resized.resize();
assert(resized.orbitControls.maxAzimuthAngle < portraitLimit && orbitUpdates === 1, 'resize did not constrain the active wide view');

// Exercise the actual contact alpha maps, including the former invisible-alphaMap bug.
let image;
global.document = { createElement() { return { getContext() { return {
    createImageData(width, height) { return { data: new Uint8ClampedArray(width*height*4) }; },
    putImageData(value) { image = value; },
}; } }; } };
application = { scene: new THREE.Scene(), world: { laptop: { model: new THREE.Mesh(new THREE.BoxGeometry(300, 20, 220)) } } };
const ContactShadows = load('src/Application/World/ContactShadows.ts').default;
const contacts = new ContactShadows();
assert.equal(contacts.group.children.length, 4, 'only laptop and desk floor footprints expected');
assert(contacts.group.children.every(mesh => mesh.material.map && !mesh.material.alphaMap && !mesh.material.depthWrite));
assert(!contacts.group.getObjectByName('WallFloorOcclusion'), 'old wall/floor seam darkening remains');
contacts.group.updateMatrixWorld(true);
contacts.group.children.filter(mesh => mesh.position.y < 0).forEach(mesh => {
    const bounds = new THREE.Box3().setFromObject(mesh);
    assert(bounds.min.z >= WALL_Z + Math.max(studioCoveAt(bounds.min.x).radius, studioCoveAt(bounds.max.x).radius) - .01, 'contact quad crosses into cove and creates a hard seam');
});
const alpha = Array.from(image.data).filter((_, index) => index%4 === 3);
assert(Math.min(...alpha) === 0 && Math.max(...alpha) === 255, 'contact falloff is not transparent-to-opaque');
// Actual desk and chair ground geometry must produce one small instanced
// contact layer; no per-foot draw calls or additional image maps.
const floorDeskGeometry = new THREE.BufferGeometry();
floorDeskGeometry.setAttribute('position',new THREE.Float32BufferAttribute(deskPoints.flatMap(p=>p.toArray()),3));
floorDeskGeometry.setIndex(deskIndices);
const floorDesk = new THREE.Mesh(floorDeskGeometry,new THREE.MeshBasicMaterial());
const chair = new THREE.Group();chair.name='OfficeChair';
const chairSource=readGltf(path.join(root,'static/models/Props/chair.glb'));
const { transformPoint }=require('./lib/gltf');
for(const {prim,world} of chairSource.primitives()) {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(chairSource.readAccessor(prim.attributes.POSITION).flatMap(p=>transformPoint(world,p)),3));
    chair.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial()));
}
chair.position.copy(CHAIR.position);chair.rotation.y=CHAIR.rotationY;
application={scene:new THREE.Scene(),world:{deskAndChair:{group:floorDesk}}};application.scene.add(floorDesk,chair);
const grounded=new ContactShadows(),feet=grounded.group.getObjectByName('FloorFootContacts');
assert(feet instanceof THREE.InstancedMesh && feet.count>=5 && feet.count<=20,'actual furniture contacts were lost or exceeded the one-draw budget');
assert(feet.material.map && !feet.material.depthWrite && feet.material.opacity<.3);
for(let i=0;i<feet.count;i++) {
    const m=new THREE.Matrix4();feet.getMatrixAt(i,m);
    const p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();m.decompose(p,q,scale);
    assert(Math.abs(p.y-(FLOOR_Y+1.2))<.01,'contact shadow floats');
    assert(p.z-scale.y/2>=WALL_Z+STUDIO.radius-.1,'foot contact intersects backdrop fillet');
}
delete global.document;
console.log(`PASS: visible alpha-based contact footprints, no seam band; one ${geometry.index.count/3}-triangle sweep, tangent-continuous normals, ${clearance.toFixed(1)} mm desk/wall gap; ${testedDeskPoints} desk samples clear cove by at least ${minimumClearance.toFixed(1)} mm; ${feet.count} batched foot/caster contacts, grounded matte baseboard, mounted posters, restrained tint and ${rays} covered frustum rays across normal/intro/drawer/free views and five viewport ratios`);
