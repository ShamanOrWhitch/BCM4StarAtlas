export {};

declare global {
  interface Window {
    GALIA_ASSET?: string;
    GALIA_WP?: { ajax: string; nonce: string };
    GALIA_PLAY_STATE?: unknown;
  }
}
