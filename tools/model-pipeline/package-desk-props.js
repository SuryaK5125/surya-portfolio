/** Compact Blender GLBs, keeping source credits, UVs and per-material groups.
 * Run resize-prop-textures.py first. Positions: 0.02 mm; normals: int8. */
const fs = require('fs');
const path = require('path');
const { readGltf, writeGlb, transformPoint, transformDirection } = require('./lib/gltf');
const root = path.resolve(__dirname, '../..');
const reportPath = path.join(root,'assets-source/scene-update-build/packed-report.json');
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath,'utf8')) : {};
for (const name of (process.argv[2] ? process.argv[2].split(',') : ['cartier', 'tom-ford', 'headphones', 'cherry-tree'])) {
    const file = path.join(root, `static/models/Props/${name}.glb`);
    const source = readGltf(file);
    const dir = path.join(root, `assets-source/scene-update-build/${name}/packed`);
    const imageReport = JSON.parse(fs.readFileSync(path.join(dir, 'images.json'), 'utf8'));
    const meshes = source.primitives().map(({node, world, prim}) => ({
        name: node, material: prim.material,
        positions: source.readAccessor(prim.attributes.POSITION).map(p => transformPoint(world, p)),
        normals: source.readAccessor(prim.attributes.NORMAL).map(n => transformDirection(world, n)),
        uvs: prim.attributes.TEXCOORD_0 == null ? undefined : source.readAccessor(prim.attributes.TEXCOORD_0),
        indices: source.readAccessor(prim.indices),
    }));
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    meshes.forEach(m => m.positions.forEach(p => p.forEach((v,k) => {min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);} )));
    const expectedHeight = {cartier:120,'tom-ford':105,headphones:300,'cherry-tree':330}[name];
    if (Math.abs(min[1]) > .1 || Math.abs(max[1]-min[1]-expectedHeight) > .5) throw Error(`${name}: invalid grounded height ${min} ${max}`);
    const materials = source.json.materials.map(m => { const material = {...m}; delete material.extensions; return material; });
    // Alpha-tested petals avoid transparent sorting artifacts in three.js.
    materials.filter(m => /CherryFlower$/.test(m.name)).forEach(m => {m.alphaMode='MASK';m.alphaCutoff=.45;});
    const extras = source.json.asset.extras || {};
    extras.modifications = [
        'Reoriented to Y-up millimetres, grounded pivot; joined by material; positions quantized to 0.02 mm and normals to int8.',
        {
            cartier: 'Ribbed cap geometry and split normals retained; other surfaces simplified; dark glass made opaque; colour texture 1024px; height 120mm.',
            'tom-ford': 'Body and label geometry simplified; colour texture 1024px; height 105mm.',
            headphones: 'Geometry simplified to four material groups with shared earcup finish; optional specular/clearcoat removed; colour maps 1024px, normal/packed maps 512px; height 300mm.',
            'cherry-tree': 'Geometry simplified and merged to seven material groups; textures 512px; petals alpha-tested; miniature height 330mm.',
        }[name],
    ];
    extras.credit = `This work is based on "${extras.title}" (${extras.source}) by ${extras.author}, licensed under ${extras.license}.`;
    source.json.asset.extras = extras;
    writeGlb(file, {
        asset: source.json.asset, materials,
        images: imageReport.map(i => ({data:fs.readFileSync(path.join(dir,i.file)),mimeType:i.mimeType,name:i.file})),
        textures:source.json.textures,samplers:source.json.samplers,meshes,rootName:name,quantize:50,
    });
    report[name] = {triangles:meshes.reduce((n,m)=>n+m.indices.length/3,0),drawCalls:meshes.length,dimensionsMm:max.map((v,k)=>+(v-min[k]).toFixed(2)),bytes:fs.statSync(file).size,textures:imageReport};
}
fs.writeFileSync(path.join(root,'assets-source/scene-update-build/packed-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
