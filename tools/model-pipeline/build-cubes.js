/** Extract only the three solved source nodes. No source topology is simplified. */
const fs=require('fs'),path=require('path');
const {readGltf,writeGlb,transformPoint,transformDirection}=require('./lib/gltf');
const root=path.resolve(__dirname,'../..');
const source=readGltf(path.join(root,'assets-source/rubiks_cubes_solved_and_unsolved/scene.gltf'));
for(const [size,mm] of [[2,50],[3,56],[4,60]]) {
 const primitives=source.primitives().filter(p=>p.node.includes(`${size}x${size} Solved_`));
 if(primitives.length!==7)throw Error('Expected seven solved-cube material surfaces');
 const all=primitives.flatMap(({world,prim})=>source.readAccessor(prim.attributes.POSITION).map(p=>transformPoint(world,p)));
 const min=[0,1,2].map(k=>Math.min(...all.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...all.map(p=>p[k])));
 const factor=mm/(max[1]-min[1]),pivot=[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2];
 const mesh={name:`Solved${size}x${size}`,material:0,positions:[],normals:[],colors:[],indices:[]};
 for(const{prim,world}of primitives){
  const offset=mesh.positions.length;
  const positions=source.readAccessor(prim.attributes.POSITION).map(p=>transformPoint(world,p).map((v,k)=>(v-pivot[k])*factor));
  mesh.positions.push(...positions);
  mesh.normals.push(...source.readAccessor(prim.attributes.NORMAL).map(n=>transformDirection(world,n)));
  const color=source.json.materials[prim.material].pbrMetallicRoughness.baseColorFactor.slice(0,3);
  mesh.colors.push(...positions.map(()=>color));
  mesh.indices.push(...source.readAccessor(prim.indices).map(i=>i+offset));
 }
 const extras={...source.json.asset.extras,modifications:[`Selected solved ${size}x${size} only; source triangles retained. Uniform ${mm}mm edge, Y-up, grounded pivot. Seven material groups merged using original linear vertex colours; positions 0.02mm, normals int8. No textures.`]};
 writeGlb(path.join(root,`static/models/Props/cube-${size}x${size}.glb`),{asset:{version:'2.0',generator:'Portfolio solved-cube pipeline',extras},materials:[{name:'Original sticker colours',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.5}}],images:[],meshes:[mesh],rootName:`Solved${size}x${size}`,quantize:50});
 console.log(`${size}x${size}: ${mesh.indices.length/3} triangles, one draw call, ${mm}mm edge`);
}
