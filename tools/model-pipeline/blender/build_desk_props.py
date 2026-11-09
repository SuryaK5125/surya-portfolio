"""Build the four CC BY desk props from downloaded glTFs (Blender 5.2).
Source files stay untouched. Outputs are mm, Y-up GLBs with grounded pivots.
Run: blender -b --factory-startup --python tools/model-pipeline/blender/build_desk_props.py
"""
import bpy, bmesh, json, math, os, sys, time
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[3]
CACHE=ROOT/'assets-source/scene-update-build'
CACHE.mkdir(parents=True,exist_ok=True)
LOG=open(CACHE/'build.log','w',encoding='utf-8')
def log(message):
    print(message,flush=True); LOG.write(str(message)+'\n'); LOG.flush()

CONFIG=[
    ('cartier','pasha_de_cartier_edition_noire',120),
    ('tom-ford','tom_ford_perfume_bottle__high-quality_3d_model',105),
    ('headphones','headphone_with_stand',300),
    ('cherry-tree','cherry_tree',330),
]
if '--only' in sys.argv:
    selected=sys.argv[sys.argv.index('--only')+1]
    CONFIG=[entry for entry in CONFIG if entry[0]==selected]
REPORT=json.loads((CACHE/'report.json').read_text(encoding='utf-8')) if (CACHE/'report.json').exists() else {}
def triangles(objects):
    return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
def bounds(objects):
    # Read vertices directly: imported bound_box caches can be stale after baking.
    mins=[]; maxs=[]
    for o in objects:
        data=np.empty(len(o.data.vertices)*3,dtype=np.float64)
        o.data.vertices.foreach_get('co',data);data=data.reshape(-1,3)
        matrix=np.asarray(o.matrix_world,dtype=np.float64)
        data=data@matrix[:3,:3].T+matrix[:3,3]
        mins.append(data.min(axis=0));maxs.append(data.max(axis=0))
    return Vector(np.min(mins,axis=0)),Vector(np.max(maxs,axis=0))
def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
def render(objects,name,stage):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; scene.cycles.samples=16
    scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.world.color=(.18,.18,.18)
    lo,hi=bounds(objects);size=hi-lo; centre=(lo+hi)/2; span=max(size)
    camdata=bpy.data.cameras.new('QA'); cam=bpy.data.objects.new('QA',camdata);scene.collection.objects.link(cam)
    cam.location=centre+Vector((span*1.1,-span*2,span*.85)); cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
    camdata.type='ORTHO';camdata.ortho_scale=span*1.4;camdata.clip_end=100000
    scene.camera=cam
    sun=bpy.data.lights.new('QA sun','SUN');sun.energy=2.5
    light=bpy.data.objects.new('QA sun',sun);scene.collection.objects.link(light);light.rotation_euler=(.4,-.6,-.5)
    scene.render.filepath=str(CACHE/f'{name}-{stage}.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam,do_unlink=True);bpy.data.objects.remove(light,do_unlink=True)

for name,folder,height in CONFIG:
    started=time.time();log('START '+name)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if bpy.context.scene.world is None:bpy.context.scene.world=bpy.data.worlds.new('World')
    source=ROOT/'assets-source'/folder/'scene.gltf'
    gl=json.loads(source.read_text(encoding='utf-8'))
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    before=triangles(objects)
    # Bake the imported Y-up -> Z-up conversion, including mirrored transforms.
    worlds={o:o.matrix_world.copy() for o in objects}
    for o in objects:
        o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(worlds[o]);o.data.update()
    bpy.context.view_layer.update()
    lo,hi=bounds(objects); factor=height/(hi.z-lo.z)
    # Headphone stand pivot remains centred on its circular base, not the cable.
    centre=Vector((0,0,lo.z)) if name=='headphones' else Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    orient=Matrix.Scale(factor,4)@Matrix.Translation(-centre)
    for o in objects:o.data.transform(orient)
    for o in objects:o.data.update()
    bpy.context.view_layer.update()
    render(objects,name,'source')
    for o in objects:
        mat=o.data.materials[0] if len(o.data.materials) else None
        m=mat.name.lower() if mat else ''
        count=triangles([o])
        if name=='headphones':
            ratio=.25 if 'stand' in m else .22 if 'cable' in m else .6 if 'header' in m else .65
        elif name=='cartier':ratio=.5 if 'chrome' in m else .35 if 'glass' in m else .3 if 'plastic' in m else .6
        elif name=='tom-ford':ratio=.65 if '002' in m else .22
        else:
            ratio=.022 if 'stalk' in m else .75 if m=='v176cherryflower' else .12 if 'bud' in m else .13 if 'branch' in m else .2
        # Keep the ribbed chrome cap and its original split normals intact.
        if name=='cartier' and 'chrome' in m:continue
        # glTF splits shared vertices for UVs/normals; weld before collapse so
        # the cap ribs and narrow cables cannot tear along those splits.
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=height*0.000002)
        bm.to_mesh(o.data);bm.free();o.data.update()
        if count>200:
            select([o]);modifier=o.modifiers.new('Preserve silhouette','DECIMATE');modifier.ratio=ratio
            modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    # The two earcups share colour/normal maps; share the left finish as well.
    if name=='headphones':
        left=next((m for m in bpy.data.materials if m.name=='driverL'),None)
        for o in objects:
            if left and o.data.materials and o.data.materials[0].name=='driverR':o.data.materials[0]=left
    # Preserve base colour and normal maps, but remove costly optional specular /
    # clearcoat layers (not distinguishable at the final desk viewing distance).
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bsdf:continue
        for socket_name in ['Coat Weight','Specular IOR Level']:
            socket=bsdf.inputs.get(socket_name)
            if socket:
                for link in list(socket.links):mat.node_tree.links.remove(link)
                socket.default_value=0 if socket_name=='Coat Weight' else .35
        if name=='cartier' and mat.name=='glass':
            # Edition Noire is opaque dark glass; the source's alpha made it see-through.
            alpha=bsdf.inputs.get('Alpha')
            for link in list(alpha.links):mat.node_tree.links.remove(link)
            alpha.default_value=1
            bsdf.inputs['Roughness'].default_value=.22
        if name=='cherry-tree' and mat.name=='v176CherryFlower':
            # Cut-out petals, rather than order-dependent transparent layers.
            if hasattr(mat,'surface_render_method'):mat.surface_render_method='DITHERED'
    # One object per material (no appearance-changing atlas or texture bake).
    groups={}
    for o in objects:
        key=o.data.materials[0].name if o.data.materials else 'none'
        groups.setdefault(key,[]).append(o)
    objects=[]
    for material,parts in groups.items():
        select(parts)
        if len(parts)>1:bpy.ops.object.join()
        o=bpy.context.view_layer.objects.active;o.name=f'{name}_{material}';objects.append(o)
    used_images=set()
    for o in objects:
        for mat in o.data.materials:
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image:used_images.add(node.image)
    texdir=CACHE/name;texdir.mkdir(exist_ok=True)
    texture_report=[]
    for image in used_images:
        original=list(image.size)
        lower=image.name.lower()
        limit=512 if 'normal' in lower else 1024
        if name=='cherry-tree':limit=1024 if 'flower' in lower else 512
        scale=min(1,limit/max(image.size))
        if scale<1:image.scale(max(1,round(image.size[0]*scale)),max(1,round(image.size[1]*scale)))
        image.file_format='PNG';image.filepath_raw=str(texdir/(Path(image.name).stem+'.png'));image.save();image.pack()
        texture_report.append({'name':image.name,'source':original,'output':list(image.size)})
    select(objects)
    render(objects,name,'optimized')
    dest=ROOT/'static/models/Props'/f'{name}.glb';dest.parent.mkdir(exist_ok=True,parents=True)
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_yup=True,
        export_materials='EXPORT',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    # Embed the downloaded author, source and license in the shipped GLB.
    import struct
    raw=dest.read_bytes(); json_len=struct.unpack_from('<I',raw,12)[0]
    glb=json.loads(raw[20:20+json_len]);glb['asset']['extras']=dict(gl['asset'].get('extras',{}))
    glb['asset']['extras']['modifications']=[
        'Reoriented to Y-up; scaled to millimetres; grounded pivot.',
        f'Decimated from {before} to {triangles(objects)} triangles; joined by material.',
        'Downsampled colour maps to at most 1024px and normal maps to 512px; removed optional specular/clearcoat layers.',
        'Cartier dark glass made opaque; headphone earcup finish shared.'
    ]
    payload=json.dumps(glb,separators=(',',':'),ensure_ascii=True).encode();payload+=b' '*((-len(payload))%4)
    tail=raw[20+json_len:];dest.write_bytes(struct.pack('<III',0x46546c67,2,20+len(payload)+len(tail))+struct.pack('<II',len(payload),0x4e4f534a)+payload+tail)
    lo,hi=bounds(objects)
    REPORT[name]={'sourceTriangles':before,'triangles':triangles(objects),'drawCalls':len(objects),'dimensionsMm':list(hi-lo),'textures':texture_report,'bytes':dest.stat().st_size,'heightMm':height}
    (CACHE/'report.json').write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
    log(f'FINISHED {name}: {REPORT[name]} ({time.time()-started:.1f}s)')
log('COMPLETE')
