# BCM4StarAtlas / Mini-Sim — актуальная передача

Дата: 2026-10-20.

## Источник истины

- Main: Mini-Sim **0.9.102**, Tower **0.2.62**. Активный WORK LOCK [#43](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/43).
- Текущая задача: Crew starts in visibly controllable movement mode (left stick), LB/V switches between movement and helm; cached Crew art uses one upload/orientation path. E pumps and extinguishes visible smoke/fire. Compartments persist integrity/external-hole/water/smoke/fire state and expose impact/patch hooks; a real exterior EVA scene is still future work. Warp Tube geometry is +12% while a separate shimmer clock keeps its previous tempo; hazards are faster, 22 layers are randomized per run and adjacent safe-lane changes are bounded. Asteroid comeback pose is stored separately from the original launch pose and should be restored before physics resumes.
- Source-contract and regression checks for 0.9.102 must be confirmed on the new commit. Browser QA, physical Android/gamepad testing and WordPress deployment are separate; live behavior is not confirmed yet.
- Ранее подтверждено пользователем: возврат из астероидного лабиринта к карте текущего сектора работает. Не менять навигацию/сектор/путь возврата.
- Полная карта SAGE/галактики — [Issue #28](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/28). Локальная Warp-сцена не является реальным перемещением флота или on-chain интеграцией.

## Последние изменения

1. `deep-space-warp.js`: весь pool `asterwall*` используется по стеновым batches; asset pool остаётся ограниченным фильтром имени/типа картинки, но больше не ограничивается четырьмя текстурами. На ошибку загрузки предусмотрен fallback.
2. `tower.js`: count птиц — 38; ширина обычных платформ 3.23, глубина 1.9. Допуск контакта ноги сохранён; добавлены эффект двойного прыжка и три типа коробок-бустов.
3. Версии/кэш: Mini-Sim 0.9.102, Tower 0.2.62; source-contract expectations sync with the Crew/Warp changes.
4. Warp remains 8×→64×; tube geometry advances 12% faster while the independent shimmer clock preserves its prior tempo. Hazards use a faster curve, 22 layers and a fresh per-run seed; sweeper rotation formula itself is unchanged.

## Не затрагивать

- Не менять адаптер навигации вне тестируемой local-return anchor correction. `galia-desk`, сканер и таблицы цен полностью вне области изменений.
- Не менять планету и её координаты (радиус 11, (-26, 9, -190)).
- Не возвращать случайную смену текстуры левой стены Room1.
- Не переписывать глобальный музыкальный микшер без нового воспроизводимого отказа.
- Не выдавать локальный Warp grid за полную SAGE карту или настоящий переход флота.

## Проверка и развёртывание

Regression workflow проверяет синтаксис Tower и source contracts. Browser QA может подменять JS/CSS выбранного коммита, но это не deploy на WordPress, не полная проверка видео и не тест на физическом Android. После merge отдельно проверить версию сайта и управление на телефоне.
