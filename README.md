# Sky Courier: Ridge Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Mumet69/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Mumet69/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original flight game that plays offline in a desktop browser from its own static files. You are the courier pilot of a little red propeller plane over a procedural ridge valley — patchwork fields, a winding river, mountain ridges and one runway. Fly the chase view, thread the glowing rings, mind your fuel, and set her down gently on the runway.

## Missions

- **Ring Run** — thread all 8 rings down the valley (+100 each), then land on the runway for a landing bonus and a time bonus.
- **Landing Challenge** — fly the approach and land. Flaps help. A hard landing costs hull integrity; a crash ends the run.

Fuel drains with throttle; landing on the runway refuels you. Press **T** after a landing to take off again.

## Controls

- **Arrow keys** — pitch and roll (bank to turn)
- **W / S** — throttle up / down
- **A / D** — rudder (yaw)
- **Mouse drag** — steer
- **F** — flaps · **P** — pause · **M** — sound · **R** — restart · **1 / 2** — switch mission

Instruments are all lit on the panel: artificial horizon, airspeed and altitude dials, compass, throttle / fuel / hull gauges — plus a HUD with altitude, speed and heading.

## Sounds

WebAudio synth only — engine hum that follows throttle and speed, a ring chime, a landing thud, and wind. No audio files.

## Screenshots

Deterministic scenes via URL params, e.g. `?scene=cover|rings|low|landing&seed=7` — each renders a paused, composed frame of the game's own code.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Then open `game/index.html` in desktop Chrome and fly. Node 22+ required, no dependencies.

---

<sub>Entered on [make.fun](https://make.fun/?ref=x8txzvb2&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
