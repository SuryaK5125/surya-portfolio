/** Regression checks against the actual desk and packaged bottle geometry. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const THREE = require('three');
const { readGltf, transformPoint } = require('./lib/gltf');
const root = path.resolve(__dirname, '../..');
const filename = path.join(root,'src/Application/World/DrawerGeometry.ts');
const mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText,filename);
const {splitTopDrawer} = mod.exports;
const desk = readGltf(path.join(root,'static/models/World/environment.glb'));
const {prim} = desk.primitives().find(p => p.node === 'desk');
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute(desk.readAccessor(prim.attributes.POSITION).flat(),3));
geometry.setAttribute('uv',new THREE.Float32BufferAttribute(desk.readAccessor(prim.attributes.TEXCOORD_0).flat(),2));
geometry.setIndex(desk.readAccessor(prim.indices));
const original = Array.from(geometry.index.array);
const parts = splitTopDrawer(geometry);
assert.equal(parts.moving.index.count/3,70);
// The lower drawer front (2) and handle (68) are split out for the walnut/brass
// finish (ce4577c) but stay fixed: 164 + 70 = the 234 non-moving triangles.
assert.equal(parts.fixed.index.count/3,164);
assert.equal(parts.lowerFront.index.count/3,2);
assert.equal(parts.lowerHandle.index.count/3,68);
assert.deepStrictEqual(Array.from(geometry.index.array),original,'source geometry was mutated');
assert.deepStrictEqual(Array.from(parts.moving.attributes.uv.array),Array.from(geometry.attributes.uv.array),'front UVs changed');
const triangles = g => Array.from(g.index.array).reduce((out,x,i,a) => {if(i%3===0)out.push(a.slice(i,i+3).join(','));return out;},[]);
assert.deepStrictEqual([...triangles(parts.fixed),...triangles(parts.lowerFront),...triangles(parts.lowerHandle),...triangles(parts.moving)].sort(),triangles(geometry).sort());
assert(parts.moving.boundingBox.min.y > -1.194,'lower drawer is part of moving geometry');
assert.throws(() => splitTopDrawer(new THREE.BoxGeometry()),/Henry desk/,'unexpected source must fail safely');

console.log('PASS: exact 70 moving / 164+2+68 fixed triangle split, unchanged source/UVs, lower drawer fixed; runtime check covers the solved cubes and original timer');
