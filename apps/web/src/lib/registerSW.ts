/** Registers the offline shell. Failure is non-fatal — the app still runs. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('service worker registration failed', error);
    });
  });
}

/**
 * Ask the browser not to evict our data. Local-first (D-002) means eviction is
 * data loss, so the answer is worth surfacing rather than assuming.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
