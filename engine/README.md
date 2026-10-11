# Движок набора «AI монтаж»

Remotion-проект: стили, блоки движения, субтитры, скрипты и пак материалов. Ученик сюда не заходит — всё делает агент
по навыку `../.claude/skills/ai-montage/SKILL.md`. Команды (из этой папки):

```
npm run doctor        проверка          npm run setup        браузер + распознавание речи
npm run new -- <slug> <стиль>            новый ролик: custom, geroy (стиль 21) или стиль движка (CANVAS, LIQUID, PRISM…)
npm run prep -- <видео> <slug>           приём записи → public/work/<slug>/
npm run takes -- <slug> / cut -- <slug> <номера>   нарезка «последний полный дубль»
npm run transcribe -- <звук> <words.json>         пословная расшифровка
npm run pixabay -- … / pexels -- … / wikimedia -- …   вставки (Pixabay по умолчанию, Pexels по просьбе) и фото героев
npm run check / qa -- <id> / frames -- <id>       проверки и лист кадров
npm run draft|render|render:2k|render:4k -- <id> [--out путь]   рендер с громкостью −14 LUFS
```

Образцы стилей и роликов набора — в `patterns/` (номера стилей 1–21: `patterns/styles/НОМЕРА.md`).
