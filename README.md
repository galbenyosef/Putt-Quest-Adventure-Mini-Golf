# Putt Quest – Adventure Mini Golf

A complete 3D adventure mini-golf game that runs in the browser. Nine themed holes, first-person aiming,
toon-shaded graphics with custom GLSL shaders, and fully synthesised sound – **no asset files at all**
(every model, texture and sound is generated in code).

* **Stack:** Vite + Three.js (plain JavaScript), custom ball physics, Web Audio API
* **Static front end only:** no backend, API routes, database or environment variables. Best scores live in `localStorage`.

## Play it

| Action | Control |
| --- | --- |
| Aim | Move the mouse (the camera turns around your ball). Look up/down to raise or lower the view |
| Set power | **Hold the left button and drag back** (towards you / mouse down) – the power bar and the putter show how hard |
| Putt | Release the button (Right-click / `Esc` cancels a swing) |
| Fine aim | `←` `→` or `A` `D` (hold `Shift` for slower) |
| Overview | Hold `Space` for a bird's-eye view of the hole |
| Skip fly-over | Click or `Space` / `Enter` |
| Replay fly-over | `F` |
| Restart hole | `R` or the ↻ button |
| Mute | `M` or the speaker button |
| Pause / menu | `Esc` (also lets you **jump to any hole**, change sensitivity, or go back to the main menu) |

The game uses the browser's pointer lock for unlimited mouse rotation – click *Play* and it engages automatically.
If pointer lock isn't available it falls back to normal mouse movement.

**Rules:** 9 holes, each with a par. Water, lava and falling off the course cost one penalty stroke and put the ball
back where you last putted from. Every hole is capped at 10 strokes. You get a scorecard after each hole and a final
scorecard (with stars and a saved best round) at the end. Hole-in-ones, eagles and birdies get fireworks and confetti.

**Hole select:** *Choose a Hole* on the main menu (or *Jump to Hole* in the pause menu) starts practice play on any hole;
in practice play `[` and `]` hop to the previous / next hole.
You can also open a hole directly with `?hole=5` in the URL (`&fly=0` skips the fly-over, `&q=low` forces low quality).

## The nine holes

| # | Hole | Par | Signature challenge |
| --- | --- | --- | --- |
| 1 | **Sunny Meadow** | 2 | Rolling hill, dogleg and a tempting sand trap – a gentle warm-up |
| 2 | **Windmill Farm** | 3 | Putt through the archway under the **spinning windmill blades** – time the sweep |
| 3 | **Pirate Cove** | 3 | Ramp-jump across the bay, or take the boardwalk past a **swinging anchor** (water hazards, sharks, tentacles) |
| 4 | **Rex Territory** | 4 | A giant animated **T-Rex** straddles the fairway: slip under its snapping jaws, then dodge its sweeping tail |
| 5 | **Frostbite Peak** | 4 | Slippery **ice luge** with slalom pillars, then a rink with **sliding penguins** and an open, icy edge |
| 6 | **Crystal Caverns** | 4 | Rock **tunnel** or rail-less bridge, then a **portal** puzzle (blue = vault, red = back to the start) |
| 7 | **Gear Works** | 4 | Spinning gear-bars, **conveyor belts** over a slime pit, crushing **pistons**, a **boost pad** and a delivery belt to the cup |
| 8 | **Volcano Ridge** | 5 | Ride a **moving stone ferry** across the lava, climb the ridge, blast through a **vertical loop** over the crater |
| 9 | **Cosmic Pinball** | 5 | **Bumper** arena, boosted jump or **portal** shortcut, a sweeping laser-bar, and a **space elevator** to the crater cup |

Every hole is packed with ambient life: swaying grass and trees (wind shader), butterflies, sheep, ducks, sharks,
penguins, bats, robots, aliens, UFOs, waterfalls, torches, gears, lava bombs and more.

## Run it locally

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (outputs a static `dist/` folder):

```bash
npm run build
npm run preview    # serve the built site locally
```

## Deploy to Vercel

The project needs **zero configuration** – Vercel auto-detects Vite (`npm run build` → `dist/`).

1. Push this folder to a Git repository (GitHub/GitLab/Bitbucket) and import it at <https://vercel.com/new>, **or**
2. From this folder run `npx vercel` (and `npx vercel --prod` to promote), accepting the defaults.

There are no environment variables, serverless functions or storage integrations to set up.

## How it works

```
src/
  main.js, game.js       game flow: menu → fly-over → aim → charge → swing → roll → hazard/cup → scorecard
  physics.js             custom sub-stepped ball physics (ground triangles, wall capsules, kinematic colliders,
                         moving platforms, portals, boost pads, guided tubes/loops, cup)
  course.js              the course-builder DSL every hole is written with (ground, walls, bumpers, pipes, portals…)
  holes/h1.js … h9.js    the nine holes;  dino.js = the animated T-Rex
  props.js               scenery, critters, GPU particles
  render/                toon material + outline hulls + geometry batching, GLSL (sky, water, lava, grass, portals),
                         procedural textures, particles, bloom/vignette post-processing
  audio.js               Web Audio synthesis for every effect + a small generative music loop
  camera.js, putter.js   first-person/chase/fly-over camera, putter + aim guide
  ui.js, store.js        HUD, menus, scorecards; localStorage best scores
scripts/
  solve.mjs              headless solver – proves each hole can be completed with the game's own physics
  acerate.mjs            difficulty sanity check (how often a blind shot holes out)
```

* **Physics:** the ball is integrated at 240 Hz. The rendered ground mesh *is* the collision mesh, walls are rounded
  capsules and the step size is well below the ball radius, so the ball can't tunnel through walls or obstacles.
  Moving obstacles (windmill sails, dinosaur tail/jaws, pistons, spinners, ferries, lifts) are kinematic colliders that
  transfer their velocity to the ball.
* **Look:** MeshToonMaterial with a 3-step gradient ramp, inverted-hull outlines, merged geometry batches (a handful of draw
  calls per hole), shadow mapping, MSAA + bloom. The game lowers pixel ratio / disables bloom automatically if the frame
  rate drops.
* **Verification:** `npm run solve -- 8` searches for a full solution to hole 8 using the real physics (add
  `--debug` for search stats). All nine holes solve and re-verify (`for i in 1..9`).

Best scores are stored in your browser only (`localStorage`, key `puttquest.scores.v1`).
