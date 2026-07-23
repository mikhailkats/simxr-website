# Media Manifest

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
| Final master | `../remotion_case_study_20260724/project/out/sim_xr_gr00t_case_study_20260724_v3_audio_master.mp4` | Revised 90-second 16:9 Sim XR edit with mustard ending, ElevenLabs narration, and ElevenLabs music | Ready and validated |
| Final social video | `../remotion_case_study_20260724/project/out/sim_xr_gr00t_case_study_20260724_v3_audio_720p.mp4` | Compressed 16:9 derivative with the final audio mix | Ready and validated |

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
ElevenLabs Daniel voice and a 90-second instrumental score generated with
ElevenLabs Music. The blocks were duration-checked against their visual scenes.
The final stereo AAC mix is 48 kHz, peaks at -1.5 dB, and fully decodes without
errors. The local credential is excluded from Git.

## Recommended additional capture

If the Oregon server becomes accessible:

1. Confirm no active Kit/container job.
2. Run exactly one Arena instance.
3. Export one successful and one failed mustard-to-bowl episode from the robot-head camera.
4. Add a fixed frontal review camera only after validating that it does not alter the evaluation environment.
5. Preserve per-episode outcome metadata so the visible clip and caption refer to the same rollout.
