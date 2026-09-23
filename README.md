# BCM4StarAtlas

Best Crew Missions 4 Star Atlas — симулятор / конфигуратор сбора команды и миссий. Живой каталог называется Galia: карта с орбитальной станцией, экипаж, флот, цены ресурсов и сейф кошелька.

## Что внутри

- `src/routes/index.tsx` — карта Galia, глобус
- `src/routes/crew.tsx` — сбор команды
- `src/routes/ships.tsx` — корабли
- `src/routes/market.tsx` — сборщик цен ресурсов
- `src/routes/wallet.tsx` — кошелёк, инвентарь и способности NFT
- `src/data/` — экипаж, корабли, системы
- `wordpress/galia-desk/` — плагин для WordPress, шорткод `[galia_desk]`
- `mini-sim/` — тестовый 6DOF-симулятор, шорткод `[bcm_mini_sim]`

## Запуск

```bash
npm install
npm run dev
```

## Откуда цифры

По [документации Star Atlas Build](https://build.staratlas.com/dev-resources/apis-and-data/galaxy-api):

- каталог предметов — `GET https://galaxy.staratlas.com/nfts`
- оборот ATLAS и POLIS — `GET https://galaxy.staratlas.com/tokens/atlas` и `/polis`
- живых цен в Galaxy API нет. Лучшая продажа и покупка читаются из стакана Galactic Marketplace, программа `traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg`, счёт ордера 201 байт. Котировка ресурсов — ATLAS
- доллар ATLAS/POLIS — Jupiter price API
- снимки для «насколько изменилось» хранятся в браузере

Кошелёк только на чтение, без подписи:

- то, что лежит на адресе — SPL и Token-2022
- корабли и ресурсы сверяются с каталогом Galaxy
- уникальный экипаж в этот каталог не входит (там 13 старых карточек). Имя и способности берутся из Metaplex metadata NFT
- личность в игре — Player Profile `pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9`, ключ кошелька лишь один из ProfileKey
- груз SAGE сидит в Cargo и Profile Vault, не на кошельке

## WordPress

Плагин карты целиком сюда не ставится: глобус Galia — это само приложение. На страницу сайта ставится стол цен и сейф.

1. Запакуй папку `wordpress/galia-desk` в zip
2. Плагины → Добавить → Загрузить
3. Включи Galia Desk
4. На страницу вставь шорткод `[galia_desk]`
5. На хостинге нужен PHP с GMP или BCMath, иначе стакан не посчитается

Симулятор по-прежнему: `[bcm_mini_sim]`

## Медиа кораблей

Галереи можно грузить с официального CDN Star Atlas. Локальная `public/ships/` для сайта не обязательна.
