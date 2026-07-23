# Sim XR GR00T case study voice-over

Target: 90 seconds, English narration, Daniel voice, ElevenLabs
`eleven_multilingual_v2`.

| Time | Visual block | Narration |
|---|---|---|
| 00:00.6–00:04.3 | Sim XR introduction | Remote VR demonstrations become robot training data. |
| 00:05.0–00:13.0 | Published apple workflow | First, we reproduced NVIDIA’s apple-to-plate workflow on our own GPU infrastructure, with closed-loop Arena evaluation. |
| 00:14.0–00:23.0 | Sim XR Quest demonstrations | Fifty Quest demonstrations trained our apple policy to eighty-four percent success, versus ninety-three percent with NVIDIA data. |
| 00:24.0–00:33.0 | Shifted working side | On the other working side, both old policies scored zero. Targeted data raised success to seventy-four percent. |
| 00:34.0–00:43.0 | Targeted spatial data | On a matched position grid, success-filtered demonstrations improved results from four hundred to four hundred forty-eight out of five hundred. |
| 00:44.0–00:50.5 | Mustard task design | Then we changed the task: mustard on the left, and a wooden bowl on the right. |
| 00:51.0–00:58.5 | Mustard operator demonstration | One operator captured fifty successful mustard demonstrations in four short VR sessions. |
| 00:59.0–01:09.0 | Mustard before and after | The apple checkpoint scored zero out of thirty. Fine-tuning reached twenty-seven out of thirty: ninety percent. |
| 01:10.0–01:22.0 | Scanned room and new embodiments | We then checked the pipeline in a scanned environment, on another humanoid, and with five-finger hands. These are still simulation tests. |
| 01:22.0–01:29.0 | Successful mustard rollout and conclusion | The result is infrastructure: remote demonstrations, validated data, policy training, and measured change. |

## Music direction

Instrumental, precise, human-centered, and quietly optimistic. Clean electronic
pulse, restrained tactile percussion, soft low synth, and sparse piano-like
tones. Leave generous space for narration. Start minimal, build steady momentum,
add subtle tension around the failed mustard baseline, and resolve warmly over
the successful rollout. No vocals, trailer booms, cyberpunk treatment, or
dominant melody.

## Generation

Run `node --env-file=.env scripts/generate_audio.mjs`. The local `.env` is
excluded from Git.
