import { useMemo, useState } from "react";
import { Gem, Search, SlidersHorizontal, Star, X } from "lucide-react";
import {
  APTITUDES,
  CREW,
  OFFICIAL,
  SPECIES,
  displayName,
  flyOk,
  mismatch,
  seats,
  tensorTier,
  xpSpread,
  type Crew,
  type TensorTier,
} from "@/data/crew";
import { DIAMOND_ROWS, STATIONS, XP_RATES, diamondRecipe } from "@/data/diamonds";
import { EMPTY_QUERY, PRESETS, filterCrew, houses, type CrewQuery, type SortKey } from "@/lib/crew-query";
import { loadStars, saveStars } from "@/lib/crew-stars";
import { CrewPortrait } from "@/components/crew/portrait";
import { packetOf } from "@/data/packets";
import { influenceFromRoster } from "@/lib/crew-score";
import { AppChrome } from "@/components/app-chrome";

const TIER_LABEL: Record<TensorTier | "unknown", string> = {
  anomaly: "Anomaly",
  legendary: "Legendary",
  epic: "Epic",
  rare: "Rare",
  uncommon: "Uncommon",
  common: "Common",
  unknown: "—",
};

const TIER_CLASS: Record<TensorTier | "unknown", string> = {
  anomaly: "text-tensor-anomaly",
  legendary: "text-tensor-legend",
  epic: "text-tensor-epic",
  rare: "text-tensor-rare",
  uncommon: "text-tensor-uncommon",
  common: "text-tensor-common",
  unknown: "text-faint",
};

const TIER_DOT: Record<TensorTier | "unknown", string> = {
  anomaly: "bg-tensor-anomaly",
  legendary: "bg-tensor-legend",
  epic: "bg-tensor-epic",
  rare: "bg-tensor-rare",
  uncommon: "bg-tensor-uncommon",
  common: "bg-tensor-common",
  unknown: "bg-faint",
};

export function CrewBay() {
  const [query, setQuery] = useState<CrewQuery>(EMPTY_QUERY);
  const [preset, setPreset] = useState("all");
  const [picked, setPicked] = useState<string | null>(CREW[0]?.id ?? null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [diamondOpen, setDiamondOpen] = useState(false);
  const [stars, setStars] = useState<string[]>(() => (typeof window === "undefined" ? [] : loadStars()));

  const rows = useMemo(() => filterCrew(query), [query]);
  const selected = rows.find((c) => c.id === picked) ?? rows[0] ?? null;

  function patch(p: Partial<CrewQuery>, presetId = "") {
    setQuery((q) => ({ ...q, ...p }));
    setPreset(presetId);
  }

  function toggleStar(id: string) {
    setStars((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveStars(next);
      return next;
    });
  }

  function toggleArr<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  return (
    <AppChrome
      current="crew"
      kicker="Star Atlas · крио"
      title={`Экипаж · ${CREW.length}`}
      actions={
        <button
          type="button"
          onClick={() => setDiamondOpen(true)}
          className="flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 font-display text-sm"
        >
          <Gem className="size-4 text-ice" />
          <span className="hidden sm:inline">Алмаз</span>
        </button>
      }
    >
      <div className="flex h-full min-h-0">
        <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line p-4 md:flex">
          <Filters query={query} patch={patch} toggleArr={toggleArr} />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-3 border-b border-line px-4 py-3 md:px-5">
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <input
                  value={query.q}
                  onChange={(e) => patch({ q: e.target.value })}
                  placeholder="Имя, дом, университет"
                  className="h-11 w-full rounded-lg border border-line bg-surface pr-3 pl-10 text-sm text-fg outline-none placeholder:text-faint focus:border-brass-dim"
                />
              </label>
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 font-display text-sm md:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="size-4 text-brass" />
                Фильтр
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setQuery({ ...EMPTY_QUERY, ...p.apply });
                    setPreset(p.id);
                  }}
                  className={`h-11 shrink-0 rounded-full border px-3 font-display text-sm transition-colors duration-150 ${
                    preset === p.id
                      ? "border-brass-dim bg-surface-2 text-fg"
                      : "border-line text-muted hover:text-fg"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-muted tabular-nums">
                {rows.length} / {CREW.length}
                <span className="text-faint"> · Tensor rank ↑ как на витрине</span>
              </p>
              <label className="flex items-center gap-2 font-display text-sm text-muted">
                Сорт
                <select
                  value={query.sort}
                  onChange={(e) => patch({ sort: e.target.value as SortKey })}
                  className="h-11 rounded-md border border-line bg-surface px-2 text-fg"
                >
                  <option value="tensor">Tensor #</option>
                  <option value="official">Алмаз XP</option>
                  <option value="n">N ↑ спокойные</option>
                  <option value="c">C ↓ чеклист</option>
                  <option value="name">Имя</option>
                </select>
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
            {rows.length === 0 ? (
              <p className="px-2 py-10 text-center text-muted">Никого. Снимите фильтр.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((c) => {
                  const t = tensorTier(c.tensorRank);
                  const active = selected?.id === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(c.id);
                          setMobileDetail(true);
                        }}
                        className={`flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors duration-150 ${
                          active ? "border-brass-dim bg-surface-2" : "border-line bg-surface hover:bg-surface-2/70"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <CrewPortrait crew={c} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-base font-medium">{displayName(c)}</p>
                            <p className="truncate text-xs text-muted">
                              {c.species.replace(" Punaab", "")}
                              {c.house ? ` · ${c.house}` : ""}
                              {packetOf(c.id) ? ` · ${packetOf(c.id)}` : ""}
                            </p>
                          </div>
                          <span className={`font-mono text-xs tabular-nums ${TIER_CLASS[t]}`}>
                            #{c.tensorRank?.toLocaleString("en") ?? "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${TIER_DOT[t]}`} />
                          <span className={`font-mono text-xs ${TIER_CLASS[t]}`}>{TIER_LABEL[t]}</span>
                          <span className="text-faint">/</span>
                          <span className="font-mono text-xs text-ice">{c.official}</span>
                          {mismatch(c) ? <span className="font-mono text-xs text-brass">пол</span> : null}
                          <span className="font-mono text-xs text-faint">+{xpSpread(c)}%</span>
                          {stars.includes(c.id) ? <Star className="size-3 fill-brass text-brass" /> : null}
                        </div>
                        <p className="truncate font-mono text-xs text-muted">
                          {c.aptitudes.map((a) => `${a.name} +${a.xp}%`).join(" · ")}
                        </p>
                        <p className="font-mono text-xs text-faint tabular-nums">
                          N {c.n} · C {c.c}
                          {flyOk(c) ? " · штурвал" : hasFlight(c) ? " · не штурвал" : ""}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {selected ? (
          <div className="hidden w-80 shrink-0 overflow-y-auto border-l border-line lg:block">
            <Detail crew={selected} starred={stars.includes(selected.id)} onStar={() => toggleStar(selected.id)} />
          </div>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-30 bg-bg/70 md:hidden" onClick={() => setFiltersOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-14 max-h-[75vh] overflow-y-auto rounded-t-xl border border-line bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg">Фильтры</p>
              <button type="button" className="flex size-11 items-center justify-center" onClick={() => setFiltersOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <Filters query={query} patch={patch} toggleArr={toggleArr} />
          </div>
        </div>
      ) : null}

      {mobileDetail && selected ? (
        <div className="fixed inset-0 z-20 bg-bg/70 lg:hidden" onClick={() => setMobileDetail(false)}>
          <div
            className="absolute inset-x-0 bottom-14 max-h-[80vh] overflow-y-auto rounded-t-xl border border-line bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end p-2">
              <button type="button" className="flex size-11 items-center justify-center" onClick={() => setMobileDetail(false)}>
                <X className="size-5" />
              </button>
            </div>
            <Detail crew={selected} starred={stars.includes(selected.id)} onStar={() => toggleStar(selected.id)} />
          </div>
        </div>
      ) : null}

      {diamondOpen ? <DiamondPanel onClose={() => setDiamondOpen(false)} /> : null}
    </AppChrome>
  );
}

function hasFlight(c: Crew) {
  return c.aptitudes.some((a) => a.name === "Flight");
}

function Filters({
  query,
  patch,
  toggleArr,
}: {
  query: CrewQuery;
  patch: (p: Partial<CrewQuery>) => void;
  toggleArr: <T>(list: T[], value: T) => T[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-xs tracking-[0.18em] text-brass uppercase">Две шкалы</p>
      <p className="text-sm leading-snug text-muted">
        Бирюзовый алмаз на play.staratlas — слоты XP, не цвет Tensor. Rare = три ветки. Сейчас в SAGE алмаз не качает урон.
      </p>

      <Field label="Tensor (цвет карты)">
        <ChipRow>
          {(["anomaly", "legendary", "epic", "rare", "uncommon", "common"] as TensorTier[]).map((t) => (
            <Chip
              key={t}
              on={query.tensor.includes(t)}
              onClick={() => patch({ tensor: toggleArr(query.tensor, t) })}
            >
              <span className={`size-1.5 rounded-full ${TIER_DOT[t]}`} />
              {TIER_LABEL[t]}
            </Chip>
          ))}
        </ChipRow>
      </Field>

      <Field label="Алмаз XP">
        <ChipRow>
          {OFFICIAL.map((r) => (
            <Chip
              key={r}
              on={query.official.includes(r)}
              onClick={() => patch({ official: toggleArr(query.official, r) })}
            >
              {r}
            </Chip>
          ))}
        </ChipRow>
      </Field>

      <Field label="Профессия">
        <ChipRow>
          {APTITUDES.map((a) => (
            <Chip
              key={a}
              on={query.aptitudes.includes(a)}
              onClick={() => patch({ aptitudes: toggleArr(query.aptitudes, a) })}
            >
              {a}
            </Chip>
          ))}
        </ChipRow>
        <div className="mt-2 flex gap-1">
          {(["any", "major", "minor"] as const).map((s) => (
            <Chip key={s} on={query.slot === s} onClick={() => patch({ slot: s })}>
              {s === "any" ? "любой слот" : s === "major" ? "+50%" : "+25%"}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Раса">
        <ChipRow>
          {SPECIES.map((s) => (
            <Chip
              key={s}
              on={query.species.includes(s)}
              onClick={() => patch({ species: toggleArr(query.species, s) })}
            >
              {s.replace(" Punaab", "")}
            </Chip>
          ))}
        </ChipRow>
      </Field>

      <Field label="Дом">
        <ChipRow>
          {houses().map((h) => (
            <Chip key={h} on={query.house === h} onClick={() => patch({ house: query.house === h ? null : h })}>
              {h}
            </Chip>
          ))}
        </ChipRow>
      </Field>

      <Field label={`Нервозность ≤ ${query.nMax}`}>
        <input
          type="range"
          min={0}
          max={100}
          value={query.nMax}
          onChange={(e) => patch({ nMax: Number(e.target.value) })}
          className="w-full accent-brass"
        />
      </Field>
      <Field label={`Дисциплина ≥ ${query.cMin}`}>
        <input
          type="range"
          min={0}
          max={100}
          value={query.cMin}
          onChange={(e) => patch({ cMin: Number(e.target.value) })}
          className="w-full accent-brass"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={query.flyOnly} onChange={(e) => patch({ flyOnly: e.target.checked })} />
        Только штурвал (N≤60 C≥30 + Flight)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={query.mismatchOnly}
          onChange={(e) => patch({ mismatchOnly: e.target.checked })}
        />
        Пол-раритет: Common XP + золото/эпик Tensor
      </label>

      <button
        type="button"
        className="h-11 rounded-lg border border-line font-display text-sm text-muted hover:text-fg"
        onClick={() => patch(EMPTY_QUERY)}
      >
        Сбросить
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-display text-xs tracking-wide text-muted uppercase">{label}</p>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-display text-xs transition-colors duration-150 ${
        on ? "border-brass-dim bg-surface-2 text-fg" : "border-line text-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Detail({ crew, starred, onStar }: { crew: Crew; starred: boolean; onStar: () => void }) {
  const t = tensorTier(crew.tensorRank);
  const gem = diamondRecipe(crew.official);
  const influence = influenceFromRoster(crew);
  return (
    <div className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <CrewPortrait crew={crew} size="lg" />
          <div className="min-w-0">
            <p className={`font-mono text-xs ${TIER_CLASS[t]}`}>
              Tensor #{crew.tensorRank?.toLocaleString("en") ?? "—"} · {TIER_LABEL[t]}
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold leading-tight">{displayName(crew)}</h2>
            <p className="mt-1 text-sm text-muted">
              {crew.species} · {crew.sex}
              {crew.house ? ` · ${crew.house}` : ""}
            </p>
            {packetOf(crew.id) ? (
              <p className="mt-1 font-mono text-xs text-brass">{packetOf(crew.id)}</p>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={onStar} className="flex size-11 items-center justify-center rounded-md border border-line">
          <Star className={`size-4 ${starred ? "fill-brass text-brass" : "text-muted"}`} />
        </button>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        <Stat k="Алмаз" v={crew.official} />
        <Stat k="Рецепт" v={gem.recipe} />
        <Stat k="XP spread" v={`+${xpSpread(crew)}%`} />
        <Stat k="Ветки" v={String(crew.aptitudes.length)} />
        {crew.university ? <Stat k="Универ" v={crew.university.replace(" University", "")} /> : null}
        {crew.age ? <Stat k="Возраст" v={String(crew.age)} /> : null}
      </dl>

      <p className="mt-5 font-display text-xs tracking-wide text-muted uppercase">Aptitudes</p>
      <ul className="mt-2 flex flex-col gap-1">
        {crew.aptitudes.map((a) => (
          <li key={a.name} className="flex justify-between rounded-md bg-surface-2 px-3 py-2 font-mono text-sm">
            <span>{a.name}</span>
            <span className={a.xp === 50 ? "text-brass" : "text-ice"}>+{a.xp}%</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 font-display text-xs tracking-wide text-muted uppercase">OCEAN</p>
      <ul className="mt-2 flex flex-col gap-2">
        <Bar label="N нервы" value={crew.n} warn={crew.n >= 80} good={crew.n <= 30} />
        <Bar label="C чеклист" value={crew.c} warn={crew.c <= 15} good={crew.c >= 75} />
        <Bar label="O открытость" value={crew.o} />
        <Bar label="E экстра" value={crew.e} />
        <Bar label="A согласие" value={crew.a} />
      </ul>

      <p className="mt-5 font-display text-xs tracking-wide text-muted uppercase">На борт</p>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <Stat k="Задание" v={`${influence.mission}%`} />
        <Stat k="Штурвал" v={`${influence.helm}%`} />
        <Stat k="Корпус" v={`${influence.hull}%`} />
        <Stat k="Сенсор" v={`${influence.scan}%`} />
      </dl>
      <p className="mt-2 text-sm leading-snug text-muted">{influence.line}</p>

      <p className="mt-5 font-display text-xs tracking-wide text-muted uppercase">Слоты</p>
      <p className="mt-2 font-display text-sm text-ice">{seats(crew).join(" · ") || "—"}</p>
      {crew.note ? <p className="mt-4 text-sm leading-snug text-muted">{crew.note}</p> : null}
      {mismatch(crew) ? (
        <p className="mt-4 text-sm leading-snug text-brass">
          Пол-раритет: Tensor выше алмаза. Так ловили кэпов с витрины.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <p className="font-mono text-xs text-faint">{k}</p>
      <p className="font-display text-sm">{v}</p>
    </div>
  );
}

function Bar({ label, value, warn, good }: { label: string; value: number; warn?: boolean; good?: boolean }) {
  const tone = warn ? "bg-danger" : good ? "bg-ok" : "bg-ice";
  return (
    <li>
      <div className="mb-1 flex justify-between font-mono text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </li>
  );
}

function DiamondPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-bg/70" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-14 max-h-[85vh] overflow-y-auto rounded-t-xl border border-line bg-surface md:inset-y-8 md:right-8 md:bottom-8 md:left-auto md:w-[32rem] md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-xs tracking-[0.18em] text-ice uppercase">Официальный алмаз</p>
            <h2 className="font-display text-2xl font-semibold">Слоты XP, не Tensor</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-md border border-line">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-5 p-5">
          <p className="text-sm leading-relaxed text-muted">
            Бирюзовый камень на play.staratlas.com/crew — редкость минтинга. Она задаёт сколько веток aptitudes выпало и насколько быстро они качаются. Цвет карточки Tensor — другой рынок: слои костюма, не XP.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            В SAGE сейчас все равны: алмаз не даёт урон. Заточит UE5 и станции корабля. Команда специально не делала pay-to-win статы — только больше деревьев.
          </p>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-surface-2 text-faint">
                <tr>
                  <th className="px-3 py-2 font-display font-medium">Алмаз</th>
                  <th className="px-3 py-2 font-display font-medium">Рецепт</th>
                  <th className="px-3 py-2 font-display font-medium">XP</th>
                </tr>
              </thead>
              <tbody>
                {DIAMOND_ROWS.map((r) => (
                  <tr key={r.rarity} className="border-t border-line">
                    <td className="px-3 py-2 text-ice">{r.rarity}</td>
                    <td className="px-3 py-2 text-fg">{r.recipe}</td>
                    <td className="px-3 py-2 text-brass">{r.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-2 font-display text-xs tracking-wide text-muted uppercase">Скорость кача</p>
            <ul className="flex flex-col gap-1">
              {XP_RATES.map((x) => (
                <li key={x.slot} className="flex justify-between rounded-md bg-surface-2 px-3 py-2 font-mono text-sm">
                  <span className="text-muted">{x.slot}</span>
                  <span>{x.rate}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 font-display text-xs tracking-wide text-muted uppercase">Станции</p>
            <ul className="flex flex-col gap-1">
              {STATIONS.map((s) => (
                <li key={s.apt} className="flex justify-between gap-3 rounded-md px-1 py-1.5 text-sm">
                  <span className="font-display text-fg">{s.apt}</span>
                  <span className="text-right text-muted">{s.seats}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm leading-relaxed text-muted">
            Перки с разных веток складываются на корабле, с убывающей отдачей. Поэтому Rare на три станции сильнее Common-специалиста: не пик одной ветки, а набор перков. Epic (два major) качает две роли быстрее Rare. Legendary — три major. Anomaly ломает таблицу: все minor или +100% на одну.
          </p>
          <p className="text-sm leading-relaxed text-brass">
            Охота с пола: Tensor золото на алмазе Common — косметика. Охота кэпов: алмаз Rare с веткой Command. N и C алмаз не видит.
          </p>
        </div>
      </div>
    </div>
  );
}
