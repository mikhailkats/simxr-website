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
  'Sim XR turns remote VR teleoperation into training data for robot policies.',
  'We first reproduced NVIDIA’s apple-to-plate workflow on our own GPU infrastructure, including closed-loop Arena evaluation.',
  'Fifty Quest demonstrations trained our apple policy to eighty-four successes out of one hundred, versus ninety-three for the NVIDIA-data checkpoint.',
  'Moved to the other working side, both old policies scored zero out of twenty. Targeted data reached seventy-four out of one hundred.',
  'On a matched position grid, success-filtered demonstrations improved the policy from four hundred to four hundred forty-eight successes out of five hundred.',
  'Then we changed the task: a mustard bottle on the left, and a wooden bowl on the right.',
  'The bottle is visible and graspable from both ends. One operator recorded fifty successful demonstrations in four short sessions.',
  'The released apple checkpoint scored zero out of thirty. After fine-tuning, the new checkpoint reached twenty-seven out of thirty, or ninety percent.',
  'We also checked the same task pipeline in a scanned environment, on another humanoid, and with five-finger hands. These remain simulation tests.',
  'This is the infrastructure result: remote demonstrations, validated data, policy training, and measured change.',
];

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
      speed: 1.02,
      useSpeakerBoost: true,
    },
  });
  const audio = await streamToBuffer(stream);
  await writeFile(
    path.join(outputDir, `vo_${String(index + 1).padStart(2, '0')}.mp3`),
    audio,
  );
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
