# 10 canonical NVIDIA / Isaac benchmark tasks — easy → hard

Reference list for the operator landing's tasks section. These are the manipulation tasks that recur across NVIDIA's public-facing robotics ecosystem: Isaac Lab Arena demos, GR00T benchmarks, RoboCasa, and the GTC 2026 keynotes. Use them as the seed for generating ten in-style images for the public `simxr-operator.netlify.app` task cards.

The actual GIFs/images downloaded into this folder are licensed Apache 2.0 (IsaacLab-Arena) or part of the open RoboCasa benchmark — fine as **reference**, replace with our own renders before publishing.

---

## Tier 1 — Simple (single-step, no deformables)

### 1. Lift / Pick a cube
- **Robot:** Franka Panda arm
- **Skill:** grasp + lift a single rigid object
- **Why canonical:** "Hello world" of Isaac Lab RL benchmarks; the Dexsuite Kuka Allegro Lift task is a humanoid-hand variant.
- **Reference:** [Isaac Lab Arena · Franka Lift Object](https://isaac-sim.github.io/IsaacLab-Arena/main/pages/example_workflows/reinforcement_learning/index.html)
- **Suggested SIM XR card:** `LIFT · cube` · EASY · ~1 min

### 2. Pick & place an object on a target receptacle
- **Robot:** Franka or GR1
- **Skill:** grasp object A, transport to target B (plate, basket, placemat, shelf)
- **Why canonical:** The base rearrange-A-from-B-to-C pattern across all 24 RoboCasa GR1 tabletop tasks; also the example task in Isaac Lab Arena docs (Franka Kitchen Pickup of a tomato soup can).
- **Reference:** [Isaac Lab Arena · Franka Kitchen Pickup](https://isaac-sim.github.io/IsaacLab-Arena/main/) (GIF: `franka_kitchen_pickup.gif` here)
- **Suggested card:** `PICK & PLACE · soup can → counter` · EASY · ~2 min

### 3. Stack two cubes
- **Robot:** Franka or GR1
- **Skill:** precise vertical stacking, requires accurate placement under gravity
- **Why canonical:** The other "hello world" of robot manipulation. Used in nearly every Mimic dataset paper.
- **Reference:** [Isaac Lab Mimic — stack-cube task](https://isaac-sim.github.io/IsaacLab/main/source/overview/imitation-learning/index.html)
- **Suggested card:** `STACK · two cubes` · EASY · ~2 min

---

## Tier 2 — Medium (multi-step, kitchen, articulated objects)

### 4. Open a drawer
- **Robot:** Franka or GR1
- **Skill:** grasp handle, pull along constrained axis
- **Why canonical:** Standard articulated-object benchmark; Isaac Lab `Isaac-Open-Drawer-Franka-v0`.
- **Reference:** [Isaac Lab — Open Drawer task family](https://isaac-sim.github.io/IsaacLab/main/source/api/lab/isaaclab.envs.html)
- **Suggested card:** `OPEN · drawer pull` · MED · ~3 min

### 5. Open microwave door
- **Robot:** GR1 (humanoid, single-arm)
- **Skill:** locate handle, swing door through arc
- **Why canonical:** The IsaacLab-Arena static-manipulation showcase task — GIF here as `kitchen_gr1_arena.gif`.
- **Reference:** [Isaac Lab Arena · GR1 Open Microwave](https://isaac-sim.github.io/IsaacLab-Arena/main/pages/example_workflows/static_manipulation/index.html)
- **Suggested card:** `OPEN · microwave door` · MED · ~3 min

### 6. Mug on coffee machine / mug on rack
- **Robot:** GR1 single-arm
- **Skill:** tactile placement on a small target with rim alignment
- **Why canonical:** RoboCasa / Mimic standard; one of the hand-picked tasks in the GR00T N1.5 evaluation suite.
- **Reference:** [RoboCasa GR1 Tabletop Tasks](https://github.com/robocasa/robocasa-gr1-tabletop-tasks) (master figure: `robocasa-gr1-task-suite.png` here)
- **Suggested card:** `PLACE · mug on coaster` · MED · ~4 min

### 7. Box pick-and-place with locomotion
- **Robot:** Unitree G1 (whole-body humanoid)
- **Skill:** walk to source, bend, grasp, walk to target, place
- **Why canonical:** The flagship loco-manipulation showcase in IsaacLab-Arena 0.2 — GIF here as `g1_galileo_arena_box_pnp_locomanip.gif`.
- **Reference:** [Isaac Lab Arena · G1 Locomanipulation](https://isaac-sim.github.io/IsaacLab-Arena/main/pages/example_workflows/locomanipulation/index.html)
- **Suggested card:** `LOCO-MANI · transport box` · MED · ~5 min

---

## Tier 3 — Hard (long-horizon, contact-rich, bimanual, deformable)

### 8. Pour from beaker into bowl (NutPour)
- **Robot:** Fourier GR1T2 (bimanual)
- **Skill:** pick beaker, pour controlled stream, place down — verified in our own Sim XR GR1T2 NutPour pipeline (memory: `project_arena_native_gr1_pivot_candidate`).
- **Why canonical:** The bimanual showcase task in Isaac Lab `Isaac-NutPour-GR1T2-*-v0` family; also the example in NVIDIA's official "pour" capability description.
- **Reference:** [NVIDIA Isaac Lab release notes — NutPour env](https://isaac-sim.github.io/IsaacLab/main/source/refs/release_notes.html)
- **Suggested card:** `POUR · beaker → bowl` · HARD · ~6 min

### 9. Peg-in-hole / insertion
- **Robot:** Franka (single-arm) or bimanual humanoid
- **Skill:** sub-millimetre alignment under contact; the gold-standard contact-rich benchmark.
- **Why canonical:** Ubiquitous in Isaac Lab assembly suite; used in industrial demos at GTC.
- **Reference:** [Isaac Lab — Insertion / Assembly tasks](https://isaac-sim.github.io/IsaacLab/main/source/api/lab/isaaclab.envs.html)
- **Suggested card:** `INSERT · peg in hole` · HARD · ~5 min

### 10. Fold a t-shirt or cloth
- **Robot:** Bimanual humanoid (GR1T2 or G1)
- **Skill:** deformable manipulation — the unsolved frontier task NVIDIA repeatedly showcases.
- **Why canonical:** Newton-physics cloth-fold demo at GTC 2026 keynote; subject of the Isaac Lab + Newton blog post.
- **Reference:** [Train Quadruped + Cloth Manipulation with Isaac Lab + Newton](https://developer.nvidia.com/blog/train-a-quadruped-locomotion-policy-and-simulate-cloth-manipulation-with-nvidia-isaac-lab-and-newton/)
- **Suggested card:** `FOLD · t-shirt` · HARD · ~8 min

---

## Files in this folder

| File | What it is | License |
|------|------------|---------|
| `franka_kitchen_pickup.gif` | Tier 1 / task #2 reference. From IsaacLab-Arena docs. | Apache 2.0 |
| `kitchen_gr1_arena.gif` | Tier 2 / task #5 reference. GR1 microwave open. | Apache 2.0 |
| `g1_galileo_arena_box_pnp_locomanip.gif` | Tier 2 / task #7 reference. G1 box transport. | Apache 2.0 |
| `robocasa-gr1-task-suite.png` | Master figure showing the 24 RoboCasa tabletop variants — covers tasks #2 and #6 visually. | Apache 2.0 |

Tasks #1, #3, #4, #8, #9, #10 don't have official NVIDIA still images in this folder. For those, work from the descriptions above plus any reference frames you grab from the linked source pages.

---

## Generation prompt template (same look as our existing operator-app images)

When generating each task card thumbnail, use the same aesthetic anchors as `simxr_robot_1.png` and `task-bimanual-mug.png` — warm wood, neutral grey-beige floor, slight blue volumetric haze, photoreal render. Drop the target file as `web/operator/images/task-<NN>-<short-name>.png` (e.g. `task-01-lift-cube.png`).

```
A photorealistic top-down OR three-quarter view of a [robot model] performing
[TASK DESCRIPTION FROM ABOVE]. Warm wooden tabletop, neutral grey-beige floor
with faint perspective grid, soft natural light from upper left. Slight cool-blue
volumetric haze for depth. Robot arms and target objects are the focus —
no clutter, no background characters. Cinematic photoreal style, high-end
industrial design catalog aesthetic. Square 1:1 framing or 16:10 wide.
No text, no logos, no UI overlays, no humans in the frame.
```

When all ten are produced, I'll wire them into the six task cards on the operator landing (we'll need to expand the grid from 6 to 10, or pick the 6 strongest for v0 + keep the rest for the later "open tasks" page).
