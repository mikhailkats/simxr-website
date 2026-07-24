# Sim XR Article Hero Cover

## Final direction

The cover visualizes the article’s operating mechanism rather than a generic
robotics scene: a remote VR operator provides human intent, recorded
trajectories bridge the distance, and a humanoid policy performs the mustard
task inside an unmistakable simulation environment.

The selected composition was the strongest of three generated studies because
it keeps the operator, trajectory bridge, simulated robot, mustard bottle, and
bowl legible in both 16:9 and 1.91:1 crops. The illustration is synthetic. The
benchmark text is factual and added separately by the deterministic renderer.

## Final generation prompt

> Make one precise semantic correction to the selected wide 16:9 editorial
> robotics image and preserve everything else: place the entire closed yellow
> mustard bottle physically inside the wooden bowl, resting diagonally as a
> solid object. The robot hand should be open or just releasing the bottle
> after placement. The cap remains visibly closed. There must be no liquid, no
> stream, no squeezing, no nozzle aimed into the bowl, and no visual suggestion
> of pouring. This is an object pick-and-place task: bottle into bowl. Preserve
> the remote VR operator, blue trajectory strands, bright white negative title
> area, simulated grid, camera frustums, ghost poses, humanoid, camera angle,
> colors, and 16:9 composition. Do not add text, logos, UI, or a watermark.

## Exports

- `hero-medium-1600x900.jpg` — Medium story hero.
- `hero-linkedin-article-1920x1080.jpg` — LinkedIn article cover.
- `hero-linkedin-link-preview-1200x627.jpg` — LinkedIn shared-link preview.
- `hero-master-1920x1080.png` — lossless master.
- `source/render_cover.py` — deterministic logo, typography, and crop renderer.
- `source/hero-generated-base.png` — selected generated illustration.

Suggested alt text:

> A remote VR operator’s hand trajectories connect to a humanoid robot moving
> a yellow mustard bottle into a wooden bowl inside a simulation environment.
