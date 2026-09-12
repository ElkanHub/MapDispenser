// Client helpers for the install flow. localStorage may throw in private mode.
export const INSTALL_DONE_KEY = 'md-install-done';

export function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as { standalone?: boolean }).standalone === true;
}

export function installFlowDone(): boolean {
    if (isStandalone()) return true;
    try { return localStorage.getItem(INSTALL_DONE_KEY) === '1'; } catch { return true; }
}

export function markInstallFlowDone() {
    try { localStorage.setItem(INSTALL_DONE_KEY, '1'); } catch { /* private mode */ }
}
