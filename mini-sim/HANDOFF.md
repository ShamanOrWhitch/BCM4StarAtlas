# BCM4StarAtlas / Mini-Sim — актуальная передача

Дата: 2026-10-17.

## Источник истины

- Проверенный main: Mini-Sim 0.9.93, Tower 0.2.58, merge commit [09c0a955](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/09c0a9553daa6406302c3e54cd0bca1aaeff6702) from [PR #38](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/38).
- All five required GitHub Actions checks passed on the PR head, including browser smoke with asset overrides. The actual Android controls and WordPress install have not been verified/deployed.
- **Пользователь подтвердил, что возврат из астероидного лабиринта к карте текущего сектора работает.** Сохранять это поведение и не менять sector/return logic.
- Issues #21, #22, #24, #26, and #30 are closed. Remaining product feature: full SAGE galaxy map — [Issue #28](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/28). Issue #17 remains only as an automation coverage task for Room0 → B → Room1/global mute.

## Что меняется в 0.9.93

1. **Загрузка:** soundtrack заранее с высоким приоритетом; очередь ближайших стен запускается до правого видео, портал запрашивается после правого видео; наружные и декоративные текстуры остаются низкоприоритетными.
2. **Warp Tube на телефоне:** компактный HUD без больших заголовков/инструкций, управление наклоном телефона с перекалибровкой, осевое вращение возвращено примерно к 45% прежнего слишком сильного темпа.
3. **Deep Space:** когда экран зафиксирован тапом, drag пальцем вращает позицию корабля вокруг выбранного экрана, а не накручивает обычный обзор.
4. **Tower:** на современных телефонах используются Pointer Events без повторного touch-пути, скрытые P2-кнопки явно убраны из layout, чувствительность наклона P1 немного снижена. Прыжок и P2 требуется подтвердить на реальном телефоне после CI.

## Не затрагивать

- Не менять механизм возврата к текущему сектору и адаптер навигации.
- Не менять планету и её координаты (радиус 11, (-26, 9, -190)).
- Не возвращать случайную смену текстуры левой стены Room1.
- Не переписывать глобальный музыкальный микшер без нового воспроизводимого отказа.
- Не выдавать локальный Warp grid за полную SAGE карту или настоящий переход флота.

## Проверка

Regression workflow запускает JS parse check и source-contract tests; browser QA открывает https://walkingyog.com/bcm4sa/ с временной подменой ассетов и по умолчанию блокирует видео. Это не deploy на WordPress, не полная проверка видеоконтента и не измерение расхода батареи. Версию сайта проверять отдельно после установки плагина.

