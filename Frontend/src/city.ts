/*
 * Scene of the city: draws the map (roads, obstacles, destinations and
 * traffic lights) and the cars, using cubes and cylinders.
 * For now it uses the fake data from mock_api.ts.
 */

'use strict';

import { M4, V3, type Mat4, type Vec3 } from '../libs/3d-lib';
import { Scene } from '../libs/scene_multi_shader.js';
import { type Color } from '../libs/color.ts';
import { Object3DProgram } from '../libs/object3d_multi_shader.ts';
import { Camera3D } from '../libs/camera3d.ts';
import { cubeFaceColors } from '../libs/shapes.ts';
import { cylinderAlongX } from '../libs/cylinder.ts';
import { mockMap, mockState, type CityMap, type CityState, type MapCell } from '../libs/mock_api.ts';

// Define the shader code, using GLSL 3.00
import vsFlatGLSL from '../assets/shaders/vs_flat.glsl?raw';
import fsFlatGLSL from '../assets/shaders/fs_flat.glsl?raw';

// Each direction has a slightly different tint, to check the orientation
const ROAD_COLORS: Record<string, Color> = {
    Right: [0.28, 0.30, 0.38, 1],
    Left: [0.38, 0.30, 0.28, 1],
    Up: [0.28, 0.38, 0.30, 1],
    Down: [0.38, 0.36, 0.26, 1],
};
const ROAD_DEFAULT: Color = [0.30, 0.30, 0.30, 1];
const OBSTACLE_COLOR: Color = [0.55, 0.50, 0.45, 1];
const DESTINATION_COLOR: Color = [0.20, 0.50, 0.90, 1];
const POST_COLOR: Color = [0.20, 0.20, 0.20, 1];
const LAMP_COLOR: Color = [0.95, 0.80, 0.10, 1];
const GREEN: Color = [0.10, 0.80, 0.20, 1];
const RED: Color = [0.90, 0.15, 0.10, 1];

// Parts of a car
const BODY_COLOR: Color = [0.95, 0.45, 0.10, 1];
const CABIN_COLOR: Color = [0.70, 0.85, 0.95, 1];
const WHEEL_COLOR: Color = [0.08, 0.08, 0.08, 1];
const HUB_COLOR: Color = [0.75, 0.75, 0.75, 1];
const WHEEL_RADIUS = 0.12;
const WHEEL_WIDTH = 0.10;
// Position of each wheel in the car: [x (side), z (front is positive)]
const WHEEL_POSITIONS: [number, number][] = [
    [-0.27, 0.28], [0.27, 0.28], [-0.27, -0.28], [0.27, -0.28],
];
// Height of the top of the road, where the cars drive
const GROUND = 0.05;

// A car of the simulation. In the car, the front is the +z direction.
type Car = {
    id: string;
    from: Vec3;             // Position at the start of the step
    to: Vec3;               // Position at the end of the step
    pos: Vec3;              // Current position, between from and to
    heading: number;        // Rotation around the Y axis (radians)
    distance: number;       // Distance traveled before the current step
    stepLength: number;     // Distance of the current step
};

class CityScene extends Scene {

    camera: Camera3D;
    city: CityMap;
    // Everything static that has to be drawn
    cityObjects: Object3DProgram[] = [];
    // The lamp of each traffic light, by id (to change its color)
    lamps: Map<string, Object3DProgram> = new Map();
    // The cars in the scene, by id
    cars: Map<string, Car> = new Map();

    // Simulation step shown, and time since the last update (in milliseconds)
    step: number = 0;
    running: boolean = true;
    elapsed: number = 0;
    updateDelay: number = 1000;

    constructor(gl: WebGL2RenderingContext, city: CityMap) {
        super(gl, {
            flat: {vs: vsFlatGLSL, fs: fsFlatGLSL},
        });

        this.city = city;

        // Camera looking at the center of the map
        this.camera = new Camera3D(
            0,                                          // ID
            Math.max(city.width, city.height) * 1.3,    // Distance to target
            0,                                          // Azimut
            1.2,                                        // Elevation
            [0, 0, 10],
            [(city.width - 1) / 2, 0, (city.height - 1) / 2]);
        this.camera.setupControls();

        // Base shapes, to be replicated for every element of the city
        this.addObject('cube', 'flat', cubeFaceColors(0.5), [1, 1, 1, 1]);
        this.addObject('wheel', 'flat', cylinderAlongX(16), WHEEL_COLOR);

        for (const cell of city.cells) {
            this.buildCell(cell);
        }

        // Show the first state of the simulation
        this.applyState(mockState(0));
    }

    // The server sends z counting from the bottom of the map file.
    // Flip it back, so the 3D city looks like the map file.
    sceneZ(z: number): number {
        return this.city.height - 1 - z;
    }

    // Creates a copy of the base cube with its position, scale and color
    place(
        name: string,
        color: Color,
        x: number, y: number, z: number,
        sx: number, sy: number, sz: number,
    ): Object3DProgram {
        const object = this.duplicateObject(name, 'cube', color);
        object.setPosition(x, y, z);
        object.transforms.s = { x: sx, y: sy, z: sz };
        this.cityObjects.push(object);
        return object;
    }

    buildCell(cell: MapCell): void {
        const x = cell.x;
        const z = this.sceneZ(cell.z);
        const name = `${x}_${z}`;

        if (cell.type === 'road') {
            const color = ROAD_COLORS[cell.dir ?? ''] ?? ROAD_DEFAULT;
            this.place(`road_${name}`, color, x, 0, z, 1, 0.1, 1);

        } else if (cell.type === 'obstacle') {
            this.place(`building_${name}`, OBSTACLE_COLOR, x, 0.35, z, 0.9, 0.8, 0.9);

        } else if (cell.type === 'destination') {
            this.place(`destination_${name}`, DESTINATION_COLOR, x, 0, z, 1, 0.1, 1);

        } else if (cell.type === 'trafficLight') {
            // Road below, a post and the lamp on top
            this.place(`road_${name}`, ROAD_DEFAULT, x, 0, z, 1, 0.1, 1);
            this.place(`post_${name}`, POST_COLOR, x, 0.6, z, 0.2, 1.2, 0.2);
            const lamp = this.place(`lamp_${name}`, LAMP_COLOR, x, 1.4, z, 0.5, 0.4, 0.5);
            this.lamps.set(cell.id ?? name, lamp);
        }
    }

    // Updates the scene with the state of the simulation
    applyState(state: CityState): void {
        this.step = state.step;
        this.running = state.running;

        // Create the new cars and set where the existing ones have to go
        const present = new Set<string>();
        for (const car of state.cars) {
            present.add(car.id);

            const target: Vec3 = V3.create(car.x, GROUND, this.sceneZ(car.z));

            const existing = this.cars.get(car.id);
            if (existing === undefined) {
                // A new car appears directly in its cell
                this.cars.set(car.id, {
                    id: car.id,
                    from: target,
                    to: target,
                    pos: V3.create(target[0], target[1], target[2]),
                    heading: 0,
                    distance: 0,
                    stepLength: 0,
                });
            } else {
                // An existing car starts moving from where it is now
                existing.distance += existing.stepLength;
                existing.from = V3.create(existing.pos[0], existing.pos[1], existing.pos[2]);
                existing.to = target;

                const dx = target[0] - existing.from[0];
                const dz = target[2] - existing.from[2];
                existing.stepLength = Math.hypot(dx, dz);

                // Turn towards the direction of the movement
                if (existing.stepLength > 0.01) {
                    existing.heading = Math.atan2(dx, dz);
                }
            }
        }

        // Remove the cars that are not in the state anymore (they arrived)
        for (const id of this.cars.keys()) {
            if (!present.has(id)) {
                this.cars.delete(id);
            }
        }

        // Color of the lamp of each traffic light
        for (const light of state.trafficLights) {
            const lamp = this.lamps.get(light.id);
            if (lamp !== undefined) {
                lamp.color = light.state === 'green' ? GREEN : RED;
            }
        }
    }

    // Draws a shape with the final matrix already built
    drawTransformed(
        shape: string,
        color: Color,
        transforms: Mat4,
        viewProjectionMatrix: Mat4,
    ): void {
        // World-View-Projection
        const wvpMat: Mat4 = M4.multiply(viewProjectionMatrix, transforms);

        // The matrix to be used for normal transformations
        const normalMat = M4.transpose(M4.inverse(transforms));

        const uniforms = {
            u_worldViewProjection: wvpMat,
            u_worldInverseTransform: normalMat,
            u_color: color,
        };

        this.drawObject(shape, uniforms);
    }

    prepareObject(object: Object3DProgram, viewProjectionMatrix: Mat4): void {
        // Prepare the vector for translation and scale
        const v3_tra: Vec3 = object.posArray;
        const v3_sca: Vec3 = object.scaArray;

        // Create the individual transform matrices
        const scaMat: Mat4 = M4.scale(v3_sca);
        const rotXMat: Mat4 = M4.rotationX(object.transforms.rr.x);
        const rotYMat: Mat4 = M4.rotationY(object.transforms.rr.y);
        const rotZMat: Mat4 = M4.rotationZ(object.transforms.rr.z);
        const traMat: Mat4 = M4.translation(v3_tra);

        // Create the composite matrix with all transformations
        let transforms: Mat4 = M4.identity();
        transforms = M4.multiply(scaMat, transforms);
        transforms = M4.multiply(rotXMat, transforms);
        transforms = M4.multiply(rotYMat, transforms);
        transforms = M4.multiply(rotZMat, transforms);
        transforms = M4.multiply(traMat, transforms);

        this.drawTransformed('cube', object.color, transforms, viewProjectionMatrix);
    }

    // Draws one part of a car. The transformations are applied in this order:
    // scale, roll (wheels), offset inside the car, heading of the car,
    // and position of the car in the city.
    drawPart(
        shape: string,
        color: Color,
        car: Car,
        offset: number[],
        roll: number,
        scale: number[],
        viewProjectionMatrix: Mat4,
    ): void {
        let transforms: Mat4 = M4.identity();
        transforms = M4.multiply(M4.scale(V3.create(scale[0], scale[1], scale[2])), transforms);
        transforms = M4.multiply(M4.rotationX(roll), transforms);
        transforms = M4.multiply(M4.translation(V3.create(offset[0], offset[1], offset[2])), transforms);
        transforms = M4.multiply(M4.rotationY(car.heading), transforms);
        transforms = M4.multiply(M4.translation(car.pos), transforms);

        this.drawTransformed(shape, color, transforms, viewProjectionMatrix);
    }

    drawCar(car: Car, t: number, viewProjectionMatrix: Mat4): void {
        // Body and cabin
        this.drawPart('cube', BODY_COLOR, car, [0, 0.22, 0], 0, [0.46, 0.16, 0.90], viewProjectionMatrix);
        this.drawPart('cube', CABIN_COLOR, car, [0, 0.37, -0.05], 0, [0.34, 0.14, 0.45], viewProjectionMatrix);

        // The wheels roll as the car advances: angle = distance / radius
        const roll = (car.distance + t * car.stepLength) / WHEEL_RADIUS;

        for (const [x, z] of WHEEL_POSITIONS) {
            const offset = [x, WHEEL_RADIUS, z];
            this.drawPart('wheel', WHEEL_COLOR, car, offset, roll,
                          [WHEEL_WIDTH / 2, WHEEL_RADIUS, WHEEL_RADIUS], viewProjectionMatrix);
            // A light bar on the wheel, to see how it turns
            this.drawPart('cube', HUB_COLOR, car, offset, roll,
                          [WHEEL_WIDTH + 0.02, 0.03, WHEEL_RADIUS * 1.6], viewProjectionMatrix);
        }
    }

    protected render(deltaTime: number): void {
        const { gl } = this;

        // Ask for the next step of the simulation after the delay
        if (this.running) {
            this.elapsed += deltaTime;
            if (this.elapsed >= this.updateDelay) {
                this.elapsed = 0;
                this.applyState(mockState(this.step + 1));
            }
        }

        // Move the cars smoothly from the previous cell to the new one
        const t = this.running ? Math.min(this.elapsed / this.updateDelay, 1) : 1;
        for (const car of this.cars.values()) {
            car.pos[0] = car.from[0] + (car.to[0] - car.from[0]) * t;
            car.pos[1] = car.from[1] + (car.to[1] - car.from[1]) * t;
            car.pos[2] = car.from[2] + (car.to[2] - car.from[2]) * t;
        }

        // Clear the canvas
        gl.clearColor(0.10, 0.10, 0.12, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Tell webgl to cull faces
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Check for camera keys and update the camera position
        this.camera.checkKeys();
        const viewProjectionMatrix = this.camera.setupViewProjection(gl);

        for (const object of this.cityObjects) {
            this.prepareObject(object, viewProjectionMatrix);
        }
        for (const car of this.cars.values()) {
            this.drawCar(car, t, viewProjectionMatrix);
        }
    }

    // No controls yet
    setupUI(): void {
    }
}

/*
 * Main function to initialize the WebGL context and create the scene.
 */
function main(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        throw new Error('No canvas element found in the document');
    }

    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 is not supported by this browser');
    }

    const scene = new CityScene(gl, mockMap());
    scene.setupUI();
    scene.draw(0);
}

main();