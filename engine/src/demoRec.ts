import {getInputProps} from 'remotion';
import {DEMO_REC, type OwnerDemoId} from './template/ownerDemo';

// Запись владельца набора для превью стилей и образцов (npm run boards передаёт {demoRec: true}).
// В обычном монтаже входного параметра нет → null: в образцах стоит заглушка, ученик вписывает свою запись в REC.
// Какой ролик в каком образце — по смыслу (src/template/ownerDemo.ts, DEMO_REC).
export const demoOn = (): boolean => Boolean((getInputProps() as {demoRec?: boolean}).demoRec);
export const demoRec = (id: OwnerDemoId): string | null => (demoOn() ? DEMO_REC[id].src : null);
export const demoSpeaker = (id: OwnerDemoId) => (demoOn() ? DEMO_REC[id] : null);
