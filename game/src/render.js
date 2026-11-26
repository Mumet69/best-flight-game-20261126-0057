// render.js — everything Sky Courier: Ridge Run draws.
// One tiny job: sky, voxel terrain, rings, the aeroplane, the lit
// instruments and the HUD, all on one 2D canvas. No game logic here.
import { terrainHeight, groundColor, WORLD } from './world.js';
import { mulberry32 } from './seed.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapAngle = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

function makeClouds(seed) {
  const rng = mulberry32(seed * 31 + 5);
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({ az: rng() * TAU, y: 60 + rng() * 260, dist: 300 + rng() * 500, s: 40 + rng() * 90, a: 0.5 + rng() * 0.4 });
  }
  return clouds;
}

let cloudsCache = { seed: -1, clouds: [] };
function cloudsFor(seed) {
  if (cloudsCache.seed !== seed) cloudsCache = { seed, clouds: makeClouds(seed) };
  return cloudsCache.clouds;
}

// Project a world point to screen space. Returns null when behind camera.
function project(cam, fwd, right, p, f, cx, horizonY) {
  const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
  const along = dx * fwd.x + dz * fwd.z;
  if (along < 4) return null;
  const lat = dx * right.x + dz * right.z;
  return {
    x: cx + (lat / along) * f,
    y: horizonY - ((dy) / along) * f,
    d: along,
  };
}

export function drawScene(ctx, game, world, W, H) {
  const p = game.plane;
  const f = H * 0.62; // focal length in px
  const cx = W / 2;
  const horizonY = H * 0.44 + p.pitch * f * 0.35;

  // --- Sky ---
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  sky.addColorStop(0, '#2f6fd0');
  sky.addColorStop(0.55, '#7fb2e8');
  sky.addColorStop(1, '#dceefb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun, placed by heading so it stays put as you turn.
  const sunRel = wrapAngle(2.4 - p.heading);
  if (Math.abs(sunRel) < 1.2) {
    const sx = cx + (sunRel / 1.2) * W * 0.62;
    const sy = H * 0.16;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.35, 'rgba(255,220,120,0.55)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 95, sy - 95, 190, 190);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath(); ctx.arc(sx, sy, 26, 0, TAU); ctx.fill();
  }

  // Clouds.
  for (const c of cloudsFor(world.seed)) {
    const rel = wrapAngle(c.az - p.heading);
    if (Math.abs(rel) > 1.1) continue;
    const sx = cx + (rel / 1.1) * W * 0.6;
    const sy = H * 0.42 - (c.y / c.dist) * f * 0.55;
    const s = c.s * (420 / c.dist);
    ctx.fillStyle = `rgba(255,255,255,${c.a})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, s, s * 0.34, 0, 0, TAU);
    ctx.ellipse(sx - s * 0.55, sy + s * 0.08, s * 0.6, s * 0.26, 0, 0, TAU);
    ctx.ellipse(sx + s * 0.55, sy + s * 0.06, s * 0.62, s * 0.28, 0, 0, TAU);
    ctx.fill();
  }

  // --- Terrain: voxel heightfield, near to far, with roll applied. ---
  const fx = Math.sin(p.heading), fz = -Math.cos(p.heading);
  const rx = Math.cos(p.heading), rz = Math.sin(p.heading);
  // Chase camera: behind and above the plane.
  const cam = { x: p.x - fx * 17, y: p.y + 5.5, z: p.z - fz * 17 };
  const groundY = terrainHeight(world, cam.x, cam.z);
  if (cam.y < groundY + 2.5) cam.y = groundY + 2.5;

  // Hazy distant valley floor: from this camera height the ground plane
  // only reaches this far up the screen, so haze fills the gap to the
  // horizon and the ridge silhouette rises from it.
  const bandH = clamp(((cam.y + 4) * f) / WORLD.farView, 24, 130);
  const haze = ctx.createLinearGradient(0, horizonY, 0, horizonY + bandH);
  haze.addColorStop(0, '#b9c9d8');
  haze.addColorStop(1, '#a8b98f');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY, W, bandH + 2);
  ctx.fillStyle = 'rgba(88,108,148,0.6)';
  ctx.beginPath();
  ctx.moveTo(0, horizonY + bandH + 2);
  for (let sx = 0; sx <= W; sx += 16) {
    const t = sx / W * 6 + p.heading * 1.4;
    const mh = 14 + 46 * Math.abs(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 0.9 + 2) * 0.4);
    ctx.lineTo(sx, horizonY + bandH + 2 - mh);
  }
  ctx.lineTo(W, horizonY + bandH + 2);
  ctx.closePath();
  ctx.fill();

  const COLS = 320;
  const colW = W / COLS;
  const maxY = new Float32Array(COLS).fill(H);
  const panelTop = H - 132;

  ctx.save();
  ctx.translate(cx, horizonY);
  ctx.rotate(-p.roll * 0.45);
  ctx.translate(-cx, -horizonY);
  ctx.beginPath();
  ctx.rect(0, 0, W, panelTop);
  ctx.clip();

  // Near-to-far: the nearest strip owns the bottom of each column, and
  // farther strips only fill in above it (the y-buffer).
  let d = 7;
  while (d < WORLD.farView) {
    const spread = d * 0.62; // half-width of the sampled line at this depth
    for (let i = 0; i < COLS; i++) {
      const nx = (i + 0.5) / COLS * 2 - 1; // -1..1
      const wx = cam.x + fx * d + rx * nx * spread;
      const wz = cam.z + fz * d + rz * nx * spread;
      const h = terrainHeight(world, wx, wz);
      const sy = horizonY - ((h - cam.y) * f) / d;
      const top = clamp(sy, 0, panelTop);
      if (top < maxY[i]) {
        ctx.fillStyle = groundColor(world, wx, wz, h);
        ctx.fillRect(i * colW, top, colW + 0.6, maxY[i] - top);
        maxY[i] = top;
      }
    }
    d /= 0.90;
  }
  ctx.restore();

  // --- Rings: only the next target (gold, labelled) and the one after it,
  // so the view stays readable instead of a cluster of distant hoops. ---
  const nextIdx = world.rings.findIndex((r) => !r.passed);
  for (let ri = 0; ri < world.rings.length; ri++) {
    const ring = world.rings[ri];
    if (ring.passed) continue;
    if (nextIdx >= 0 && ri > nextIdx + 1) continue;
    const pr = project(cam, { x: fx, z: fz }, { x: rx, z: rz }, ring, f, cx, horizonY);
    if (!pr || pr.x < -80 || pr.x > W + 80 || pr.y < -40 || pr.y > panelTop) continue;
    const rr = (ring.r * f) / pr.d;
    if (rr < 12) continue; // too far to read: skip the ring and its label
    const pulse = 1 + 0.06 * Math.sin(game.time * 4 + ring.z);
    ctx.lineWidth = Math.max(2, rr * 0.10);
    ctx.strokeStyle = ri === nextIdx ? '#ffb020' : 'rgba(255,176,32,0.45)';
    ctx.shadowColor = '#ff8c00'; ctx.shadowBlur = ri === nextIdx ? 14 : 0;
    ctx.beginPath(); ctx.ellipse(pr.x, pr.y, rr * pulse, rr * pulse * 0.94, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, rr * 0.03);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(pr.x, pr.y, rr * pulse, rr * pulse * 0.94, 0, 0, TAU); ctx.stroke();
    // Distance label, on the next ring only.
    if (ri === nextIdx) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(11, Math.min(18, rr * 0.5))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(pr.d)} m`, pr.x, pr.y - rr - 8);
    }
  }

  // --- The aeroplane (chase view), banking with roll. ---
  drawPlane(ctx, W, H, p);

  // --- Instruments + HUD ---
  drawPanel(ctx, game, W, H);
  drawHUD(ctx, game, world, W, H);
}

function drawPlane(ctx, W, H, p) {
  const cx = W / 2, cy = H * 0.56;
  const s = H / 800; // scale with canvas height
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.roll * 0.55);
  ctx.scale(s, s);
  // Propeller: seen face-on from behind, a translucent disc with blades.
  const spin = (p.speed * 0.9) % (Math.PI * 2);
  ctx.fillStyle = 'rgba(210,220,235,0.30)';
  ctx.beginPath(); ctx.arc(0, -128, 30, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,70,85,0.55)'; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -128);
  ctx.lineTo(Math.cos(spin) * 28, -128 + Math.sin(spin) * 28);
  ctx.moveTo(0, -128);
  ctx.lineTo(-Math.cos(spin) * 28, -128 - Math.sin(spin) * 28);
  ctx.stroke();
  // Main wings (cream with red tips).
  ctx.fillStyle = '#f3e2b8';
  ctx.beginPath();
  ctx.moveTo(-152, -52); ctx.lineTo(152, -52); ctx.lineTo(140, -26); ctx.lineTo(-140, -26);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-152, -52, 26, 26); ctx.fillRect(126, -52, 26, 26);
  // Tailplane: nearest the camera, so it reads wide and low.
  ctx.fillStyle = '#f3e2b8';
  ctx.beginPath();
  ctx.moveTo(-84, 92); ctx.lineTo(84, 92); ctx.lineTo(68, 114); ctx.lineTo(-68, 114);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-84, 92, 18, 22); ctx.fillRect(66, 92, 18, 22);
  // Fuselage: tapered — narrow at the far nose, wide at the near tail.
  const body = ctx.createLinearGradient(0, -140, 0, 116);
  body.addColorStop(0, '#8e2b20'); body.addColorStop(0.55, '#d94f3d'); body.addColorStop(1, '#b03a2c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-9, -140);
  ctx.quadraticCurveTo(-20, -70, -24, -10);
  ctx.quadraticCurveTo(-30, 60, -34, 104);
  ctx.quadraticCurveTo(0, 120, 34, 104);
  ctx.quadraticCurveTo(30, 60, 24, -10);
  ctx.quadraticCurveTo(20, -70, 9, -140);
  ctx.closePath(); ctx.fill();
  // Tail fin (seen from behind, rising above the tailplane).
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-12, 96); ctx.lineTo(12, 96); ctx.lineTo(7, 58); ctx.lineTo(-7, 58);
  ctx.closePath(); ctx.fill();
  // Cockpit window, far up the nose.
  ctx.fillStyle = '#bfe3f5';
  ctx.beginPath(); ctx.ellipse(0, -86, 11, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-3, -92, 4, 10, 0.2, 0, TAU); ctx.fill();
  // Nose + spinner.
  ctx.fillStyle = '#f3e2b8';
  ctx.beginPath(); ctx.ellipse(0, -136, 10, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(0, -128, 6, 0, TAU); ctx.fill();
  // Courier stripe + registration.
  ctx.fillStyle = '#f3e2b8';
  ctx.fillRect(-27, 6, 54, 6);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SKY COURIER', 0, 40);
  ctx.restore();
}

function drawPanel(ctx, game, W, H) {
  const p = game.plane;
  const top = H - 132;
  ctx.fillStyle = '#1b1e26';
  ctx.fillRect(0, top, W, 132);
  ctx.fillStyle = '#2c3040';
  ctx.fillRect(0, top, W, 4);
  ctx.strokeStyle = '#3a3f52'; ctx.lineWidth = 1;
  ctx.strokeRect(0.5, top + 0.5, W - 1, 131);

  const cy = top + 62;
  drawHorizon(ctx, 92, cy, 46, p);
  drawDial(ctx, 210, cy, 46, 'AIRSPEED', `${Math.round(p.speed * 1.94)}`, 'kt', p.speed / 70);
  drawDial(ctx, 328, cy, 46, 'ALTITUDE', `${Math.round(p.y)}`, 'm', clamp(p.y / 220, 0, 1));
  drawCompass(ctx, W / 2, cy, p.heading);
  drawGauge(ctx, W - 300, top + 16, 22, 84, 'THROTTLE', p.throttle, '#ffb020');
  drawGauge(ctx, W - 210, top + 16, 22, 84, 'FUEL', p.fuel / 100, p.fuel > 25 ? '#4fc94f' : '#e5484d');
  drawGauge(ctx, W - 120, top + 16, 22, 84, 'HULL', p.integrity / 100, p.integrity > 40 ? '#4fc94f' : '#e5484d');
}

function drawHorizon(ctx, x, y, r, p) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-p.roll);
  ctx.translate(0, p.pitch * r * 1.4);
  ctx.fillStyle = '#3f8fd2'; ctx.fillRect(-r, -r, r * 2, r);
  ctx.fillStyle = '#8a6b42'; ctx.fillRect(-r, 0, r * 2, r);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-r, -1, r * 2, 2);
  ctx.restore();
  ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  // Fixed wings marker.
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(x - 26, y); ctx.lineTo(x - 8, y); ctx.lineTo(x - 8, y + 4); ctx.lineTo(x - 26, y + 4);
  ctx.moveTo(x + 26, y); ctx.lineTo(x + 8, y); ctx.lineTo(x + 8, y + 4); ctx.lineTo(x + 26, y + 4);
  ctx.fill();
  ctx.fillStyle = '#c8cede'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('HORIZON', x, y + r + 13);
}

function drawDial(ctx, x, y, r, label, value, unit, frac) {
  ctx.save();
  ctx.fillStyle = '#10131a';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  // Ticks.
  ctx.strokeStyle = '#c8cede'; ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
    ctx.lineTo(x + Math.cos(a) * (r - 11), y + Math.sin(a) * (r - 11));
    ctx.stroke();
  }
  const a = Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = '#ff5a4d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14)); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(value, x, y + 4);
  ctx.fillStyle = '#8b93a7'; ctx.font = '10px sans-serif';
  ctx.fillText(unit, x, y + 18);
  ctx.fillStyle = '#c8cede'; ctx.font = 'bold 10px sans-serif';
  ctx.fillText(label, x, y + r + 13);
  ctx.restore();
}

function drawCompass(ctx, x, y, heading) {
  const r = 52;
  ctx.save();
  ctx.fillStyle = '#10131a';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  ctx.fillStyle = '#e8ecf2'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - heading;
    const px = x + Math.sin(a) * (r - 16), py = y - Math.cos(a) * (r - 16) + 4;
    ctx.fillText(pts[i], px, py);
  }
  // Lubber line + heading readout.
  ctx.fillStyle = '#ff5a4d';
  ctx.beginPath(); ctx.moveTo(x - 6, y - r + 2); ctx.lineTo(x + 6, y - r + 2); ctx.lineTo(x, y - r + 12); ctx.closePath(); ctx.fill();
  const deg = ((Math.round((-heading * 180) / Math.PI) % 360) + 360) % 360;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${String(deg).padStart(3, '0')}°`, x, y + 6);
  ctx.fillStyle = '#c8cede'; ctx.font = 'bold 10px sans-serif';
  ctx.fillText('HEADING', x, y + r + 13);
  ctx.restore();
}

function drawGauge(ctx, x, y, w, h, label, frac, color) {
  ctx.fillStyle = '#10131a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3a3f52'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const fh = clamp(frac, 0, 1) * (h - 4);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + h - 2 - fh, w - 4, fh);
  ctx.fillStyle = '#c8cede'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h + 13);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`${Math.round(clamp(frac, 0, 1) * 100)}%`, x + w / 2, y - 6);
}

function drawHUD(ctx, game, world, W, H) {
  const p = game.plane;
  const deg = ((Math.round((-p.heading * 180) / Math.PI) % 360) + 360) % 360;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  ctx.fillRect(12, 12, 300, 86);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`ALT ${Math.round(p.y)} m`, 24, 40);
  ctx.fillText(`SPD ${Math.round(p.speed * 1.94)} kt`, 24, 66);
  ctx.fillText(`HDG ${String(deg).padStart(3, '0')}°`, 24, 90);

  // Centre: mission + progress + timer.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  ctx.fillRect(W / 2 - 190, 12, 380, 56);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 16px sans-serif';
  const missionName = game.mission === 'rings' ? 'RING RUN' : 'LANDING CHALLENGE';
  ctx.fillText(missionName, W / 2, 33);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  const ringsTxt = game.mission === 'rings'
    ? `Rings ${game.ringsPassed} / ${world.rings.length}`
    : 'Land on the runway';
  ctx.fillText(`${ringsTxt}   ·   ${fmtTime(game.time)}`, W / 2, 55);

  // Right: score + fuel bar.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  ctx.fillRect(W - 212, 12, 200, 86);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`SCORE ${game.score}`, W - 24, 40);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  ctx.fillText(`FUEL ${Math.round(p.fuel)}%`, W - 24, 66);
  ctx.fillStyle = '#222';
  ctx.fillRect(W - 188, 74, 164, 10);
  ctx.fillStyle = p.fuel > 25 ? '#4fc94f' : '#e5484d';
  ctx.fillRect(W - 188, 74, 164 * clamp(p.fuel / 100, 0, 1), 10);

  // Transient message.
  if (game.messageT > 0 && game.message) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = 'rgba(10,14,22,0.6)';
    const tw = ctx.measureText(game.message).width + 36;
    ctx.fillRect(W / 2 - tw / 2, 108, tw, 40);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(game.message, W / 2, 135);
  }

  // Low fuel warning.
  if (p.fuel < 25 && game.phase === 'flying') {
    ctx.textAlign = 'center';
    ctx.fillStyle = Math.floor(game.time * 2) % 2 ? '#ff5a4d' : '#ffb020';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('LOW FUEL — LAND ON THE RUNWAY', W / 2, H - 150);
  }
}

export function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
