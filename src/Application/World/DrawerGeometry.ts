import * as THREE from 'three';

type Kind = 'topFront' | 'topHandle' | 'lowerFront' | 'lowerHandle' | 'rest';

/** Measured against Henry's unchanged 304-triangle `desk` mesh, in source units.
 * Each drawer front is 2 triangles and each handle 68. Only the top drawer
 * moves; the lower drawer's front and handle are split out so they can be
 * finished like the top one. No other faces are touched. */
export function splitTopDrawer(source: THREE.BufferGeometry) {
    const positions = source.getAttribute('position');
    const index = source.getIndex();
    if (!index) throw new Error('Henry desk must be indexed before extracting the top drawer');
    const buckets: Record<Kind, number[]> = { topFront: [], topHandle: [], lowerFront: [], lowerHandle: [], rest: [] };
    const point = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
        const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        const within = (test: (p: THREE.Vector3) => boolean) =>
            triangle.every((v) => test(point.fromBufferAttribute(positions, v)));
        const onFront = (p: THREE.Vector3, yMin: number, yMax: number) =>
            p.x > -3.459 && p.x < -1.761 && p.y > yMin && p.y < yMax && Math.abs(p.z - 1.60541) < .0001;
        const onHandle = (p: THREE.Vector3, yMin: number, yMax: number) =>
            p.x > -2.872 && p.x < -2.399 && p.y > yMin && p.y < yMax && p.z > 1.617 && p.z < 1.722;
        let kind: Kind = 'rest';
        if (within((p) => onFront(p, -1.194, -.687))) kind = 'topFront';
        else if (within((p) => onHandle(p, -.837, -.765))) kind = 'topHandle';
        else if (within((p) => onFront(p, -1.795, -1.194))) kind = 'lowerFront';
        else if (within((p) => onHandle(p, -1.44, -1.36))) kind = 'lowerHandle';
        buckets[kind].push(...triangle);
    }
    // Fail closed if a different desk is supplied: never silently cut other faces.
    const counts = [buckets.topFront, buckets.topHandle, buckets.lowerFront, buckets.lowerHandle].map((b) => b.length / 3);
    if (counts.join() !== '2,68,2,68' || index.count !== 304 * 3) {
        throw new Error(`Unexpected Henry desk topology: ${counts.join('/')} of ${index.count / 3} triangles`);
    }
    const part = (indices: number[]) => {
        const geometry = source.clone();
        geometry.setIndex(indices);
        // Bounds must use referenced vertices, not the unused original desk vertices.
        const box = new THREE.Box3();
        indices.forEach((i) => box.expandByPoint(point.fromBufferAttribute(positions, i)));
        geometry.boundingBox = box;
        geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
        return geometry;
    };
    // The moving top drawer keeps one mesh; its front (group 0) and handle
    // (group 1) can take different materials.
    const moving = part([...buckets.topFront, ...buckets.topHandle]);
    moving.addGroup(0, buckets.topFront.length, 0);
    moving.addGroup(buckets.topFront.length, buckets.topHandle.length, 1);
    return {
        fixed: part(buckets.rest),
        moving,
        lowerFront: part(buckets.lowerFront),
        lowerHandle: part(buckets.lowerHandle),
    };
}
