# Sim XR GR00T case study voice-over

Target: 90 seconds, English narration, Daniel voice, ElevenLabs
`eleven_multilingual_v2`.

| Time | Visual block | Narration |
|---|---|---|
| 00:00.6–00:04.3 | Sim XR introduction | Sim XR turns remote VR teleoperation into training data for robot policies. |
| 00:05.0–00:13.0 | Published apple workflow | We first reproduced NVIDIA’s apple-to-plate workflow on our own GPU infrastructure, including closed-loop Arena evaluation. |
| 00:14.0–00:23.0 | Sim XR Quest demonstrations | Fifty Quest demonstrations trained our apple policy to eighty-four successes out of one hundred, versus ninety-three for the NVIDIA-data checkpoint. |
| 00:24.0–00:33.0 | Shifted working side | Moved to the other working side, both old policies scored zero out of twenty. Targeted data reached seventy-four out of one hundred. |
| 00:34.0–00:43.0 | Targeted spatial data | On a matched position grid, success-filtered demonstrations improved the policy from four hundred to four hundred forty-eight successes out of five hundred. |
| 00:44.0–00:50.5 | Mustard task design | Then we changed the task: a mustard bottle on the left, and a wooden bowl on the right. |
| 00:51.0–00:58.5 | Mustard operator demonstration | The bottle is visible and graspable from both ends. One operator recorded fifty successful demonstrations in four short sessions. |
| 00:59.0–01:09.0 | Mustard before and after | The released apple checkpoint scored zero out of thirty. After fine-tuning, the new checkpoint reached twenty-seven out of thirty, or ninety percent. |
| 01:10.0–01:22.0 | Scanned room and new embodiments | We also checked the same task pipeline in a scanned environment, on another humanoid, and with five-finger hands. These remain simulation tests. |
| 01:22.0–01:29.0 | Successful mustard rollout and conclusion | This is the infrastructure result: remote demonstrations, validated data, policy training, and measured change. |

## Music direction

Instrumental, precise, human-centered, and quietly optimistic. Clean electronic
pulse, restrained tactile percussion, soft low synth, and sparse piano-like
tones. Leave generous space for narration. Start minimal, build steady momentum,
add subtle tension around the failed mustard baseline, and resolve warmly over
the successful rollout. No vocals, trailer booms, cyberpunk treatment, or
dominant melody.

## Current generation status

The ElevenLabs generation script is ready at `scripts/generate_audio.mjs`.
Generation is currently blocked because the configured API key returns
`invalid_api_key`. The visual render keeps audio disabled until the generated
files pass duration and listening checks.
