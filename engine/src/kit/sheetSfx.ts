import SHEET_SFX_RAW from './data/sheet-sfx.json';

// Звуки public/sfx/sheet: onset (начало звука), peak (удар) и длительность в секундах. Звук ставится так, чтобы удар
// пришёлся на событие: старт = время события - peak (или - onset, если нужен сам вход). Пример: reels/swap/Sym.tsx.
export const SHEET_SFX = SHEET_SFX_RAW as Record<string, {onset: number; peak: number; dur: number}>;
