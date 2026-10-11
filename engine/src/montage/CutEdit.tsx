import {AbsoluteFill, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Audio, Video} from '@remotion/media';

// Просмотр нарезки для ручной правки в Remotion Studio (npm run cut:edit -- <slug>).
// Куски берутся из work/<slug>/cut-edit.json: {slug, fps, pieces: [{take, start, end, keep, text}]}.
// Агент правит этот файл по словам ученика («кусок 3 начни на 0,2 с раньше», «выкинь кусок 5») — Studio сразу
// показывает результат. «Готово» → npm run cut -- <slug> edit пересобирает нарезку из этого файла.
export type CutPiece = {take: number; start: number; end: number; keep: boolean; text?: string};
export type CutEditProps = {slug: string; fps: number; pieces: CutPiece[]};

const frames = (p: CutPiece, fps: number) => Math.max(1, Math.round(p.end * fps) - Math.round(p.start * fps));
export const cutEditDuration = ({fps, pieces}: CutEditProps) => Math.max(1, pieces.filter((p) => p.keep).reduce((s, p) => s + frames(p, fps), 0));
const sec = (x: number) => x.toFixed(2).replace('.', ',');

export const CutEdit: React.FC<CutEditProps> = ({slug, fps, pieces}) => {
  const frame = useCurrentFrame();
  const all = pieces.map((p, i) => ({...p, n: i + 1}));
  const kept = all.filter((p) => p.keep);
  const total = cutEditDuration({slug, fps, pieces});
  let at = 0;
  const placed = kept.map((p) => { const from = at; at += frames(p, fps); return {...p, from, len: frames(p, fps)}; });
  const cur = placed.find((p) => frame >= p.from && frame < p.from + p.len) ?? placed[placed.length - 1];
  const font = {fontFamily: 'Manrope', fontWeight: 700, color: '#F2F3F5'} as const;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {placed.map((p) => (
        <Sequence key={p.n} from={p.from} durationInFrames={p.len} layout="none">
          <Video src={staticFile(`work/${slug}/speaker.mp4`)} muted trimBefore={Math.round(p.start * fps)} trimAfter={Math.round(p.start * fps) + p.len}
            objectFit="cover" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none'}} />
          <Audio src={staticFile(`work/${slug}/voice.wav`)} trimBefore={Math.round(p.start * fps)} trimAfter={Math.round(p.start * fps) + p.len} />
        </Sequence>
      ))}
      {cur ? (
        <div style={{position: 'absolute', left: 48, right: 48, top: 64, padding: '28px 36px', borderRadius: 32, background: 'rgba(0,0,0,.62)', ...font}}>
          <div style={{fontSize: 64}}>Кусок {cur.n} · дубль {cur.take}</div>
          <div style={{fontSize: 44, opacity: 0.8, marginTop: 8}}>{sec(cur.start)}–{sec(cur.end)} с в записи · {sec((cur.end - cur.start))} с</div>
          {cur.text ? <div style={{fontSize: 40, fontWeight: 500, opacity: 0.9, marginTop: 16, lineHeight: 1.3}}>{cur.text}</div> : null}
        </div>
      ) : null}
      {/* шкала: все куски по порядку; выкинутые — серые, текущий — ярко */}
      <div style={{position: 'absolute', left: 48, right: 48, bottom: 80, height: 96, display: 'flex', gap: 8}}>
        {all.map((p) => {
          const w = Math.max(1, Math.round((p.end - p.start) * fps));
          const on = cur && p.n === cur.n;
          return (
            <div key={p.n} style={{flex: w, borderRadius: 16, background: !p.keep ? 'rgba(255,255,255,.18)' : on ? '#3DEDC3' : 'rgba(61,237,195,.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...font, fontSize: 36, color: on ? '#05231D' : '#F2F3F5'}}>
              {p.n}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 48, bottom: 196, ...font, fontSize: 40, opacity: 0.8}}>
        {sec(frame / fps)} / {sec(total / fps)} с · оставлено {kept.length} из {all.length}
      </div>
    </AbsoluteFill>
  );
};
