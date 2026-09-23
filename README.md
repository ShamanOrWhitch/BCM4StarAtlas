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
- доллар ATLAS/POLIS и 24ч — Jupiter price API
- свечи ATLAS — общий рынок MEXC, интервал 4 часа. Это не снимок браузера и не внутренний ноль
- у Galaxy нет истории стакана ресурсов. Δ ресурсов копится общим снимком: в приложении на сервере, на сайте WordPress — в опции `galia_desk_tape`

Кошелёк только на чтение. Подпись транзакции не нужна и трюм не открывает. Phantom лишь называет публичный адрес.

- то, что лежит на адресе — SPL, Token-2022, ATLAS, POLIS и NFT
- уникальный экипаж не входит в Galaxy `/nfts`. Имя, OCEAN, волосы и скин берутся из метадаты NFT
- влияние OCEAN на задание, штурвал, корпус и сенсор — мерка симулятора, её видно на карточке экипажа и в сейфе. SAGE такую формулу публично не отдаёт
- личность в игре — Player Profile `pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9`. Ищем ключ среди первых трёх ProfileKey и имена флотов SAGE
- груз в Cargo и корабли, уже посаженные во флот, на адресе не лежат. Пустой список токенов при живом профиле — это норма, не поломка чтения

## WordPress

Плагин карты целиком сюда не ставится: глобус Galia — это само приложение. На страницу сайта ставится один стол: свечи, цены и сейф. Лабиринт mini-sim своим шорткодом не трогаем.

1. Запакуй папку `wordpress/galia-desk` в zip (это обновление того же плагина, не второй)
2. Плагины → Добавить → Загрузить, либо замени файлы уже включённого Galia Desk
3. Включи Galia Desk
4. На страницу вставь шорткод `[galia_desk]`
5. На хостинге нужен PHP с GMP или BCMath, иначе стакан не посчитается

Симулятор по-прежнему отдельно: `[bcm_mini_sim]`

## Медиа кораблей

Галереи можно грузить с официального CDN Star Atlas. Локальная `public/ships/` для сайта не обязательна.
