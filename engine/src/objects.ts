// 3D-предметы набора: стеклянные (public/objects/<имя>.png и .webp) и объёмные иконки (public/obj/<имя>.png).
// Агент выбирает предмет по смыслу фразы по имени. Нужного нет — рисует его кодом: SVG в стеклянной плитке
// (src/kit/GlassTile.tsx), а не подставляет случайный предмет.
// Незнакомое имя не роняет рендер: ставится запасной предмет, в консоли — предупреждение.
export const OBJECTS = ['book', 'coins', 'comment', 'dev-happy', 'food', 'gift-box', 'gift-open', 'heart', 'hourglass', 'laptop',
  'mic', 'person', 'repost', 'sad-face', 'scissors', 'tuxedo'] as const;
export const ICONS3D = ['calendar', 'chat-bubble', 'credit-card', 'dollar', 'link', 'money', 'rocket', 'setting', 'trophy'] as const;

export const objectPath = (name: string | undefined, ext: 'png' | 'webp' = 'webp', fallback = 'laptop') => {
  if (name && (ICONS3D as readonly string[]).includes(name)) return `obj/${name}.png`;
  const ok = !!name && (OBJECTS as readonly string[]).includes(name);
  if (name && !ok) console.warn(`нет предмета «${name}» (есть: ${[...OBJECTS, ...ICONS3D].join(', ')}) — поставлен «${fallback}»; нужный предмет нарисуй кодом в GlassTile`);
  return `objects/${ok ? name : fallback}.${ext}`;
};
