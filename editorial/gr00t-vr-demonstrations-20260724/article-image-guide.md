# Article image guide

This package contains the publication-ready image sequence for the Sim XR article. The files are numbered in recommended reading order and kept separately from source screenshots and internal evidence.

| File | Recommended placement | Caption | Source and evidence role |
|---|---|---|---|
| `article-images/01-remote-xr-teleoperation.png` | After the opening thesis | Training humanoid robots through remote XR teleoperation in simulation. | Sim XR branded title card. Establishes the subject and toolchain. |
| `article-images/02-nvidia-pipeline-208-demos-93-of-100.png` | End of the NVIDIA reference section | NVIDIA’s published data-to-policy pipeline provided the reference implementation. After auditing the released files, we trained on 208 usable demonstrations and measured 93/100 in our matched evaluation. | Final video frame built from the validated NVIDIA-data result. |
| `article-images/03-sim-xr-remote-50-demos-84-of-100.png` | Before the first comparison table | One remote operator, CloudXR and Isaac Teleop, and an AWS L40S: 50 selected demonstrations produced 84/100 in the matched apple evaluation. | Final video frame built from the validated Sim XR Quest result. |
| `article-images/04-targeted-right-side-data-0-to-74.png` | After the shifted-layout result | Both old policies scored 0/20 after the task moved to the other working side. Targeted right-side demonstrations produced 74/100. | Camera-safe shifted-layout experiment. |
| `article-images/05-spatial-robustness-80-to-89-6.png` | Before the spatial comparison table | Collecting data in measured weak regions improved the matched 500-episode score from 80.0% to 89.6%. | Matched 5 × 5 spatial benchmark. |
| `article-images/06-mustard-remote-operator-50-demos.png` | After the mustard collection description | One remote operator collected 50 successful mustard demonstrations in four short sessions. | Frame from the original Oregon operator demonstration. |
| `article-images/07-mustard-policy-0-to-27-of-30.png` | Immediately after the mustard metric | On the same mustard task and evaluation protocol, the released apple checkpoint scored 0/30; the new checkpoint scored 27/30. | Paired Oregon baseline and fine-tuned-policy evidence. |
| `article-images/08-next-environments-and-embodiments.png` | In the follow-up paragraph | Follow-up work covers a scanned environment, Fourier GR1T2, and Unitree G1 with Inspire FTP hands. Results will be covered separately. | Simulation and teleoperation acceptance checks, not cross-embodiment policy-transfer proof. |

## Publishing notes

- Use the images in numeric order, but keep each image close to the claim it supports.
- Preserve the supplied captions or equivalent factual wording.
- Do not crop metric labels or the Sim XR mark.
- Keep `27/30` visible whenever `90%` is mentioned.
- The alternate-environment and embodiment image is a next-experiment preview. Do not caption it as proof that one policy transfers across embodiments.
