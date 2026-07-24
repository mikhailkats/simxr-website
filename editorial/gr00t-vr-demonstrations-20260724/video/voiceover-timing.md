# Sim XR GR00T case study voice-over

Target: 90 seconds, English narration, River voice, ElevenLabs
`eleven_multilingual_v2`.

| Time | Visual block | Narration |
|---|---|---|
| 00:00.0–00:04.9 | Sim XR introduction | Sim XR trains humanoid robots remotely, in simulation. |
| 00:04.6–00:15.5 | Published NVIDIA pipeline | NVIDIA published the pipeline: Isaac Lab, LeRobot, VLA fine-tuning, then Arena evaluation. Two hundred eight demonstrations reached ninety-three out of one hundred. |
| 00:15.7–00:25.2 | Sim XR remote demonstrations | We remotely collected fifty demonstrations through CloudXR, thousands of kilometres from the AWS server. Our policy reached eighty-four out of one hundred. |
| 00:25.5–00:34.0 | Shifted working side | When the task moved to the other side, both old policies scored zero. Targeted remote demonstrations raised success to seventy-four percent. |
| 00:35.5–00:43.0 | Targeted spatial data | We repeated the loop on weak positions. Targeted additions raised matched success from eighty to eighty-nine point six percent. |
| 00:45.5–00:51.0 | Mustard task design | Then we changed the task itself: mustard on the left, and a wooden bowl on the right. |
| 00:52.5–00:58.5 | Mustard operator demonstration | One remote operator captured fifty successful mustard demonstrations in four short VR sessions. |
| 01:00.5–01:08.1 | Mustard before and after | The apple policy scored zero out of thirty on mustard. After targeted fine-tuning, the new skill reached twenty-seven out of thirty. |
| 01:11.5–01:18.1 | Scanned room and new embodiments | Next, we’re testing scanned environments, another humanoid, and five-finger hands. We’ll share those results in the next videos. |
| 01:22.0–01:29.0 | Successful mustard rollout and conclusion | The Sim XR advantage is simple: remote operators can collect the missing behavior without stepping into the robot lab. |

## Music direction

Instrumental, precise, human-centered, and quietly optimistic. Clean electronic
pulse, restrained tactile percussion, soft low synth, and sparse piano-like
tones. Leave generous space for narration. Start minimal, build steady momentum,
add subtle tension around the failed mustard baseline, and resolve warmly over
the successful rollout. No vocals, trailer booms, cyberpunk treatment, or
dominant melody.

The generated score's silent tail is replaced by a crossfaded reprise of its
active closing material. Music remains measurable through 89.95 seconds and
fades only over the final 0.7 seconds.

## Generation

Run `node --env-file=.env scripts/generate_audio.mjs`. The local `.env` is
excluded from Git.
