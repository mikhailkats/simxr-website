import {Audio, Video} from '@remotion/media';
import {
  AbsoluteFill,
  Img,
  Sequence,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const AUDIO_READY = false;

const C = {
  ink: '#0B0F1A',
  blue: '#0057FF',
  blueSoft: '#EAF1FF',
  surface: '#F5F7FA',
  muted: '#596579',
  line: '#DDE3EB',
  white: '#FFFFFF',
  green: '#087A4B',
  greenSoft: '#E4F6ED',
  red: '#B93647',
  redSoft: '#FBEAEC',
};

const sequenceStarts = [18, 150, 420, 720, 1020, 1320, 1530, 1770, 2100, 2460];

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 9, duration - 9, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const enter = (frame: number, fps: number, delay = 0) => {
  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {damping: 20, stiffness: 120, mass: 0.8},
    durationInFrames: 28,
  });
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [26, 0])}px)`,
  };
};

const Brand: React.FC<{context?: string; onImage?: boolean}> = ({
  context = 'Isaac Lab-Arena · GR00T N1.7',
  onImage = false,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 56,
      right: 56,
      top: 38,
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: onImage ? C.white : C.ink,
      textShadow: onImage ? '0 2px 18px rgba(11,15,26,.34)' : 'none',
    }}
  >
    <div
      style={{
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: 25,
        fontWeight: 700,
        letterSpacing: '-0.025em',
      }}
    >
      Sim <span style={{color: onImage ? '#77A4FF' : C.blue}}>XR.</span>
    </div>
    <div style={{fontSize: 17, fontWeight: 500, opacity: onImage ? 0.9 : 0.68}}>
      {context}
    </div>
  </div>
);

const FullVideo: React.FC<{
  src: string;
  position?: string;
  scale?: number;
  muted?: boolean;
}> = ({src, position = '50% 50%', scale = 1, muted = true}) => (
  <Video
    src={staticFile(src)}
    muted={muted}
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

const StageTitle: React.FC<{
  children: React.ReactNode;
  maxWidth?: number;
  size?: number;
}> = ({children, maxWidth = 1000, size = 54}) => (
  <div
    style={{
      maxWidth,
      fontSize: size,
      lineHeight: 1.04,
      fontWeight: 900,
      letterSpacing: '-0.035em',
      textWrap: 'balance',
    }}
  >
    {children}
  </div>
);

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 135;
  const crop = interpolate(frame, [0, 46], [26, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.white, color: C.ink}}>
      <Brand context="Remote demonstration infrastructure" />
      <div
        style={{
          position: 'absolute',
          left: 74,
          top: 208,
          width: 850,
          ...enter(frame, fps, 2),
        }}
      >
        <StageTitle size={72} maxWidth={840}>
          Teaching robot policies from remote VR demonstrations
        </StageTitle>
        <div
          style={{
            marginTop: 34,
            width: 110,
            height: 8,
            borderRadius: 8,
            background: C.blue,
          }}
        />
        <div
          style={{
            marginTop: 30,
            fontSize: 27,
            lineHeight: 1.35,
            color: C.muted,
            maxWidth: 670,
          }}
        >
          Apple reproduction, spatial failure analysis, and a new mustard-to-bowl skill.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 58,
          top: 118,
          width: 820,
          height: 858,
          overflow: 'hidden',
          borderRadius: 10,
          clipPath: `inset(0 ${crop}% 0 0 round 10px)`,
          background: C.surface,
        }}
      >
        <FullVideo src="final_static_apple_policy_rollout.mp4" position="42% 50%" scale={1.18} />
      </div>
    </AbsoluteFill>
  );
};

const Reproduce: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 270;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.white, color: C.ink}}>
      <Brand />
      <div style={{position: 'absolute', left: 58, top: 114, ...enter(frame, fps)}}>
        <StageTitle>First, reproduce the published workflow</StageTitle>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 220,
          width: 1210,
          height: 770,
          overflow: 'hidden',
          borderRadius: 8,
          background: C.ink,
        }}
      >
        <FullVideo src="misha_artifact/stock_apple_baseline.mp4" position="50% 48%" scale={1.08} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 58,
          top: 270,
          width: 530,
          color: C.muted,
          fontSize: 26,
          lineHeight: 1.38,
          ...enter(frame, fps, 10),
        }}
      >
        NVIDIA’s released apple-to-plate task, rebuilt on our own GPU infrastructure and
        evaluated through the closed-loop Arena path.
      </div>
      <div
        style={{
          position: 'absolute',
          right: 58,
          bottom: 120,
          width: 530,
          paddingTop: 24,
          borderTop: `1px solid ${C.line}`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}
      >
        <div>
          <div style={{fontSize: 52, fontWeight: 900}}>208</div>
          <div style={{fontSize: 18, color: C.muted}}>usable released trajectories</div>
        </div>
        <div>
          <div style={{fontSize: 52, fontWeight: 900}}>20k</div>
          <div style={{fontSize: 18, color: C.muted}}>fine-tuning steps</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OwnedData: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 300;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.surface, color: C.ink}}>
      <Brand context="Quest demonstrations · matched evaluation" />
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 118,
          bottom: 72,
          width: 1180,
          overflow: 'hidden',
          borderRadius: 8,
          background: C.ink,
        }}
      >
        <FullVideo src="quest_vr_policy_rollout.mp4" position="43% 52%" scale={1.42} />
      </div>
      <div style={{position: 'absolute', right: 62, top: 164, width: 548, ...enter(frame, fps, 4)}}>
        <StageTitle size={50}>Replace the source data with our own VR demonstrations</StageTitle>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 62,
          top: 475,
          width: 548,
          borderTop: `1px solid ${C.line}`,
          paddingTop: 28,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontSize: 27, color: C.muted}}>NVIDIA-data checkpoint</span>
          <span style={{fontSize: 58, fontWeight: 900}}>93 / 100</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 25,
            color: C.blue,
          }}
        >
          <span style={{fontSize: 27}}>Sim XR Quest top-50</span>
          <span style={{fontSize: 58, fontWeight: 900}}>84 / 100</span>
        </div>
        <div style={{fontSize: 21, color: C.muted, lineHeight: 1.4, marginTop: 34}}>
          Fifty selected demonstrations were enough to validate the complete Sim XR data path.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MoveTask: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 300;
  const panels = [
    {
      image: 'left_hand_layout.png',
      label: 'Old policies on the shifted layout',
      result: '0 / 20',
      color: C.red,
    },
    {
      image: 'right_hand_layout.png',
      label: 'New targeted right-side data',
      result: '74 / 100',
      color: C.blue,
    },
  ];
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.white, color: C.ink}}>
      <Brand context="Spatial and working-side shift" />
      <div style={{position: 'absolute', left: 58, top: 118, ...enter(frame, fps)}}>
        <StageTitle>Move the task, and the learned skill breaks</StageTitle>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          top: 225,
          bottom: 70,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
        }}
      >
        {panels.map((panel) => (
          <div
            key={panel.image}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 8,
              background: C.surface,
            }}
          >
            <Img
              src={staticFile(panel.image)}
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                minHeight: 190,
                background: 'rgba(255,255,255,.93)',
                padding: '30px 34px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 24,
              }}
            >
              <div style={{fontSize: 26, lineHeight: 1.3, maxWidth: 390}}>{panel.label}</div>
              <div style={{fontSize: 68, lineHeight: 1, fontWeight: 900, color: panel.color}}>
                {panel.result}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const SpatialLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 300;
  const clips = [
    ['aug_m2_m2.mp4', '−2, −2 cm'],
    ['aug_m2_p2.mp4', '−2, +2 cm'],
    ['aug_p1_p2.mp4', '+1, +2 cm'],
    ['aug_p2_m2.mp4', '+2, −2 cm'],
  ];
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.surface, color: C.ink}}>
      <Brand context="Targeted success-filtered demonstrations" />
      <div style={{position: 'absolute', left: 58, top: 112, ...enter(frame, fps)}}>
        <StageTitle>Turn measured failures into targeted data</StageTitle>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 222,
          bottom: 72,
          width: 720,
          background: C.white,
          borderRadius: 8,
          padding: 22,
          border: `1px solid ${C.line}`,
        }}
      >
        <Img
          src={staticFile('baseline_heatmap.png')}
          style={{width: '100%', height: 590, objectFit: 'contain'}}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderTop: `1px solid ${C.line}`,
            paddingTop: 24,
          }}
        >
          <span style={{fontSize: 22, color: C.muted}}>Matched 500-rollout grid</span>
          <span style={{fontSize: 50, fontWeight: 900}}>80.0%</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 802,
          right: 58,
          top: 222,
          height: 556,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 12,
        }}
      >
        {clips.map(([src, label]) => (
          <div key={src} style={{position: 'relative', overflow: 'hidden', borderRadius: 7}}>
            <FullVideo src={src} />
            <div
              style={{
                position: 'absolute',
                left: 16,
                bottom: 14,
                color: C.white,
                fontSize: 19,
                fontWeight: 700,
                textShadow: '0 2px 10px rgba(11,15,26,.7)',
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 802,
          right: 58,
          bottom: 72,
          height: 188,
          borderRadius: 8,
          background: C.blue,
          color: C.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 46px',
        }}
      >
        <div style={{fontSize: 27, maxWidth: 430, lineHeight: 1.3}}>
          After targeted data collection
        </div>
        <div style={{fontSize: 70, fontWeight: 900}}>89.6%</div>
      </div>
    </AbsoluteFill>
  );
};

const MustardDesign: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 210;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.white, color: C.ink}}>
      <Brand context="Oregon · new cross-body task" />
      <div style={{position: 'absolute', left: 66, top: 188, width: 625, ...enter(frame, fps)}}>
        <StageTitle size={62}>Then we changed the task itself</StageTitle>
        <div style={{fontSize: 27, color: C.muted, lineHeight: 1.42, marginTop: 34}}>
          A visible, elongated object on the left. A destination beyond the learned left-side
          motion on the right.
        </div>
        <div
          style={{
            display: 'inline-flex',
            marginTop: 52,
            padding: '18px 24px',
            borderRadius: 7,
            background: C.blueSoft,
            color: C.blue,
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Mustard bottle → wooden bowl
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 58,
          top: 116,
          width: 1110,
          height: 850,
          overflow: 'hidden',
          borderRadius: 8,
          background: C.surface,
        }}
      >
        <Img
          src={staticFile('misha_artifact/final_mustard_scene.png')}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </div>
    </AbsoluteFill>
  );
};

const MustardData: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.ink, color: C.white}}>
      <div style={{position: 'absolute', inset: 0}}>
        <FullVideo
          src="misha_artifact/mustard_operator_demo.mp4"
          position="50% 51%"
          scale={1.5}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 124,
          background: 'rgba(11,15,26,.74)',
        }}
      />
      <Brand context="Successful operator demonstration" onImage />
      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          bottom: 48,
          minHeight: 132,
          borderRadius: 8,
          background: 'rgba(255,255,255,.95)',
          color: C.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '26px 38px',
        }}
      >
        <div style={{fontSize: 34, fontWeight: 700}}>One operator · four short sessions</div>
        <div style={{fontSize: 58, fontWeight: 900, color: C.blue}}>50 successful demos</div>
      </div>
    </AbsoluteFill>
  );
};

const MustardResult: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 330;
  const results = [
    {
      src: 'misha_artifact/mustard_nvidia_fail.mp4',
      label: 'Released apple checkpoint',
      value: '0 / 30',
      color: C.red,
      tint: C.redSoft,
    },
    {
      src: 'misha_artifact/mustard_simxr_success.mp4',
      label: 'GR00T + 50 Sim XR demos',
      value: '27 / 30',
      color: C.green,
      tint: C.greenSoft,
    },
  ];
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.white, color: C.ink}}>
      <Brand context="Same task · same evaluation protocol" />
      <div style={{position: 'absolute', left: 58, top: 112, ...enter(frame, fps)}}>
        <StageTitle>One task, two checkpoints</StageTitle>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          top: 218,
          bottom: 62,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
        }}
      >
        {results.map((result) => (
          <div
            key={result.src}
            style={{display: 'grid', gridTemplateRows: '1fr 178px', gap: 0}}
          >
            <div style={{overflow: 'hidden', borderRadius: '8px 8px 0 0', background: C.ink}}>
              <FullVideo src={result.src} position="50% 50%" scale={1.35} />
            </div>
            <div
              style={{
                background: result.tint,
                borderRadius: '0 0 8px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '28px 34px',
              }}
            >
              <div style={{fontSize: 26, lineHeight: 1.25, maxWidth: 430}}>{result.label}</div>
              <div style={{fontSize: 64, fontWeight: 900, color: result.color}}>
                {result.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const FollowUps: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 360;
  const secondHalf = frame >= 180;
  const sectionFrame = secondHalf ? frame - 180 : frame;
  const localOpacity = interpolate(
    sectionFrame,
    [0, 10, 168, 180],
    [0, 1, 1, secondHalf ? 1 : 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.surface, color: C.ink}}>
      {!secondHalf ? (
        <AbsoluteFill style={{opacity: localOpacity}}>
          <div style={{position: 'absolute', inset: 0}}>
            <FullVideo
              src="misha_artifact/mustard_scan_room_success.mp4"
              position="50% 50%"
              scale={1}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 124,
              background: 'rgba(11,15,26,.72)',
            }}
          />
          <Brand context="Follow-up · scanned environment" onImage />
          <div
            style={{
              position: 'absolute',
              left: 58,
              bottom: 48,
              padding: '24px 30px',
              borderRadius: 8,
              background: 'rgba(255,255,255,.95)',
              fontSize: 35,
              fontWeight: 700,
            }}
          >
            The mustard task in a scanned-room visual domain
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{opacity: localOpacity}}>
          <Brand context="Follow-up · embodiment acceptance tests" />
          <div style={{position: 'absolute', left: 58, top: 116}}>
            <StageTitle size={51}>The task pipeline also moved to new hands and robots</StageTitle>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 58,
              right: 58,
              top: 242,
              bottom: 72,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 18,
            }}
          >
            {[
              ['misha_artifact/gr1_headcam.png', 'Fourier GR1T2 · live VR acceptance'],
              ['misha_artifact/g1_inspire_headcam.png', 'Unitree G1 · Inspire FTP hands'],
            ].map(([src, label]) => (
              <div
                key={src}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 8,
                  background: C.white,
                }}
              >
                <Img
                  src={staticFile(src)}
                  style={{width: '100%', height: '100%', objectFit: 'cover'}}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 20,
                    right: 20,
                    bottom: 20,
                    padding: '18px 22px',
                    borderRadius: 7,
                    background: 'rgba(255,255,255,.94)',
                    fontSize: 25,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const MustardOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = 255;
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration), background: C.ink, color: C.white}}>
      <div style={{position: 'absolute', inset: 0}}>
        <FullVideo
          src="misha_artifact/mustard_simxr_success.mp4"
          position="50% 50%"
          scale={1.42}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 124,
          background: 'rgba(11,15,26,.68)',
        }}
      />
      <Brand context="Simulation result · 27/30" onImage />
      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          bottom: 48,
          minHeight: 210,
          padding: '32px 38px',
          borderRadius: 8,
          background: 'rgba(255,255,255,.95)',
          color: C.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 44,
          ...enter(frame, fps, 8),
        }}
      >
        <div style={{fontSize: 46, lineHeight: 1.08, fontWeight: 900, maxWidth: 1110}}>
          Remote demonstrations → validated data → policy training → measured change
        </div>
        <div style={{fontSize: 72, fontWeight: 900, color: C.green, whiteSpace: 'nowrap'}}>
          90%
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Soundtrack: React.FC = () => {
  if (!AUDIO_READY) return null;
  return (
    <>
      <Audio
        src={staticFile('audio/sim_xr_case_study_score.mp3')}
        volume={(frame) =>
          interpolate(frame, [0, 35, 2600, 2700], [0, 0.11, 0.11, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
      {sequenceStarts.map((start, index) => (
        <Sequence key={start} from={start}>
          <Audio
            src={staticFile(`audio/vo_${String(index + 1).padStart(2, '0')}.mp3`)}
            volume={1}
          />
        </Sequence>
      ))}
    </>
  );
};

export const CaseStudy: React.FC = () => (
  <AbsoluteFill style={{background: C.white}}>
    <Soundtrack />
    <Series>
      <Series.Sequence durationInFrames={135} premountFor={30}>
        <Intro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={270} premountFor={30}>
        <Reproduce />
      </Series.Sequence>
      <Series.Sequence durationInFrames={300} premountFor={30}>
        <OwnedData />
      </Series.Sequence>
      <Series.Sequence durationInFrames={300} premountFor={30}>
        <MoveTask />
      </Series.Sequence>
      <Series.Sequence durationInFrames={300} premountFor={30}>
        <SpatialLoop />
      </Series.Sequence>
      <Series.Sequence durationInFrames={210} premountFor={30}>
        <MustardDesign />
      </Series.Sequence>
      <Series.Sequence durationInFrames={240} premountFor={30}>
        <MustardData />
      </Series.Sequence>
      <Series.Sequence durationInFrames={330} premountFor={30}>
        <MustardResult />
      </Series.Sequence>
      <Series.Sequence durationInFrames={360} premountFor={30}>
        <FollowUps />
      </Series.Sequence>
      <Series.Sequence durationInFrames={255} premountFor={30}>
        <MustardOutro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
