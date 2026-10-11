import React from 'react';

// Стеклянная плитка для предмета, нарисованного кодом: когда нужного 3D-предмета нет в public/objects и public/obj,
// агент рисует его простым SVG (2–3 цвета стиля, толстые линии, без мелких деталей) и кладёт в эту плитку.
// Пример: <GlassTile size={420} tint="#FF7A2F"><svg viewBox="0 0 100 100">…ракета…</svg></GlassTile>
export const GlassTile: React.FC<{size: number; tint?: string; light?: boolean; style?: React.CSSProperties; children: React.ReactNode}> =
  ({size, tint = '#3DEDC3', light = false, style, children}) => (
    <div style={{position: 'relative', width: size, height: size, borderRadius: size * 0.26, overflow: 'hidden',
      background: light
        ? `linear-gradient(160deg, rgba(255,255,255,.95), rgba(255,255,255,.6)), radial-gradient(80% 80% at 30% 20%, ${tint}55, transparent 70%)`
        : `linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.04)), radial-gradient(80% 80% at 30% 20%, ${tint}66, transparent 70%), #121417`,
      boxShadow: `inset 0 2px 0 rgba(255,255,255,${light ? 0.9 : 0.35}), inset 0 0 0 1.5px rgba(255,255,255,${light ? 0.6 : 0.14}), 0 30px 60px rgba(0,0,0,.35)`,
      ...style}}>
      <div style={{position: 'absolute', inset: size * 0.16, display: 'grid', placeItems: 'center'}}>{children}</div>
      {/* блик стекла */}
      <div style={{position: 'absolute', left: 0, top: 0, right: 0, height: '45%', background: 'linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0))'}} />
    </div>
  );
