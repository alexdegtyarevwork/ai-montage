import React from 'react';
import {Composition, registerRoot} from 'remotion';
import '../fonts';
import '../reels/md-styles/fonts';
import {TOCHKA_SECONDS, TochkaReel} from '../reels/md-styles/Tochka';
import {PLENKA_SECONDS, PlenkaReel} from '../reels/md-styles/Plenka';
import {SLOVA_SECONDS, SlovaReel} from '../reels/md-styles/Slova';

// Образцы стилей навыка motion-design (.claude/skills/motion-design): 16 ПЛЁНКА, 17 СЛОВА, 18 ТОЧКА.
// Своя точка входа: рендер не зависит от общего реестра.  npx remotion render src/entries/md-styles.tsx MD-Tochka out/…
const FPS = 60;
const Root: React.FC = () => (
  <>
    <Composition id="MD-Tochka" component={TochkaReel} durationInFrames={Math.round(TOCHKA_SECONDS * FPS)} fps={FPS} width={1440} height={2560} />
    <Composition id="MD-Plenka" component={PlenkaReel} durationInFrames={Math.round(PLENKA_SECONDS * FPS)} fps={FPS} width={1440} height={2560} />
    <Composition id="MD-Slova" component={SlovaReel} durationInFrames={Math.round(SLOVA_SECONDS * FPS)} fps={FPS} width={1440} height={2560} />
  </>
);
registerRoot(Root);
