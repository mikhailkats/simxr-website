# Media Manifest

## Article image package

The publication-ready article images are stored separately in `article-images/`
and numbered in recommended reading order. Captions, alt text, placement, and
evidence boundaries are documented in `article-image-guide.md`. A single review
sheet is available at `article-image-contact-sheet.jpg`.

The article now uses eight images:

1. remote XR teleoperation title card;
2. NVIDIA pipeline and 208-demo / 93-of-100 benchmark;
3. Sim XR remote path and 50-demo / 84-of-100 result;
4. targeted right-side data, 0/20 to 74/100;
5. matched spatial robustness, 80.0% to 89.6%;
6. mustard collection, one operator and 50 successful demonstrations;
7. mustard policy comparison, 0/30 to 27/30;
8. preview of the next environment and embodiment experiments.

## Publication assets

| Placement | Asset | Provenance | Status |
|---|---|---|---|
| Article hero | `media/video-cover-v2.jpg` | Frame from the revised Sim XR case-study video | Ready |
| Spatial intervention | `media/spatial-success-rate-delta.png` | Matched 500 + 500 episode experiment | Ready |
| Baseline overview | `media/baseline-contact-sheet.png` | Original checkpoint rollouts | Ready |
| Augmented overview | `media/augmented-contact-sheet.png` | Pose-augmented checkpoint rollouts | Ready |
| Mustard candidate | `media/mustard-candidate-headcam.png` | Robot-head-camera frame extracted from Misha’s linked experiment artifact | Ready |
| Mustard task scene | `media/mustard-final-scene.png` | Final mustard-to-bowl layout extracted from Misha’s linked experiment artifact | Ready |
| Mustard follow-ups | `media/mustard-followup-environments-and-hands.png` | Scanned environment, GR1T2, and Inspire FTP frames from Misha’s linked experiment artifact | Ready |
| Final master | `../remotion_case_study_20260724/project/out/sim_xr_gr00t_case_study_20260724_v7_male_voice_master.mp4` | Final 90-second 16:9 Sim XR edit with the revised opening title, natural American male narration, screen-synchronised NVIDIA and Sim XR metrics, next-video teaser, and continuous music ending | Ready and validated |
| Final social video | `../remotion_case_study_20260724/project/out/sim_xr_gr00t_case_study_20260724_v7_male_voice_720p.mp4` | Compressed 16:9 derivative of the final male-voice revision | Ready and validated |
| NVIDIA pipeline QA still | `../remotion_case_study_20260724/project/qa/revision-05/nvidia-pipeline-v2.png` | Final pipeline explainer frame | Ready and visually checked |
| Remote collection QA still | `../remotion_case_study_20260724/project/qa/revision-05/remote-50-demos.png` | Final 208/93 versus 50/84 remote-collection comparison | Ready and visually checked |
| Targeted collection QA still | `../remotion_case_study_20260724/project/qa/revision-05/targeted-loop-v2.png` | Final old-policy failure versus targeted-data recovery frame | Ready and visually checked |

## Existing evidence reused in the video

- NVIDIA released training episodes: `original_000000.mp4`, `original_000050.mp4`, `original_000100.mp4`.
- Sim XR Quest-trained policy rollout: `quest_vr_policy_rollout.mp4`.
- Canonical reproduction rollout: `final_static_apple_policy_rollout.mp4`.
- Targeted pose-collection clips: four robot-head-camera videos.
- Matched representative before/after rollouts at the same coordinate.
- Camera-safe left/right layout images from the Quest experiment.
- Mustard task frames and six embedded videos from Misha’s linked experiment artifact.

## Evidence boundary

The mustard-to-bowl segment now uses the original embedded operator, baseline,
trained-policy, and scanned-room clips from Misha’s linked experiment artifact.
The 0/30 → 27/30 comparison remains the core validated policy result. Follow-up
GR1T2 and Inspire FTP images are labeled as simulation and teleoperation
acceptance checks, not as proof that one checkpoint transfers between
embodiments.

The Oregon server remains inaccessible from this workstation with the available
SSH key, so no additional frontal camera was rendered.

## Audio status

The final master contains ten English narration blocks generated with the
American ElevenLabs Eric voice and a 90-second instrumental score generated
with ElevenLabs Music. The narration explicitly connects NVIDIA's published
Isaac Lab → LeRobot → GR00T N1.7 → Arena recipe to Sim XR's 50-demo remote
collection result and the targeted follow-up experiments. Spoken references
use “VLA fine-tuning” instead of pronouncing the GR00T product name. The
NVIDIA 208-demo / 93-of-100 narration finishes on the NVIDIA benchmark screen;
the remote 50-demo / 84-of-100 narration begins on the following Sim XR
screen. The generated score's active original performance was stretched by
approximately 5.6% to fill the complete timeline as one continuous piece,
removing the previous repeated-tail splice. The final stereo AAC mix is 48 kHz
and fully decodes without errors. The local credential is excluded from Git.

## Recommended additional capture

If the Oregon server becomes accessible:

1. Confirm no active Kit/container job.
2. Run exactly one Arena instance.
3. Export one successful and one failed mustard-to-bowl episode from the robot-head camera.
4. Add a fixed frontal review camera only after validating that it does not alter the evaluation environment.
5. Preserve per-episode outcome metadata so the visible clip and caption refer to the same rollout.
