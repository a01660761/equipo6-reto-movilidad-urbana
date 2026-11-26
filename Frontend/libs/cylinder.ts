/*
 * Function to create the vertex and normal information for a cylinder.
 * The axis of the cylinder goes along the X axis, from -1 to 1, and the
 * radius is 1. Use a scale to get the size that is needed.
 * It can be used for the wheels of a car.
 */

import * as twgl from 'twgl-base.js';

function cylinderAlongX(segments: number = 16): twgl.Arrays {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Side of the cylinder: two vertices (one for each end) at every angle.
    // The first angle is repeated at the end, to close the ring.
    for (let i = 0; i <= segments; i++) {
        const angle = 2 * Math.PI * i / segments;
        const y = Math.cos(angle);
        const z = Math.sin(angle);

        // Vertex at x = -1
        positions.push(-1, y, z);
        normals.push(0, y, z);
        // Vertex at x = 1
        positions.push(1, y, z);
        normals.push(0, y, z);
    }
    for (let i = 0; i < segments; i++) {
        const a = 2 * i;        // x = -1, this angle
        const b = 2 * i + 1;    // x =  1, this angle
        const c = 2 * i + 3;    // x =  1, next angle
        const d = 2 * i + 2;    // x = -1, next angle
        indices.push(a, c, b,   a, d, c);
    }

    // The two ends: a center vertex and a ring of vertices,
    // with the normal along the axis
    for (const x of [-1, 1]) {
        const center = positions.length / 3;
        positions.push(x, 0, 0);
        normals.push(x, 0, 0);
        for (let i = 0; i <= segments; i++) {
            const angle = 2 * Math.PI * i / segments;
            positions.push(x, Math.cos(angle), Math.sin(angle));
            normals.push(x, 0, 0);
        }
        for (let i = 0; i < segments; i++) {
            const p = center + 1 + i;
            if (x > 0) {
                indices.push(center, p, p + 1);
            } else {
                indices.push(center, p + 1, p);
            }
        }
    }

    return {
        a_position: { numComponents: 3, data: positions },
        a_normal: { numComponents: 3, data: normals },
        indices: { numComponents: 3, data: indices },
    };
}

export { cylinderAlongX };