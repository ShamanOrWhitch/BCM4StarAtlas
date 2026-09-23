import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppChrome } from "@/components/app-chrome";
import { scanDeskWallet, type WalletItem, type WalletScan } from "@/lib/desk";
import { influenceFromTraits } from "@/lib/crew-score";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

const KIND: Record<WalletItem["kind"], string> = {
  crew: "экипаж",
  ship: "корабль",
  structure: "структура",
  resource: "ресурс",
  nft: "NFT",
  other: "прочее",
};

type PhantomProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
};

function phantom(): PhantomProvider | null {
  const win = window as Window & { solana?: PhantomProvider };
  return win.solana?.isPhantom ? win.solana : null;
}

function WalletPage() {
  const [owner, setOwner] = useState("");
  const [scan, setScan] = useState<WalletScan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPhantom, setHasPhantom] = useState(false);

  async function connect() {
    setError("");
    const provider = phantom();
    if (!provider) {
      setHasPhantom(false);
      setError("Phantom в этом браузере не найден. Вставь публичный ключ — чтение без подписи.");
      return;
    }
    setHasPhantom(true);
    const res = await provider.connect();
    setOwner(res.publicKey.toString());
    await run(res.publicKey.toString());
  }

  async function run(address = owner) {
    const next = address.trim();
    if (!next) {
      setError("Нужен адрес кошелька.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setScan(await scanDeskWallet({ data: { owner: next } }));
    } catch (err) {
      setScan(null);
      setError(err instanceof Error ? err.message : "Кошелёк не прочитался");
    } finally {
      setLoading(false);
    }
  }

  const groups = ["crew", "ship", "structure", "resource", "nft", "other"] as const;

  return (
    <AppChrome current="wallet" kicker="Player Profile · только чтение" title="Сейф кошелька">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 md:px-6">
          <p className="max-w-3xl text-sm text-muted">
            Подпись транзакции не открывает трюм. Phantom только подтверждает, что сайт видит публичный адрес — реестр Solana и так
            читается без неё. На ключе видны SPL, Token-2022, ATLAS, POLIS и NFT. Корабли и груз, которые уже в SAGE, лежат во флоте и
            Cargo. Если ключ записан в Player Profile первым, вторым или третьим, ниже появятся флот и его имя. OCEAN и причёска берутся
            из метадаты NFT и меряются формулой симулятора, не скрытым бонусом SAGE.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="Публичный ключ"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-sm text-fg outline-none placeholder:text-faint"
            />
            <button type="button" onClick={() => void connect()} className="h-11 rounded-lg border border-line px-3 font-display text-sm">
              {hasPhantom ? "Phantom" : "Кошелёк"}
            </button>
            <button
              type="button"
              onClick={() => void run()}
              className="h-11 rounded-lg border border-brass bg-surface-2 px-3 font-display text-sm text-fg"
            >
              {loading ? "Читаю…" : "Показать"}
            </button>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {scan ? (
            <>
              <p className="font-mono text-xs text-faint">
                {scan.owner} · {scan.items.length} на ключе
                {scan.skippedMeta ? ` · ещё ${scan.skippedMeta} NFT не открыты за один проход` : ""}
              </p>
              {scan.rpcWarning ? <p className="text-sm text-danger">{scan.rpcWarning}</p> : null}
              {scan.profiles.length ? (
                <section className="flex flex-col gap-2">
                  <h2 className="font-display text-sm tracking-[0.16em] text-brass uppercase">В игре</h2>
                  {scan.profiles.map((profile) => (
                    <article key={profile.profile} className="rounded-xl border border-line bg-surface p-3">
                      <p className="font-mono text-xs text-faint">{profile.profile}</p>
                      <p className="mt-1 text-sm text-muted">ключей на профиле: {profile.keys || "—"}</p>
                      {profile.fleets.length ? (
                        <ul className="mt-2 flex flex-col gap-1">
                          {profile.fleets.map((fleet) => (
                            <li key={`${profile.profile}-${fleet.name}`} className="text-sm text-fg">
                              {fleet.name}
                              <span className="text-muted"> · фракция {fleet.faction}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted">Флотов SAGE на этом профиле не видно.</p>
                      )}
                    </article>
                  ))}
                </section>
              ) : (
                <p className="text-sm text-muted">
                  Профиль по этому ключу не найден среди первых трёх ProfileKey. Либо ключ не привязан, либо он четвёртый и дальше. Пустой
                  список токенов при этом нормален: игра держит корабли и ресурсы не на адресе.
                </p>
              )}
              {!scan.items.length ? (
                <p className="text-sm text-muted">На самом ключе токенов Star Atlas нет. Это не отказ сайта и не отсутствие подписи.</p>
              ) : null}
              {groups.map((kind) => {
                const rows = scan.items.filter((item) => item.kind === kind);
                if (!rows.length) return null;
                return (
                  <section key={kind}>
                    <h2 className="mb-2 font-display text-sm tracking-[0.16em] text-brass uppercase">{KIND[kind]}</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {rows.map((item) => (
                        <article key={`${item.mint}-${item.amount}`} className="galia-hop flex gap-3 rounded-xl border border-line bg-surface p-3">
                          {item.image ? (
                            <img src={item.image} alt="" className="size-16 shrink-0 rounded-lg bg-surface-2 object-cover" />
                          ) : (
                            <div className="size-16 shrink-0 rounded-lg bg-surface-2" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-display text-base text-fg">{item.name}</p>
                            <p className="text-sm text-muted">
                              ×{item.amount.toLocaleString("ru-RU")}
                              {item.className ? ` · ${item.className}` : ""}
                              {item.rarity ? ` · ${item.rarity}` : ""}
                              {item.spec ? ` · ${item.spec}` : ""}
                            </p>
                            <TraitBlock item={item} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
              <p className="pb-6 text-sm text-muted">{scan.note}</p>
            </>
          ) : null}
        </div>
      </div>
    </AppChrome>
  );
}

function TraitBlock({ item }: { item: WalletItem }) {
  const influence = item.kind === "crew" || item.traits.length ? influenceFromTraits(item.traits) : null;
  return (
    <>
      {item.traits.length ? (
        <ul className="mt-1 space-y-0.5 text-sm text-ice">
          {item.traits.slice(0, 8).map((trait) => (
            <li key={trait.trait}>
              {trait.trait}: {trait.value}
            </li>
          ))}
        </ul>
      ) : null}
      {influence && (influence.ocean || influence.helm || influence.hull || influence.scan || influence.mission) ? (
        <p className="mt-1 text-sm text-fg">
          задание {influence.mission}% · штурвал {influence.helm}% · корпус {influence.hull}% · сенсор {influence.scan}%
        </p>
      ) : null}
      {influence?.hair || influence?.skin ? (
        <p className="mt-1 text-sm text-brass">
          {influence.hair ? `волосы ${influence.hair}` : ""}
          {influence.skin ? ` · скин ${influence.skin}` : ""}. Скин — слот рядом с бортом, не второй плагин.
        </p>
      ) : null}
    </>
  );
}
