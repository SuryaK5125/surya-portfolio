"""Re-encode the actual embedded images, avoiding Blender's cached packed originals."""
from pathlib import Path
from PIL import Image
import io,json,struct,sys
root=Path(__file__).resolve().parents[2]
for name in (sys.argv[1].split(',') if len(sys.argv)>1 else ['cartier','tom-ford','headphones','cherry-tree']):
    raw=(root/f'static/models/Props/{name}.glb').read_bytes()
    length=struct.unpack_from('<I',raw,12)[0];gl=json.loads(raw[20:20+length]);blob=raw[28+length:]
    out=root/'assets-source/scene-update-build'/name/'packed';out.mkdir(parents=True,exist_ok=True)
    report=[]
    normal_sources={gl['textures'][m['normalTexture']['index']]['source'] for m in gl['materials'] if 'normalTexture' in m}
    color_sources={gl['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in gl['materials'] if 'baseColorTexture' in m.get('pbrMetallicRoughness',{})}
    for i,img in enumerate(gl.get('images',[])):
        view=gl['bufferViews'][img['bufferView']];start=view.get('byteOffset',0)
        image=Image.open(io.BytesIO(blob[start:start+view['byteLength']]))
        original=list(image.size)
        limit=512 if i not in color_sources or name=='cherry-tree' else 1024
        image.thumbnail((limit,limit),Image.Resampling.LANCZOS)
        # Keep alpha and linear packed maps lossless. Colour photos use JPEG.
        color_sources={gl['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in gl['materials'] if 'baseColorTexture' in m.get('pbrMetallicRoughness',{})}
        alpha=image.mode in ('RGBA','LA') and image.getextrema()[-1][0]<255
        jpeg=i in color_sources and not alpha
        filename=f'{i}.jpg' if jpeg else f'{i}.png'
        if jpeg:image.convert('RGB').save(out/filename,quality=90,optimize=True)
        else:image.save(out/filename,optimize=True)
        report.append({'file':filename,'mimeType':'image/jpeg' if jpeg else 'image/png','source':original,'size':list(image.size)})
    (out/'images.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
