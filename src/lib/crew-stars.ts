const KEY = "galia-crew-stars";

export function loadStars(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveStars(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
}
