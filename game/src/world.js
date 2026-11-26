// world.js — the valley of Sky Courier: Ridge Run.
// One tiny job: terrain height, the river, the runway and the ring course,
// all deterministic from the seed. The course runs south-to-north along
// the valley floor (world -Z is "ahead" at the start), so the pilot always
// has somewhere recognisable to fly toward.
//
// World units are metres. The runway sits near the origin on flat ground;
// the river snakes down the valley floor; ridges rise on both flanks.
import { fbm, mulberry32 } from './seed.js';

export const WORLD = {
  seed: 7,
  runway: { x: 0, z: -40, heading: 0, length: 260, width: 18 },
  valleyHalfWidth: 320,
  ridgeHeight: 150,
  farView: 520,
};

export function makeWorld(seed) {
  const rng = mulberry32(seed);
  // River centreline: a gentle sine meander down the valley.
  const riverX = (z) => 46 * Math.sin(z * 0.004 + 1.2) + 18 * Math.sin(z * 0.011);
  // Ring course: 8 rings weaving down the valley, each lower than the last
  // ridge, so the pilot threads the valley instead of climbing over it.
  const rings = [];
  for (let i = 0; i < 8; i++) {
    const z = -260 - i * 190;
    const x = riverX(z) + (rng() - 0.5) * 130;
    const y = 52 + 26 * Math.sin(i * 1.3) + rng() * 14;
    rings.push({ x, y, z, r: 16, passed: false });
  }
  return { seed, riverX, rings };
}

// Terrain height at (x, z). Flat near the runway, rolling fields on the
// valley floor, steep ridges on the flanks, riverbed carved along the river.
export function terrainHeight(world, x, z) {
  const { riverX } = world;
  const ax = Math.abs(x);
  const flank = Math.max(0, (ax - 150) / 260); // 0 in valley, 1 on ridges
  const ridge = fbm(x * 0.006, z * 0.006, world.seed, 4);
  const hills = fbm(x * 0.02 + 40, z * 0.02, world.seed + 7, 3);
  let h = flank * flank * (40 + 150 * ridge) + (1 - flank) * (hills * 9 - 2);
  // Carve the river channel.
  const dRiver = Math.abs(x - riverX(z));
  const carve = Math.max(0, 1 - dRiver / 14);
  h -= carve * carve * 5;
  // Flatten a pad around the runway so landings are fair.
  const r = WORLD.runway;
  const dx = x - r.x, dz = z - r.z;
  const dPad = Math.sqrt(dx * dx + dz * dz);
  const pad = Math.max(0, 1 - dPad / 220);
  h = h * (1 - pad * pad) + 0 * pad;
  return h;
}

// Colour of the ground at (x, z, height): fields, grass, rock, snow,
// river water, or runway tarmac. Patchwork fields make the valley floor
// readable from the air.
export function groundColor(world, x, z, h) {
  const r = WORLD.runway;
  if (Math.abs(x - r.x) < r.width / 2 && Math.abs(z - r.z) < r.length / 2) {
    // Runway tarmac with a centreline dash.
    const dash = Math.floor((z - r.z) / 16) % 2 === 0;
    const onLine = Math.abs(x - r.x) < 1.1;
    if (dash && onLine) return '#f2f2e8';
    return '#4a4a52';
  }
  const dRiver = Math.abs(x - world.riverX(z));
  if (dRiver < 7 && h < 4) return '#2f7fb8';
  if (h > 95) return '#e8ecf0'; // snow
  if (h > 55) return '#7a7568'; // rock
  if (h > 26) return '#5d7d43'; // high grass
  // Valley floor: patchwork fields by cell.
  const cx = Math.floor(x / 55), cz = Math.floor(z / 55);
  const cell = ((cx * 73856093) ^ (cz * 19349663) ^ (world.seed * 83492791)) >>> 0;
  const palette = ['#7fae4e', '#a9b45a', '#6d9c46', '#c2b25e', '#8fae54', '#5f9440'];
  return palette[cell % palette.length];
}
