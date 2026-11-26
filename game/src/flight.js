// flight.js — the aeroplane and the rules of Sky Courier: Ridge Run.
// One tiny job: hold the plane's state, step the flight model, score the
// missions, and decide win / crash / landed. No drawing here.
import { terrainHeight, WORLD } from './world.js';

export const MISSIONS = {
  rings: { name: 'Ring Run', blurb: 'Thread all 8 rings down the valley, then land on the runway.' },
  landing: { name: 'Landing Challenge', blurb: 'Fly the approach and set her down gently on the runway.' },
};

export function newPlane() {
  return {
    x: 0, y: 90, z: 320,        // metres; start south of the runway, heading north (-Z)
    heading: 0,                 // radians, 0 = north (-Z)
    pitch: 0, roll: 0,          // radians
    speed: 42,                  // m/s
    throttle: 0.62,             // 0..1
    vspeed: 0,                  // m/s vertical
    fuel: 100,                  // percent
    integrity: 100,             // percent; 0 = wrecked
    flaps: false,
  };
}

export function newGame(seed) {
  return {
    seed,
    phase: 'title',             // title | flying | landed | crashed | won
    mission: 'rings',
    plane: newPlane(),
    score: 0,
    ringsPassed: 0,
    time: 0,                    // seconds in flight
    message: '',
    messageT: 0,
    best: 0,
    paused: false,
    landedBonusGiven: false,
  };
}

export function setMessage(game, text, seconds) {
  game.message = text;
  game.messageT = seconds || 3;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// One physics step. `ctl` is { pitch, roll, yaw, throttle } in [-1, 1]
// (throttle is a delta here, applied by main.js), dt in seconds.
export function stepFlight(game, world, ctl, dt) {
  const p = game.plane;
  if (game.phase !== 'flying') return;
  game.time += dt;

  // Throttle and fuel.
  p.throttle = clamp(p.throttle + ctl.throttle * dt * 0.55, 0, 1);
  p.fuel = Math.max(0, p.fuel - dt * (0.35 + p.throttle * 1.15));
  if (p.fuel <= 0 && p.throttle > 0.12) p.throttle = 0.12; // sputter, glide

  // Attitude: controls answer at every speed; authority fades only a
  // little when slow so the plane never feels dead.
  const authority = 0.55 + 0.45 * clamp(p.speed / 45, 0, 1);
  p.roll = clamp(p.roll + ctl.roll * dt * 1.9 * authority, -1.15, 1.15);
  p.roll *= Math.pow(0.55, dt); // gentle self-levelling when sticks are free
  p.pitch = clamp(p.pitch + ctl.pitch * dt * 0.85 * authority, -0.5, 0.55);
  p.pitch *= Math.pow(0.7, dt);

  // Turn: banked flight turns the heading; rudder yaws a little too.
  const turnRate = -Math.sin(p.roll) * 0.55 + ctl.yaw * 0.28;
  p.heading += turnRate * dt * clamp(p.speed / 30, 0.25, 1);

  // Speed: throttle pulls toward its target speed; drag grows with speed.
  const targetSpeed = 12 + p.throttle * 58;
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 0.35);
  p.speed -= Math.sin(p.pitch) * 9 * dt; // climbing bleeds speed
  // Stall floor — but never while rolling on the ground, or a landing
  // could never bleed off to a stop.
  const groundNow = terrainHeight(world, p.x, p.z);
  if (p.y > groundNow + 1.3 && p.speed < 9) p.speed = 9; // stall floor: she mushes, she does not fall

  // Vertical speed follows pitch and speed, with a steady sink that the
  // pilot must fly against: level flight at cruise throttle needs a touch
  // of back-stick, and a low-throttle approach descends on its own.
  const lift = Math.sin(p.pitch) * p.speed;
  p.vspeed += (lift - p.vspeed) * Math.min(1, dt * 1.6);
  p.vspeed -= (1.6 + (1 - p.throttle) * 5) * dt * 0.6;
  if (p.flaps) p.vspeed -= 1.2 * dt * 10 * 0.12;
  p.y += p.vspeed * dt;

  // Move forward along the heading.
  const fx = Math.sin(p.heading), fz = -Math.cos(p.heading);
  p.x += fx * p.speed * dt;
  p.z += fz * p.speed * dt;

  // Soft world bounds: the valley is long, but not endless.
  p.x = clamp(p.x, -700, 700);
  if (p.z < -2100) p.z = -2100;
  if (p.z > 700) p.z = 700;

  // Ground contact.
  const ground = terrainHeight(world, p.x, p.z);
  if (p.y <= ground + 1.2) {
    p.y = ground + 1.2;
    landOrCrash(game, world, ground, dt);
  }

  // Ring checks for the Ring Run mission.
  if (game.mission === 'rings') {
    for (const ring of world.rings) {
      if (ring.passed) continue;
      const dx = p.x - ring.x, dy = p.y - ring.y, dz = p.z - ring.z;
      if (dx * dx + dy * dy + dz * dz < ring.r * ring.r) {
        ring.passed = true;
        game.ringsPassed++;
        game.score += 100;
        setMessage(game, `Ring ${game.ringsPassed} of 8!  +100`, 2.5);
        if (game.ringsPassed === world.rings.length) {
          game.score += 150;
          setMessage(game, 'All rings! Land on the runway for +150.', 4);
        }
        break;
      }
    }
  }

  if (game.messageT > 0) game.messageT -= dt;
}

function onRunway(world, x, z) {
  const r = WORLD.runway;
  return Math.abs(x - r.x) < r.width / 2 + 3 && Math.abs(z - r.z) < r.length / 2 + 6;
}

function landOrCrash(game, world, ground, dt) {
  const p = game.plane;
  const gentle = Math.abs(p.vspeed) < 4.5 && p.speed < 42;
  if (onRunway(world, p.x, p.z) && gentle) {
    // A good landing: cut power, brake, stop, refuel, score.
    p.throttle = 0;
    p.vspeed = 0;
    p.speed = Math.max(0, p.speed - 34 * dt);
    if (p.speed <= 0.5) {
      p.speed = 0; p.vspeed = 0;
      if (!game.landedBonusGiven) {
        game.landedBonusGiven = true;
        const timeBonus = Math.max(0, Math.round(300 - game.time));
        game.score += 150 + timeBonus;
        game.phase = game.mission === 'landing' || game.ringsPassed === world.rings.length
          ? 'won' : 'landed';
        setMessage(game, game.phase === 'won'
          ? `Touchdown! Mission complete — ${game.score} pts`
          : `Landed! Refuelled. Take off again (T) or press R.`, 5);
      }
      p.fuel = 100;
    }
    return;
  }
  // Rough ground contact.
  const impact = Math.abs(p.vspeed) + Math.max(0, p.speed - 34) * 0.35;
  if (impact > 7) {
    p.integrity = 0;
    game.phase = 'crashed';
    setMessage(game, impact > 16 ? 'Crashed into the ridge!' : 'Hard landing — airframe lost.', 5);
  } else {
    // A survivable bump off-runway: scrape, lose integrity, bounce back up.
    p.integrity = Math.max(0, p.integrity - Math.round(impact * 6));
    p.y += 3;
    p.vspeed = 2.5;
    p.speed *= 0.82;
    setMessage(game, `Rough ground! Integrity ${p.integrity}%`, 2.5);
    if (p.integrity <= 0) { game.phase = 'crashed'; }
  }
}

export function resetGame(game, world) {
  const seed = game.seed;
  const mission = game.mission;
  const fresh = newGame(seed);
  fresh.mission = mission;
  fresh.best = game.best;
  Object.assign(game, fresh);
  for (const ring of world.rings) ring.passed = false;
  game.phase = 'flying';
}

export function startMission(game, mission) {
  game.mission = mission;
  game.phase = 'flying';
}
