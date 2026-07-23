import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  throw new Error('ELEVENLABS_API_KEY is not configured');
}

const client = new ElevenLabsClient({apiKey});
const outputDir = path.resolve('public/audio');
await mkdir(outputDir, {recursive: true});

const narration = [
  'Remote VR demonstrations become robot training data.',
  'First, we reproduced NVIDIA’s apple-to-plate workflow on our own GPU infrastructure, with closed-loop Arena evaluation.',
  'Fifty Quest demonstrations trained our apple policy to eighty-four percent success, versus ninety-three percent with NVIDIA data.',
  'On the other working side, both old policies scored zero. Targeted data raised success to seventy-four percent.',
  'On a matched position grid, success-filtered demonstrations improved results from four hundred to four hundred forty-eight out of five hundred.',
  'Then we changed the task: mustard on the left, and a wooden bowl on the right.',
  'One operator captured fifty successful mustard demonstrations in four short VR sessions.',
  'The apple checkpoint scored zero out of thirty. Fine-tuning reached twenty-seven out of thirty: ninety percent.',
  'We then checked the pipeline in a scanned environment, on another humanoid, and with five-finger hands. These are still simulation tests.',
  'The result is infrastructure: remote demonstrations, validated data, policy training, and measured change.',
];
const voiceOnlyIndex = process.env.VO_INDEX
  ? Number.parseInt(process.env.VO_INDEX, 10)
  : null;

const streamToBuffer = async (stream) => {
  const reader = stream.getReader();
  const chunks = [];
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
};

for (let index = 0; index < narration.length; index += 1) {
  if (voiceOnlyIndex !== null && index !== voiceOnlyIndex - 1) continue;
  const stream = await client.textToSpeech.convert('onwK4e9ZLuTAKqWW03F9', {
    text: narration[index],
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    previousText: narration[index - 1],
    nextText: narration[index + 1],
    voiceSettings: {
      stability: 0.68,
      similarityBoost: 0.78,
      style: 0.12,
      speed: 1.12,
      useSpeakerBoost: true,
    },
  });
  const audio = await streamToBuffer(stream);
  await writeFile(
    path.join(outputDir, `vo_${String(index + 1).padStart(2, '0')}.mp3`),
    audio,
  );
}

if (voiceOnlyIndex !== null) {
  process.exit(0);
}

const score = await client.music.composeDetailed({
  prompt:
    'Instrumental score for a 90-second Sim XR robotics case study. Precise, human-centered and quietly optimistic. Clean electronic pulse, restrained tactile percussion, soft low synth and sparse piano-like tones. Leave generous space for English narration. Start minimal for the first 8 seconds, build steady momentum through 45 seconds, add subtle tension from 45 to 60 seconds for the failed mustard baseline, then resolve with confident warmth from 60 to 90 seconds. No vocals, no dramatic trailer booms, no aggressive bass, no cyberpunk, no orchestral climax, no dominant melody.',
  musicLengthMs: 90000,
});

await writeFile(path.join(outputDir, 'sim_xr_case_study_score.mp3'), score.audio);
await writeFile(
  path.join(outputDir, 'sim_xr_case_study_score_metadata.json'),
  `${JSON.stringify(score.json, null, 2)}\n`,
);

await writeFile(
  path.join(outputDir, 'voiceover-script.json'),
  `${JSON.stringify(
    {
      voice: 'Daniel',
      voiceId: 'onwK4e9ZLuTAKqWW03F9',
      model: 'eleven_multilingual_v2',
      blocks: narration,
    },
    null,
    2,
  )}\n`,
);
