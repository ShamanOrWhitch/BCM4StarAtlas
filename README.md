# BCM4StarAtlas

Best Crew Missions 4 Star Atlas — симулятор / конфигуратор сбора команды и миссий.

Репозиторий: исходники приложения (экипаж, корабли, картограф, архив).

## Что внутри

- `src/routes/crew.tsx` — сбор команды
- `src/routes/ships.tsx` — корабли
- `src/routes/index.tsx` — главная / станция
- `src/data/` — данные экипажа, кораблей, систем
- `public/portraits/` — портреты рас

## Запуск

```bash
npm install
npm run dev
```

## Медиа кораблей

Галереи грузятся с официального CDN Star Atlas (`storage.googleapis.com/nft-assets`),
как в Galactic Marketplace / [Galaxy API](https://galaxy.staratlas.com/nfts).
Локальная папка `public/ships/` не нужна.
