import {Composition} from 'remotion';
import {CaseStudy} from './CaseStudy';
import './index.css';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SimXRGR00TCaseStudy"
    component={CaseStudy}
    durationInFrames={2700}
    fps={30}
    width={1920}
    height={1080}
  />
);
