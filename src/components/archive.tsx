import { useRef, useState } from "react";
import { Archive, Copy, Download, Upload, X } from "lucide-react";
import {
  applyBackup,
  buildSnapshot,
  downloadFile,
  lastExport,
  rememberExport,
  snapshotHtml,
  snapshotJson,
  snapshotWp,
  stamp,
} from "@/lib/backup";

export function ArchiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-surface font-display text-sm md:w-auto md:px-3"
      aria-label="Архив"
    >
      <Archive className="size-4 text-brass" />
      <span className="hidden md:inline">Архив</span>
    </button>
  );
}

export function ArchivePanel({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const snap = buildSnapshot();
  const last = lastExport();

  function mark(ok: string) {
    rememberExport();
    setError(null);
    setStatus(ok);
  }

  function saveHtml() {
    downloadFile(`galia-${stamp()}.html`, snapshotHtml(snap), "text/html;charset=utf-8");
    mark("HTML-страница скачана. Залей в корень сайта → /galia.html");
  }

  function saveWp() {
    downloadFile(`galia-wordpress-${stamp()}.html`, snapshotWp(snap), "text/html;charset=utf-8");
    mark("Фрагмент WordPress скачан");
  }

  async function copyWp() {
    const text = snapshotWp(snap);
    try {
      await navigator.clipboard.writeText(text);
      mark("Скопировано. В WordPress: Страницы → Добавить → блок «Произвольный HTML» → вставить");
    } catch {
      downloadFile(`galia-wordpress-${stamp()}.html`, text, "text/html;charset=utf-8");
      mark("Буфер недоступен — скачал файл фрагмента");
    }
  }

  function saveJson() {
    downloadFile(`galia-${stamp()}.json`, snapshotJson(snap), "application/json");
    mark(`JSON · ${snap.crew.length} экипаж, ${snap.ships.length} судов`);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const result = applyBackup(parsed);
      if (!result.ok) {
        setStatus(null);
        setError(result.error);
        return;
      }
      setError(null);
      setStatus(`Вернул звёзды ${result.stars} и метки карты ${result.favorites}`);
    } catch {
      setStatus(null);
      setError("Не разобрать JSON.");
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 bg-bg/70" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-14 max-h-[85vh] overflow-y-auto rounded-t-xl border border-line bg-surface text-fg md:inset-y-8 md:right-8 md:bottom-8 md:left-auto md:w-[30rem] md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-xs tracking-[0.18em] text-brass uppercase">WordPress · HTML</p>
            <h2 className="font-display text-2xl font-semibold">На свой сайт</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-md border border-line">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm leading-relaxed text-muted">
            Zip приложения в WordPress не ставится — это не плагин. Каталог кладётся страницей. Два пути:
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              <span className="text-fg">Файл HTML</span> — в файловом менеджере хостинга положи{" "}
              <span className="font-mono text-brass">galia.html</span> рядом с WordPress. Адрес: сайт/galia.html
            </li>
            <li>
              <span className="text-fg">Блок WordPress</span> — Страницы → Добавить → «Произвольный HTML» → вставить
              фрагмент. Без скриптов, тему не ломает.
            </li>
          </ol>

          <p className="font-mono text-xs text-faint">
            Сейчас {snap.crew.length} карточек · {snap.ships.length} судов
            {last ? ` · съём ${new Date(last).toLocaleString("ru-RU")}` : ""}
          </p>

          <button
            type="button"
            onClick={() => void copyWp()}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-brass-dim bg-surface-2 font-display text-sm"
          >
            <Copy className="size-4 text-brass" />
            Скопировать в WordPress
          </button>
          <button
            type="button"
            onClick={saveWp}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line font-display text-sm"
          >
            <Download className="size-4 text-brass" />
            Скачать фрагмент WP
          </button>
          <button
            type="button"
            onClick={saveHtml}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line font-display text-sm"
          >
            <Download className="size-4 text-brass" />
            Скачать HTML-страницу
          </button>
          <button
            type="button"
            onClick={saveJson}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line font-display text-sm"
          >
            <Download className="size-4 text-brass" />
            Скачать JSON
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line font-display text-sm"
          >
            <Upload className="size-4 text-brass" />
            Загрузить JSON
          </button>

          {status ? <p className="text-sm text-ok">{status}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
