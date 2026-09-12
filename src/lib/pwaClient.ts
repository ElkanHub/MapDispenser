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

// ---------------- push notifications ----------------

export function pushSupported(): boolean {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

// Show the nudge only when asking could still succeed.
export function pushNeedsAsking(): boolean {
    return pushSupported() && Notification.permission === 'default';
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    // explicit ArrayBuffer keeps TypeScript's BufferSource check happy
    const output = new Uint8Array(new ArrayBuffer(raw.length));
    for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
    return output;
}

// Ask permission (must be called from a tap) and register this device.
// Returns 'enabled', 'denied', or 'unavailable'; never throws.
export async function enablePush(): Promise<'enabled' | 'denied' | 'unavailable'> {
    try {
        if (!pushSupported()) return 'unavailable';

        const keyRes = await fetch('/api/app/push');
        const keyBody = await keyRes.json();
        if (!keyBody.publicKey) return 'unavailable';

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return 'denied';

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyBody.publicKey),
        });

        const saveRes = await fetch('/api/app/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        return saveRes.ok ? 'enabled' : 'unavailable';
    } catch {
        return 'unavailable';
    }
}
