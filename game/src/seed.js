// seed.js — deterministic random numbers for Sky Courier: Ridge Run.
// One tiny job: a seeded PRNG and smooth value noise, so the same seed
// always builds the same valley, river and ring course.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash -> [0,1). Stable for any (x, z, seed) triple.
export function hash2(x, z, seed) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade(t) { return t * t * (3 - 2 * t); }

// Smooth 2D value noise in [0,1], deterministic per seed.
export function noise2(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  const u = fade(xf), v = fade(zf);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
}

// Fractal noise: several octaves of noise2, still in roughly [0,1].
export function fbm(x, z, seed, octaves) {
  let sum = 0, amp = 0.5, total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x, z, seed + i * 101);
    total += amp; amp *= 0.5;
    x *= 2.03; z *= 2.01;
  }
  return sum / total;
}
