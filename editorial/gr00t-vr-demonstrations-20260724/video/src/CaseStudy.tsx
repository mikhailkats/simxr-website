import {Video} from '@remotion/media';
import {
  AbsoluteFill,
  Img,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const C = {
  paper: '#F6F9FE',
  ink: '#07111D',
  muted: '#526173',
  blue: '#0057FF',
  green: '#0A9B5A',
  red: '#D14452',
  white: '#FFFFFF',
  line: '#D9E3F0',
};

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const Brand: React.FC<{dark?: boolean}> = ({dark}) => (
  <>
    <div
      style={{
        position: 'absolute',
        top: 34,
        left: 54,
        zIndex: 20,
        color: dark ? C.white : C.ink,
        fontSize: 24,
        fontWeight: 900,
        letterSpacing: 0.8,
      }}
    >
      Sim <span style={{color: '#3A8BFF'}}>XR</span>
    </div>
    <div
      style={{
        position: 'absolute',
        top: 39,
        right: 54,
        zIndex: 20,
        color: dark ? 'rgba(255,255,255,.76)' : C.muted,
        fontSize: 17,
      }}
    >
      Isaac Lab-Arena · GR00T N1.7
    </div>
  </>
);

const FullVideo: React.FC<{src: string; position?: string; scale?: number}> = ({
  src,
  position = '50% 50%',
  scale = 1,
}) => (
  <Video
    src={staticFile(src)}
    muted
    loop
    objectFit="cover"
    style={{
      width: '100%',
      height: '100%',
      objectPosition: position,
      transform: `scale(${scale})`,
    }}
  />
);

const Cover: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 150;
  const y = interpolate(frame, [0, 30], [34, 0], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: '#050B12'}}>
      <FullVideo src="final_static_apple_policy_rollout.mp4" position="42% 48%" scale={1.12} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg,rgba(3,8,14,.92) 0%,rgba(3,8,14,.57) 48%,rgba(3,8,14,.12) 78%)'}} />
      <Brand dark />
      <div style={{position: 'absolute', left: 88, top: 250, width: 1040, transform: `translateY(${y}px)`}}>
        <div style={{fontSize: 23, fontWeight: 900, color: '#66A4FF'}}>FROM REPRODUCTION TO NEW SKILLS</div>
        <div style={{fontSize: 78, lineHeight: 1.02, fontWeight: 900, color: C.white, letterSpacing: -2.2, marginTop: 18}}>
          Teaching a humanoid policy with remote VR demonstrations
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Reproduce: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 420;
  const clips = ['original_000000.mp4', 'original_000050.mp4', 'original_000100.mp4'];
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.paper, color: C.ink, fontFamily: 'Aptos, Arial, sans-serif'}}>
      <Brand />
      <div style={{position: 'absolute', left: 58, top: 90, fontSize: 52, fontWeight: 900}}>01 · Reproduce the published task</div>
      <div style={{position: 'absolute', left: 58, right: 58, top: 175, bottom: 72, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16}}>
        {clips.map((src, index) => (
          <div key={src} style={{position: 'relative', overflow: 'hidden', background: '#101820'}}>
            <FullVideo src={src} />
            <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.44),transparent 35%,rgba(0,0,0,.55))'}} />
            <div style={{position: 'absolute', left: 22, top: 20, color: C.white, fontSize: 21, fontWeight: 800}}>Public episode {String(index * 50).padStart(3, '0')}</div>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 650, bottom: 26, color: C.muted, fontSize: 20}}>208 valid trajectories · independent conversion · 20k-step fine-tune</div>
    </AbsoluteFill>
  );
};

const OwnedData: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 360;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: '#050B12', color: C.white, fontFamily: 'Aptos, Arial, sans-serif'}}>
      <FullVideo src="quest_vr_policy_rollout.mp4" position="45% 54%" scale={1.5} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg,rgba(3,8,14,.88),rgba(3,8,14,.22) 70%)'}} />
      <Brand dark />
      <div style={{position: 'absolute', left: 80, top: 205, width: 760}}>
        <div style={{fontSize: 54, lineHeight: 1.05, fontWeight: 900}}>02 · Collect our own demonstrations</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 48}}>
          <div style={{fontSize: 112, lineHeight: 1, fontWeight: 900}}>50</div>
          <div style={{fontSize: 30, lineHeight: 1.25}}>Quest VR<br />demonstrations</div>
        </div>
        <div style={{fontSize: 26, color: 'rgba(255,255,255,.78)', marginTop: 34}}>The resulting apple policy reached 84/100 on its original layout.</div>
      </div>
    </AbsoluteFill>
  );
};

const MoveTask: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 360;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.paper, color: C.ink, fontFamily: 'Aptos, Arial, sans-serif'}}>
      <Brand />
      <div style={{position: 'absolute', left: 58, top: 92, fontSize: 52, fontWeight: 900}}>03 · Move the task to the other hand</div>
      <div style={{position: 'absolute', left: 70, right: 70, top: 185, bottom: 88, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26}}>
        <div style={{position: 'relative', overflow: 'hidden', background: C.white, border: `1px solid ${C.line}`}}>
          <Img src={staticFile('left_hand_layout.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(7,17,29,.18),rgba(7,17,29,.75))'}} />
          <div style={{position: 'absolute', left: 28, bottom: 28, color: C.white, fontSize: 36, fontWeight: 900}}>Old policies</div>
          <div style={{position: 'absolute', right: 28, bottom: 22, color: C.red, fontSize: 74, fontWeight: 900}}>0 / 20</div>
        </div>
        <div style={{position: 'relative', overflow: 'hidden', background: C.white, border: `1px solid ${C.line}`}}>
          <Img src={staticFile('right_hand_layout.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(7,17,29,.18),rgba(7,17,29,.75))'}} />
          <div style={{position: 'absolute', left: 28, bottom: 28, color: C.white, fontSize: 36, fontWeight: 900}}>New VR data</div>
          <div style={{position: 'absolute', right: 28, bottom: 22, color: '#4BE29A', fontSize: 74, fontWeight: 900}}>74 / 100</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SpatialLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 450;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.paper, color: C.ink, fontFamily: 'Aptos, Arial, sans-serif'}}>
      <Brand />
      <div style={{position: 'absolute', left: 58, top: 90, fontSize: 52, fontWeight: 900}}>04 · Turn failures into targeted data</div>
      <div style={{position: 'absolute', left: 60, right: 60, top: 180, bottom: 70, display: 'grid', gridTemplateColumns: '0.9fr 1.35fr', gap: 22}}>
        <div style={{background: C.white, border: `1px solid ${C.line}`, padding: 16, display: 'flex', flexDirection: 'column'}}>
          <Img src={staticFile('baseline_heatmap.png')} style={{width: '100%', height: 500, objectFit: 'contain'}} />
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 16, marginTop: 8}}>
            <span style={{fontSize: 64, fontWeight: 900}}>80.0%</span>
            <span style={{fontSize: 24, color: C.muted}}>500-rollout baseline</span>
          </div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12}}>
          {[
            ['aug_m2_m2.mp4', '−2, −2 cm'],
            ['aug_m2_p2.mp4', '−2, +2 cm'],
            ['aug_p1_p2.mp4', '+1, +2 cm'],
            ['aug_p2_m2.mp4', '+2, −2 cm'],
          ].map(([src, label]) => (
            <div key={src} style={{position: 'relative', overflow: 'hidden', background: '#101820'}}>
              <FullVideo src={src} />
              <div style={{position: 'absolute', left: 18, bottom: 16, color: C.white, fontSize: 22, fontWeight: 800}}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const BeforeAfter: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 390;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: '#050B12', color: C.white, fontFamily: 'Aptos, Arial, sans-serif'}}>
      <Brand dark />
      <div style={{position: 'absolute', left: 58, top: 92, fontSize: 50, fontWeight: 900}}>05 · Same pose. New checkpoint.</div>
      <div style={{position: 'absolute', left: 60, right: 60, top: 185, bottom: 72, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
        <div style={{position: 'relative', overflow: 'hidden', border: `4px solid ${C.red}`}}>
          <FullVideo src="baseline_m1_p1.mp4" position="36% 55%" scale={1.42} />
          <div style={{position: 'absolute', left: 24, top: 20, fontSize: 30, fontWeight: 900}}>Before · 85%</div>
        </div>
        <div style={{position: 'relative', overflow: 'hidden', border: `4px solid ${C.green}`}}>
          <FullVideo src="augmented_m1_p1.mp4" position="36% 55%" scale={1.42} />
          <div style={{position: 'absolute', left: 24, top: 20, fontSize: 30, fontWeight: 900}}>After · 100%</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NewSkill: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 360;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.paper, color: C.ink, fontFamily: 'Aptos, Arial, sans-serif'}}>
      <Brand />
      <div style={{position: 'absolute', left: 60, top: 92, fontSize: 52, fontWeight: 900}}>06 · A task that was not in the source dataset</div>
      <div style={{position: 'absolute', left: 110, right: 110, top: 220, bottom: 135, display: 'grid', gridTemplateColumns: '1fr 340px 1fr', alignItems: 'center', gap: 46}}>
        <div style={{height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.white, border: `1px solid ${C.line}`}}>
          <Img src={staticFile('mustard_bottle.png')} style={{maxWidth: '78%', maxHeight: '84%', objectFit: 'contain'}} />
        </div>
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 96, lineHeight: 1, fontWeight: 900, color: C.red}}>0%</div>
          <div style={{fontSize: 46, color: C.blue, fontWeight: 900, margin: '24px 0'}}>→</div>
          <div style={{fontSize: 112, lineHeight: 1, fontWeight: 900, color: C.green}}>90%</div>
          <div style={{fontSize: 21, color: C.muted, marginTop: 18}}>50 operator demos</div>
        </div>
        <div style={{height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.white, border: `1px solid ${C.line}`}}>
          <Img src={staticFile('wooden_bowl.png')} style={{maxWidth: '80%', maxHeight: '80%', objectFit: 'contain'}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 66, textAlign: 'center', fontSize: 28, fontWeight: 800}}>Mustard bottle → wooden bowl · 27 / 30 closed-loop successes</div>
    </AbsoluteFill>
  );
};

const Result: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.ink, color: C.white, fontFamily: 'Aptos, Arial, sans-serif'}}>
      <Brand dark />
      <div style={{position: 'absolute', left: 100, right: 100, top: 260, textAlign: 'center'}}>
        <div style={{fontSize: 76, lineHeight: 1.04, fontWeight: 900}}>Remote teleoperation → training data → VLA fine-tune → closed-loop evaluation</div>
        <div style={{fontSize: 32, color: '#7FB2FF', marginTop: 52, fontWeight: 800}}>Next: both hands · randomized positions · 3DGS visual domains</div>
      </div>
    </AbsoluteFill>
  );
};

export const CaseStudy: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={150} premountFor={30}><Cover /></Series.Sequence>
    <Series.Sequence durationInFrames={420} premountFor={30}><Reproduce /></Series.Sequence>
    <Series.Sequence durationInFrames={360} premountFor={30}><OwnedData /></Series.Sequence>
    <Series.Sequence durationInFrames={360} premountFor={30}><MoveTask /></Series.Sequence>
    <Series.Sequence durationInFrames={450} premountFor={30}><SpatialLoop /></Series.Sequence>
    <Series.Sequence durationInFrames={390} premountFor={30}><BeforeAfter /></Series.Sequence>
    <Series.Sequence durationInFrames={360} premountFor={30}><NewSkill /></Series.Sequence>
    <Series.Sequence durationInFrames={210} premountFor={30}><Result /></Series.Sequence>
  </Series>
);
