"""Normalize and optimize the user-downloaded CC BY Bloody V7, no new textures."""
import bpy,bmesh,json,struct
import numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[3]
CACHE=ROOT/'assets-source/scene-update-build';CACHE.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets-source/computer_mouse_a4tech_bloody_v7/scene.gltf'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
worlds={o:o.matrix_world.copy() for o in objects}
for o in objects:
 o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(worlds[o]);o.data.update()
def bounds():
 points=[]
 for o in objects:
  data=np.empty(len(o.data.vertices)*3);o.data.vertices.foreach_get('co',data);points.append(data.reshape(-1,3))
 p=np.concatenate(points);return Vector(p.min(axis=0)),Vector(p.max(axis=0))
lo,hi=bounds();factor=125/(hi.y-lo.y);pivot=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
for o in objects:o.data.transform(Matrix.Scale(factor,4)@Matrix.Translation(-pivot));o.data.update()
def select(parts):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0]
def triangles():return sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in objects)
def render(stage):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
 scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('World');scene.world.color=(.2,.2,.2)
 camdata=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',camdata);scene.collection.objects.link(cam)
 cam.location=(140,-180,180);cam.rotation_euler=(Vector((0,0,15))-cam.location).to_track_quat('-Z','Y').to_euler()
 camdata.type='ORTHO';camdata.ortho_scale=180;scene.camera=cam
 data=bpy.data.lights.new('QA light','SUN');data.energy=2.5;light=bpy.data.objects.new('QA light',data);scene.collection.objects.link(light);light.rotation_euler=(.3,-.6,-.6)
 scene.render.filepath=str(CACHE/f'mouse-{stage}.png');bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(cam,do_unlink=True);bpy.data.objects.remove(light,do_unlink=True)
before=triangles();render('source')
shared=bpy.data.materials.get('Material')
for o in objects:
 mat=o.data.materials[0];name=mat.name
 if name in ('Material.008','Material.005'):o.data.materials[0]=shared
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0002);bm.to_mesh(o.data);bm.free()
 select([o]);dec=o.modifiers.new('Preserve seams and wheel','DECIMATE');dec.ratio=.5 if name=='Material.002' else .22;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
groups={}
for o in objects:groups.setdefault(o.data.materials[0].name,[]).append(o)
objects=[]
for name,parts in groups.items():
 select(parts)
 if len(parts)>1:bpy.ops.object.join()
 o=bpy.context.view_layer.objects.active;o.name='BloodyV7_'+name;objects.append(o)
render('optimized');select(objects)
dest=ROOT/'static/models/Props/mouse.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_animations=False,export_cameras=False,export_lights=False)
raw=dest.read_bytes();length=struct.unpack_from('<I',raw,12)[0];gl=json.loads(raw[20:20+length]);source=json.loads((ROOT/'assets-source/computer_mouse_a4tech_bloody_v7/scene.gltf').read_text())
gl['asset']['extras']=source['asset']['extras'];gl['asset']['extras']['modifications']=[f'Baked source transforms, Y-up millimetres, base-centred pivot; length 125mm. Simplified {before} to {triangles()} triangles; three material groups; near-identical matte plastics shared. Original material colours and emissive details retained. No textures.']
payload=json.dumps(gl,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4);tail=raw[20+length:];dest.write_bytes(struct.pack('<III',0x46546c67,2,20+len(payload)+len(tail))+struct.pack('<II',len(payload),0x4e4f534a)+payload+tail)
lo,hi=bounds();print('MOUSE REPORT',json.dumps({'before':before,'after':triangles(),'groups':len(objects),'dimensions':list(hi-lo),'bytes':dest.stat().st_size}))
