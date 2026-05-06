// SIM XR — scene preview asset map.
//
// Extracted out of Dashboard.tsx 2026-05-06 so the new /recordings route can
// reuse the same id → media mapping without forcing the Dashboard chunk to
// load. When we ship per-scene custom previews via the recordings sidecar
// pipeline, this map is the single place to update.

export type SceneAsset = { type: "image" | "video"; src: string; poster?: string };

export const SCENE_ASSETS: Record<string, SceneAsset> = {
  "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0": {
    type: "video",
    src: "/operator/videos/mission-pour.mp4",
    poster: "/operator/images/mission-pour.png",
  },
  "Isaac-PickPlace-GR1T2-Abs-v0": {
    // Custom Pick & Place GR1T2 clip — Mike's hand-picked footage 2026-05-03.
    type: "video",
    src: "/operator/videos/pickplace-gr1t2.mp4",
  },
  "Isaac-PickPlace-GR1T2-WaistEnabled-Abs-v0": {
    // Inherited the looping arena gif from Locomanip-G1 (Mike's swap 2026-05-03):
    // Locomanip-G1 got a custom mp4 of the actual scene we connected to,
    // and this card keeps the previously-shared placeholder for now.
    type: "image",
    src: "/operator/images/task-references/g1_galileo_arena_box_pnp_locomanip.gif",
  },
  "Isaac-ExhaustPipe-GR1T2-Pink-IK-Abs-v0": {
    // Custom Exhaust Pipe Assembly clip — Mike swapped 2026-05-03 evening
    // to a more accurate clip ("robot reaching for the pipe"). Same path,
    // new file content; the previous clip moved to the G1+Inspire card.
    type: "video",
    src: "/operator/videos/exhaust-pipe-gr1t2.mp4",
  },
  "Isaac-PickPlace-G1-InspireFTP-Abs-v0": {
    // Inherited the previous Exhaust Pipe mp4 (renamed) per Mike's reshuffle
    // 2026-05-03. Robot manipulating cup, fits the dexterous Inspire-hand pick.
    type: "video",
    src: "/operator/videos/pickplace-g1-inspire.mp4",
  },
  "Isaac-PickPlace-Locomanipulation-G1-Abs-v0": {
    // Custom clip of the actual Locomanip-G1 scene we connected to via VR
    // 2026-05-03 — Mike's hand-picked footage, not a generic operator
    // placeholder. When we ship per-scene preview pipeline, swap here.
    type: "video",
    src: "/operator/videos/locomanip-g1.mp4",
  },
  "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-Abs-v0": {
    type: "image",
    src: "/operator/images/task-references/franka_kitchen_pickup.gif",
  },
  "Isaac-PickPlace-Locomanipulation-G1-3DGS-Abs-v0": {
    // Inherited the kitchen_gr1_arena gif from the G1+Inspire card per
    // Mike's reshuffle 2026-05-03. Card stays in 'broken' visual state
    // anyway (3DGS stereo bug); cosmos-reasoning gif unused for now.
    type: "image",
    src: "/operator/images/task-references/kitchen_gr1_arena.gif",
  },
  "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-3DGS-Abs-v0": {
    type: "image",
    src: "/operator/images/task-references/scene-isaac-groot-loop.gif",
  },
  "Isaac-PickPlace-Locomanipulation-G1-3DGS-BrightLivingRoom-Abs-v0": {
    // Reusing locomanip-g1.mp4 same as Locomanipulation-G1-Abs-v0 per Mike
    // 2026-05-06 (this is the same scene visually, just with a different
    // 3DGS background from old-server import).
    type: "video",
    src: "/operator/videos/locomanip-g1.mp4",
  },
  "Isaac-PickPlace-G1-InspireFTP-3DGS-BrightLivingRoom-Abs-v0": {
    // Hand-tracking variant of the bright living room scene — pairs G1 +
    // Inspire dexterous hands with WebXR HandsSource (no controllers). Reuses
    // the G1+Inspire kitchen-arena-style preview until a custom clip lands.
    type: "video",
    src: "/operator/videos/pickplace-g1-inspire.mp4",
  },
};

// Robot family label for tags (more descriptive than the bare token).
export function robotLabel(id: string): string {
  if (id.includes("GR1T2")) return "Fourier GR1T2";
  if (id.includes("G1-InspireFTP")) return "Unitree G1 + Inspire";
  if (id.includes("-G1-")) return "Unitree G1";
  return "Robot";
}

// Skill / variant label derived from scene id — tag chip on cards.
export function skillTag(id: string): string {
  if (id.includes("NutPour")) return "Pink-IK · Pour";
  if (id.includes("ExhaustPipe")) return "Assembly";
  if (id.includes("Locomanipulation")) return "Locomanipulation";
  if (id.includes("FixedBase")) return "Fixed-base · Upper body IK";
  if (id.includes("WaistEnabled")) return "Waist-enabled";
  if (id.includes("InspireFTP")) return "Dexterous";
  if (id.includes("PickPlace")) return "Bimanual";
  return "Manipulation";
}
