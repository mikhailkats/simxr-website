import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js';
import {spawn} from 'node:child_process';
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
  'Sim XR trains humanoid robots remotely, in simulation.',
  'NVIDIA published the pipeline: Isaac Lab, LeRobot, VLA fine-tuning, then Arena evaluation. Two hundred eight demonstrations reached ninety-three out of one hundred.',
  'We remotely collected fifty demonstrations through CloudXR, thousands of kilometres from the AWS server. Our policy reached eighty-four out of one hundred.',
  'When the task moved to the other side, both old policies scored zero. Targeted remote demonstrations raised success to seventy-four percent.',
  'We repeated the loop on weak positions. Targeted additions raised matched success from eighty to eighty-nine point six percent.',
  'Then we changed the task itself: mustard on the left, and a wooden bowl on the right.',
  'One remote operator captured fifty successful mustard demonstrations in four short VR sessions.',
  'The apple policy scored zero out of thirty on mustard. After targeted fine-tuning, the new skill reached twenty-seven out of thirty.',
  'Next, we’re testing scanned environments, another humanoid, and five-finger hands. We’ll share those results in the next videos.',
  'The Sim XR advantage is simple: remote operators can collect the missing behavior without stepping into the robot lab.',
];
const voiceOnlyIndex = process.env.VO_INDEX
  ? Number.parseInt(process.env.VO_INDEX, 10)
  : null;

await writeFile(
  path.join(outputDir, 'voiceover-script.json'),
  `${JSON.stringify(
    {
      voice: 'River',
      voiceId: 'SAz9YHcvj6GT2YYXdXww',
      model: 'eleven_multilingual_v2',
      blocks: narration,
    },
    null,
    2,
  )}\n`,
);

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
  const stream = await client.textToSpeech.convert('SAz9YHcvj6GT2YYXdXww', {
    text: narration[index],
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    previousText: narration[index - 1],
    nextText: narration[index + 1],
    voiceSettings: {
      stability: 0.78,
      similarityBoost: 0.74,
      style: 0.04,
      speed: 1.08,
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

const ffmpeg = spawn(
  'ffmpeg',
  [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    path.join(outputDir, 'sim_xr_case_study_score.mp3'),
    '-filter_complex',
    '[0:a]atrim=start=0:end=84.947551,asetpts=PTS-STARTPTS,' +
      'atempo=0.943861678[a]',
    '-map',
    '[a]',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    path.join(outputDir, 'sim_xr_case_study_score_continuous.mp3'),
  ],
  {stdio: 'inherit'},
);

await new Promise((resolve, reject) => {
  ffmpeg.on('error', reject);
  ffmpeg.on('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`ffmpeg music extension failed with exit code ${code}`));
  });
});
