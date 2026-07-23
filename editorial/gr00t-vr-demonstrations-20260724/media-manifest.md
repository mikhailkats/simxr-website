# Media Manifest

## Publication assets

| Placement | Asset | Provenance | Status |
|---|---|---|---|
| Article hero | `media/video-cover.jpg` | Frame from the new Sim XR case-study video | Generated after final render |
| Spatial intervention | `media/spatial-success-rate-delta.png` | Matched 500 + 500 episode experiment | Ready |
| Baseline overview | `media/baseline-contact-sheet.png` | Original checkpoint rollouts | Ready |
| Augmented overview | `media/augmented-contact-sheet.png` | Pose-augmented checkpoint rollouts | Ready |
| Main video | `video/out/sim_xr_gr00t_case_study_20260724.mp4` | New 90-second 16:9 edit | Ready and validated |
| Social video | `video/out/sim_xr_gr00t_case_study_20260724_720p.mp4` | Compressed 16:9 derivative | Ready and validated |

## Existing evidence reused in the video

- NVIDIA released training episodes: `original_000000.mp4`, `original_000050.mp4`, `original_000100.mp4`.
- Sim XR Quest-trained policy rollout: `quest_vr_policy_rollout.mp4`.
- Canonical reproduction rollout: `final_static_apple_policy_rollout.mp4`.
- Targeted pose-collection clips: four robot-head-camera videos.
- Matched representative before/after rollouts at the same coordinate.
- Camera-safe left/right layout images from the Quest experiment.
- Mustard bottle and wooden bowl reference renders from the local RoboLab asset catalog.

## Evidence boundary

The mustard-to-bowl segment uses verified task-asset images and the 0/30 → 27/30 metric. No local mustard rollout video was found, and the connected Drive account did not expose the server backup by name. The edit must not imply that the reference asset stills are rollout footage.

The Oregon server is documented but not accessible from this workstation with the available SSH key. No new front-camera rollout was rendered. A future media pass can replace the stills after a verified mustard rollout export or server access is provided.

## Recommended additional capture

If the Oregon server becomes accessible:

1. Confirm no active Kit/container job.
2. Run exactly one Arena instance.
3. Export one successful and one failed mustard-to-bowl episode from the robot-head camera.
4. Add a fixed frontal review camera only after validating that it does not alter the evaluation environment.
5. Preserve per-episode outcome metadata so the visible clip and caption refer to the same rollout.
