/*
 * Datos falsos con la misma forma que el JSON propuesto para el backend.
 * Sirven para armar el frontend sin el servidor. Se borra cuando el
 * servidor real esté listo.
 */

'use strict';

export type MapCell = {
    x: number;
    z: number;
    type: string;
    dir?: string;
    id?: string;
};

export type CityMap = {
    width: number;
    height: number;
    cells: MapCell[];
};

export type CarState = {
    id: string;
    x: number;
    z: number;
};

export type LightState = {
    id: string;
    state: 'green' | 'red';
};

export type CityState = {
    step: number;
    running: boolean;
    cars: CarState[];
    trafficLights: LightState[];
};

// Mapa pequeño con las mismas letras de mapDictionary.json.
// La fila 0 es la de arriba, igual que en los archivos del curso.
const rows: string[] = [
    'v<<<<<<<<<',
    'v########^',
    'v########^',
    'v###D####^',
    'v########^',
    '>>>>s>>>>^',
];

const directions: Record<string, string> = {
    '>': 'Right',
    '<': 'Left',
    'v': 'Down',
    '^': 'Up',
};

const height: number = rows.length;
const width: number = rows[0].length;

// Igual que el servidor: la fila 0 del archivo queda con la z más alta
function toZ(row: number): number {
    return height - 1 - row;
}

export function mockMap(): CityMap {
    const cells: MapCell[] = [];

    rows.forEach((row, r) => {
        [...row].forEach((ch, c) => {
            const z = toZ(r);
            if (ch in directions) {
                cells.push({ x: c, z: z, type: 'road', dir: directions[ch] });
            } else if (ch === '#') {
                cells.push({ x: c, z: z, type: 'obstacle' });
            } else if (ch === 'D') {
                cells.push({ x: c, z: z, type: 'destination' });
            } else if (ch === 'S' || ch === 's') {
                cells.push({ x: c, z: z, type: 'trafficLight', id: `light_${c}_${z}` });
            }
        });
    });

    return { width: width, height: height, cells: cells };
}

// Recorrido alrededor del mapa, como (columna, fila)
const path: [number, number][] = [];
for (let c = 0; c < width; c++) path.push([c, height - 1]);
for (let r = height - 2; r >= 0; r--) path.push([width - 1, r]);
for (let c = width - 2; c >= 0; c--) path.push([c, 0]);
for (let r = 1; r <= height - 2; r++) path.push([0, r]);

function carAt(id: string, index: number): CarState {
    const [c, r] = path[index % path.length];
    return { id: id, x: c, z: toZ(r) };
}

export function mockState(step: number): CityState {
    const cars: CarState[] = [];

    // El auto 1000 existe de la 0 a la 19 y luego desaparece (llegó)
    if (step < 20) cars.push(carAt('1000', step));
    // El auto 1001 aparece en el paso 5 y desaparece en el 30
    if (step >= 5 && step < 30) cars.push(carAt('1001', step - 5));

    // El semáforo cambia cada 5 pasos
    const color: 'green' | 'red' = Math.floor(step / 5) % 2 === 0 ? 'green' : 'red';
    const trafficLights: LightState[] = mockMap().cells
        .filter((cell) => cell.type === 'trafficLight')
        .map((cell) => ({ id: cell.id as string, state: color }));

    return { step: step, running: step < 40, cars: cars, trafficLights: trafficLights };
}