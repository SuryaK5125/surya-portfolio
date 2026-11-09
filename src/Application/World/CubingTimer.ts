import * as THREE from 'three';

/** Original unbranded timer, in mm. All details are geometry, with no image maps. */
export default function createCubingTimer() {
    const timer = new THREE.Group(); timer.name = 'OriginalCubingTimer';
    const material = (name: string, color: number, roughness = .65, metalness = 0) => {
        const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), roughness, metalness });
        m.name = name; return m;
    };
    const rubber = material('Soft black underside', 0x191d20, .95);
    const casing = material('Graphite blue moulded shell', 0x485866, .57);
    const trim = material('Recessed seams and display surround', 0x222a30, .6);
    const metal = material('Satin hand sensors', 0x9da9b0, .42, .65);
    const keys = material('Ivory button caps', 0xd0d4cb, .65);
    const lcd = material('Unlit olive LCD', 0xa6b89a, .85);
    const ink = material('LCD segments and legends', 0x29372e, .9);
    const indicator = material('Muted amber power key', 0xb49762, .55);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    // Bake all transforms before batching. r137 Box3 cannot account for instance
    // offsets; ordinary meshes keep grounding, clearance and ray picking exact.
    const part = (geometry: THREE.BufferGeometry, finish: THREE.Material, x = 0, y = 0, z = 0, rx = 0) => {
        const matrix = new THREE.Matrix4().makeRotationX(rx); matrix.setPosition(x,y,z);
        geometry.applyMatrix4(matrix);
        const list = batches.get(finish) || []; list.push(geometry); batches.set(finish,list);
    };
    const rounded = (w: number, h: number, r: number) => {
        const s = new THREE.Shape(), x = -w/2, y = -h/2;
        s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
        s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
        s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s;
    };
    // Broad rounded sensor wings taper into a narrower central waist. This is
    // an original silhouette rather than the outline of a commercial timer.
    const outline = () => {
        const s = new THREE.Shape();
        s.moveTo(-132,-24); s.bezierCurveTo(-147,8,-126,43,-96,43);
        s.bezierCurveTo(-60,43,-54,27,-32,28); s.quadraticCurveTo(0,33,32,28);
        s.bezierCurveTo(54,27,60,43,96,43); s.bezierCurveTo(126,43,147,8,132,-24);
        s.bezierCurveTo(123,-46,103,-45,80,-40); s.quadraticCurveTo(51,-30,36,-35);
        s.quadraticCurveTo(0,-48,-36,-35); s.quadraticCurveTo(-51,-30,-80,-40);
        s.bezierCurveTo(-103,-45,-123,-46,-132,-24); return s;
    };
    const extrude = (shape: THREE.Shape, depth: number, bevel: number) => new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
        bevelSegments: 2, steps: 1, curveSegments: 7,
    });
    part(extrude(outline(), 3, 1),rubber,0,2,0,-Math.PI/2);
    const shell = extrude(outline(), 9, 2); shell.scale(.985,.985,1);
    part(shell,casing,0,7,0,-Math.PI/2);
    [-91,91].forEach(x => {
        // A dark moulded collar, inset metal disc and two concentric tool lines.
        part(new THREE.CylinderGeometry(32,34,3,40),trim,x,18,0);
        part(new THREE.CylinderGeometry(27.5,28,1.6,40),metal,x,20.2,0);
        [23.8,25.5].forEach(r => part(new THREE.TorusGeometry(r,.22,4,40),trim,x,21.1,0,Math.PI/2));
        // Low rubber ribs outside the discs are tactile, not printed decoration.
        [-1,1].forEach(side => [-10,-5,0,5,10].forEach(z => {
            part(new THREE.BoxGeometry(1.1,.65,2.5),rubber,x+side*30.5,19.5,z);
        }));
        // Recessed screw seats and a tiny slotted head at the wing tips.
        part(new THREE.CylinderGeometry(2.2,2.2,.3,12),trim,x,17.9,34);
        part(new THREE.CylinderGeometry(1.3,1.3,.35,12),metal,x,18.1,34);
        part(new THREE.BoxGeometry(1.8,.12,.35),trim,x,18.32,34);
    });
    // A pitched instrument housing faces the person at the open drawer. Its LCD
    // sits within a raised lip; a narrow secondary rule reads as the status row.
    const pitch = THREE.MathUtils.degToRad(7);
    const instrument = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
        g.translate(x,y,z); part(g,m,0,21,-7,pitch);
    };
    instrument(extrude(rounded(85,43,5),5,1).rotateX(-Math.PI/2),trim,0,0,0);
    instrument(new THREE.BoxGeometry(72,.6,28),lcd,0,6.1,-1);
    // Fixed 0:00.00, built from crisp segments, not a copied font or texture.
    [-26,-12,-1,13,24].forEach(x => {
        [-6,6].forEach(z => instrument(new THREE.BoxGeometry(5.2,.18,.8),ink,x,6.52,z-1));
        [-2.6,2.6].forEach(dx => [-3,3].forEach(z => instrument(new THREE.BoxGeometry(.8,.18,5),ink,x+dx,6.52,z-1)));
    });
    [{x:-19,z:-3},{x:-19,z:1},{x:6,z:5}].forEach(p => instrument(new THREE.BoxGeometry(1,.18,1),ink,p.x,6.52,p.z));
    instrument(new THREE.BoxGeometry(8,.12,.5),ink,-25,6.5,-12);
    [20,23,26].forEach(x => instrument(new THREE.BoxGeometry(1.5,.12,1.6),ink,x,6.5,-12));
    // Three distinct physical buttons in recessed seats: power / mode / reset.
    [-16,0,16].forEach((x,i) => {
        part(new THREE.CylinderGeometry(5.3,5.3,.6,20),trim,x,17.7,24);
        part(new THREE.CylinderGeometry(3.9,4.3,1.8,20),i===0?indicator:keys,x,18.7,24);
    });
    part(new THREE.TorusGeometry(1.6,.25,4,16,Math.PI*1.65),ink,-16,19.66,24,Math.PI/2);
    part(new THREE.BoxGeometry(.45,.12,1.7),ink,-16,19.7,22.6);
    part(new THREE.BoxGeometry(2.5,.12,.5),ink,0,19.7,24);
    part(new THREE.BoxGeometry(.5,.12,2.5),ink,16,19.7,24);
    part(new THREE.BoxGeometry(2.5,.12,.5),ink,16,19.7,24);
    // Four contact feet keep the casing off the fabric, grounded at y=0.
    [-103,103].forEach(x => [-24,24].forEach(z => part(new THREE.CylinderGeometry(7,7,2,16),rubber,x,1,z)));
    batches.forEach((geometries,finish) => {
        const positions: number[] = [], normals: number[] = [], indices: number[] = [];
        geometries.forEach(g => {
            const p=g.getAttribute('position'), n=g.getAttribute('normal'), offset=positions.length/3;
            for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));}
            if(g.index) for(let i=0;i<g.index.count;i++) indices.push(g.index.getX(i)+offset);
            else for(let i=0;i<p.count;i++) indices.push(i+offset);
            g.dispose();
        });
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
        geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh=new THREE.Mesh(geometry,finish); mesh.name=finish.name;
        mesh.castShadow=true; mesh.receiveShadow=true; timer.add(mesh);
    });
    return timer;
}
