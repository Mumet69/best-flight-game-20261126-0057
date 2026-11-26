// main.js — bootstrap, game loop and scene setups for Sky Courier.
// One tiny job: wire input, audio, flight and render together, run the
// loop, and serve the deterministic screenshot scenes (?scene=…&seed=…).
import { makeWorld } from './world.js';
import { newGame, stepFlight, resetGame, startMission, setMessage, MISSIONS } from './flight.js';
import { drawScene } from './render.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const sceneName = params.get('scene') || '';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 1280, H = 800;
canvas.width = W; canvas.height = H;

const world = makeWorld(seed);
const game = newGame(seed);
const input = makeInput();
const audio = makeAudio();
window.__game = game; // play-test hook
window.__world = world;

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayHint = document.getElementById('overlay-hint');
const startBtn = document.getElementById('start-btn');
const missionBtns = document.querySelectorAll('[data-mission]');

function showOverlay(title, text, hint, showStart) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayHint.textContent = hint;
  startBtn.style.display = showStart ? '' : 'none';
  overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); }

function showTitle() {
  game.phase = 'title';
  showOverlay(
    'SKY COURIER · RIDGE RUN',
    'You fly the mail plane through the ridge valley. Thread the glowing rings, mind your fuel, and set her down on the runway. Two missions: Ring Run and Landing Challenge.',
    'W/S throttle · Arrow keys fly · A/D rudder · Mouse drag steers · F flaps · P pause · M sound · R restart',
    true,
  );
}

function endScreen() {
  if (game.phase === 'won') {
    showOverlay('MISSION COMPLETE', `Score ${game.score} · Time ${fmt(game.time)} · Rings ${game.ringsPassed}/${world.rings.length}. The valley mail got through — thanks to you, courier.`, 'Press R or click Fly again for another run.', true);
    startBtn.textContent = 'FLY AGAIN';
  } else if (game.phase === 'crashed') {
    showOverlay('CRASHED', `The airframe is lost in the valley. Score ${game.score} · Rings ${game.ringsPassed}/${world.rings.length}. The courier service sends a fresh plane.`, 'Press R or click Fly again to try once more.', true);
    startBtn.textContent = 'FLY AGAIN';
  } else if (game.phase === 'landed') {
    showOverlay('LANDED — REFUELLED', `Nice touchdown. Score ${game.score}. Fuel is full again.`, 'Press T to take off, or R to restart the mission.', false);
  }
}

function fmt(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

startBtn.addEventListener('click', () => {
  audio.ensure();
  hideOverlay();
  if (game.phase === 'title' || game.phase === 'won' || game.phase === 'crashed') {
    resetGame(game, world);
  } else if (game.phase === 'landed') {
    game.phase = 'flying';
  }
  startBtn.textContent = 'FLY';
});

missionBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.ensure();
    const m = btn.dataset.mission;
    missionBtns.forEach((b) => b.classList.toggle('active', b === btn));
    game.mission = m;
    setMessage(game, `${MISSIONS[m].name}: ${MISSIONS[m].blurb}`, 4);
    if (game.phase === 'title') { hideOverlay(); resetGame(game, world); }
  });
});

input.onKey = (code) => {
  audio.ensure();
  if (code === 'KeyR') {
    hideOverlay();
    resetGame(game, world);
    setMessage(game, `${MISSIONS[game.mission].name} — good luck, courier.`, 3);
  } else if (code === 'KeyP' && game.phase === 'flying') {
    game.paused = !game.paused;
    setMessage(game, game.paused ? 'Paused' : 'Flying', 1.5);
  } else if (code === 'KeyM') {
    const muted = audio.toggleMute();
    setMessage(game, muted ? 'Sound off' : 'Sound on', 1.5);
  } else if (code === 'KeyF' && game.phase === 'flying') {
    game.plane.flaps = !game.plane.flaps;
    setMessage(game, game.plane.flaps ? 'Flaps down' : 'Flaps up', 1.5);
  } else if (code === 'KeyT' && game.phase === 'landed') {
    hideOverlay();
    game.phase = 'flying';
    game.plane.speed = 34;
    game.plane.throttle = 0.75;
    game.plane.pitch = 0.15; // rotate: climb away, don't settle back down
    game.plane.y += 3;
    game.landedBonusGiven = false;
    setMessage(game, 'Rolling again — mind the ridges.', 2.5);
  } else if (code === 'Enter' && (game.phase === 'title' || game.phase === 'won' || game.phase === 'crashed')) {
    startBtn.click();
  } else if (code === 'Digit1') {
    document.querySelector('[data-mission="rings"]').click();
  } else if (code === 'Digit2') {
    document.querySelector('[data-mission="landing"]').click();
  }
};

// --- Deterministic screenshot scenes -------------------------------------
// Each scene parks the plane in a composed, paused pose and renders one
// frame: cover (runway ahead), rings (ring over the valley), low (low pass
// over the river), landing (final approach). No randomness after setup.
function setupScene(name) {
  const p = game.plane;
  game.phase = 'scene';
  game.mission = name === 'landing' ? 'landing' : 'rings';
  game.time = name === 'cover' ? 42 : name === 'rings' ? 96 : name === 'low' ? 150 : 214;
  if (name === 'cover') {
    Object.assign(p, { x: -45, y: 75, z: 300, heading: 0, pitch: -0.02, roll: 0.04, speed: 48, throttle: 0.68, fuel: 82 });
    game.score = 0; game.ringsPassed = 0;
    setMessage(game, 'Ring Run — thread all 8 rings, then land.', 99);
  } else if (name === 'rings') {
    const ring = world.rings[2];
    Object.assign(p, { x: ring.x - 40, y: ring.y + 6, z: ring.z + 210, heading: 0.08, pitch: -0.03, roll: -0.06, speed: 52, throttle: 0.74, fuel: 64 });
    game.score = 200; game.ringsPassed = 2;
    setMessage(game, 'Ring 3 of 8 — straight ahead!', 99);
  } else if (name === 'low') {
    const rz = -760;
    Object.assign(p, { x: world.riverX(rz) + 8, y: 26, z: rz + 150, heading: -0.05, pitch: 0.02, roll: 0.10, speed: 58, throttle: 0.8, fuel: 47 });
    game.score = 400; game.ringsPassed = 4;
    setMessage(game, 'Low pass over the river — watch the ridges!', 99);
  } else if (name === 'landing') {
    Object.assign(p, { x: 10, y: 28, z: 180, heading: 0.02, pitch: -0.06, roll: 0.02, speed: 36, throttle: 0.34, fuel: 31, flaps: true });
    game.score = 800; game.ringsPassed = 8;
    setMessage(game, 'Final approach — flaps down, easy does it.', 99);
  } else {
    setupScene('cover');
    return;
  }
  // Mark the rings the scene's score says are already passed, so the
  // renderer's "next ring" logic matches the HUD.
  world.rings.forEach((r, i) => { r.passed = i < game.ringsPassed; });
  game.messageT = 99;
  drawScene(ctx, game, world, W, H);
}

// --- Main loop ------------------------------------------------------------
let last = performance.now();
let prevPhase = game.phase;
let prevRings = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.phase === 'flying' && !game.paused) {
    stepFlight(game, world, input.controls(), dt);
    if (game.ringsPassed < prevRings) prevRings = game.ringsPassed; // reset run
    if (game.ringsPassed > prevRings) { audio.chime(); prevRings = game.ringsPassed; }
    if (game.phase === 'crashed' || game.phase === 'won' || game.phase === 'landed') audio.thud();
  }
  if (game.phase !== prevPhase) {
    if (game.phase === 'won' || game.phase === 'crashed' || game.phase === 'landed') {
      if (game.score > game.best) game.best = game.score;
      endScreen();
    }
    prevPhase = game.phase;
  }
  audio.update(game.plane.throttle, game.plane.speed, game.phase === 'flying' && !game.paused);
  drawScene(ctx, game, world, W, H);
  requestAnimationFrame(frame);
}

if (sceneName) {
  setupScene(sceneName);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
