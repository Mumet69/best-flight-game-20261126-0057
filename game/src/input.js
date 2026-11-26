// input.js — keyboard + mouse steering for Sky Courier: Ridge Run.
// One tiny job: turn raw keys and pointer drags into a control vector
// { pitch, roll, yaw, throttle } in [-1, 1], plus one-shot key events.
export function makeInput() {
  const keys = new Set();
  const state = {
    keys,
    mouse: { active: false, x: 0, y: 0 }, // -1..1 offsets from screen centre
    onKey: null, // (code) => void, set by main.js for one-shot actions
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      keys.add(e.code);
      if (state.onKey) state.onKey(e.code);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', (e) => {
    state.mouse.active = true;
    canvas.setPointerCapture(e.pointerId);
    updateMouse(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (state.mouse.active) updateMouse(e); });
  const end = () => { state.mouse.active = false; state.mouse.x = 0; state.mouse.y = 0; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function updateMouse(e) {
    const r = canvas.getBoundingClientRect();
    state.mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    state.mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }

  // Control vector for this frame. Keyboard and mouse blend: the mouse
  // steers gently, the keys always win when held, so the camera (which
  // follows the plane) never fights the pilot.
  state.controls = () => {
    let pitch = 0, roll = 0, yaw = 0, throttle = 0;
    if (keys.has('ArrowUp')) pitch -= 1;
    if (keys.has('ArrowDown')) pitch += 1;
    if (keys.has('ArrowLeft')) roll -= 1;
    if (keys.has('ArrowRight')) roll += 1;
    if (keys.has('KeyA')) yaw += 1;
    if (keys.has('KeyD')) yaw -= 1;
    if (keys.has('KeyW')) throttle += 1;
    if (keys.has('KeyS')) throttle -= 1;
    if (state.mouse.active) {
      pitch += state.mouse.y * 0.7;
      roll += state.mouse.x * 0.9;
    }
    const c = (v) => Math.max(-1, Math.min(1, v));
    return { pitch: c(pitch), roll: c(roll), yaw: c(yaw), throttle: c(throttle) };
  };

  return state;
}
