import fs from 'fs';
import path from 'path';

import webpush from 'web-push';

import { listPushSubscriptionsFor, listUsers, removePushSubscription } from './appState';

export interface PushPayload {
    title: string;
    body: string;
    url: string;
}

const vapidPath = path.join(process.cwd(), 'data', 'vapid.json');
const SUBJECT = 'mailto:push@mapdispenser.local';

let keys: { publicKey: string; privateKey: string } | null | undefined;

// Env wins (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY on hosted deploys);
// otherwise generate once and persist next to the other data files.
// Returns null when neither works — push is then simply disabled.
function getKeys(): { publicKey: string; privateKey: string } | null {
    if (keys !== undefined) return keys;

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    } else {
        try {
            keys = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));
        } catch {
            try {
                const generated = webpush.generateVAPIDKeys();
                fs.mkdirSync(path.dirname(vapidPath), { recursive: true });
                fs.writeFileSync(vapidPath, JSON.stringify(generated, null, 2));
                keys = generated;
            } catch {
                keys = null; // read-only host without env keys: push off, app unaffected
            }
        }
    }

    keys = keys ?? null;
    if (keys) webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
    return keys;
}

export function getPushPublicKey(): string | null {
    return getKeys()?.publicKey || null;
}

// Fire the payload at every device of every listed user. Never throws:
// notifications must not break the action that triggered them.
export async function sendPushToUsers(userIds: number[], payload: PushPayload) {
    try {
        if (!getKeys() || !userIds.length) return;
        const subscriptions = await listPushSubscriptionsFor(userIds);
        const body = JSON.stringify(payload);

        await Promise.all(subscriptions.map(async (record) => {
            try {
                await webpush.sendNotification(
                    { endpoint: record.endpoint, keys: { p256dh: record.p256dh, auth: record.auth } },
                    body,
                    { TTL: 12 * 60 * 60, timeout: 5000 }
                );
            } catch (error) {
                const status = (error as { statusCode?: number }).statusCode;
                // the device unsubscribed or the subscription expired — drop it
                if (status === 404 || status === 410) await removePushSubscription(record.endpoint).catch(() => {});
            }
        }));
    } catch (error) {
        console.error('Push send failed:', error);
    }
}

// Territory team + servant: the people who act on requests and signups.
export async function sendPushToAdmins(payload: PushPayload) {
    try {
        const admins = (await listUsers())
            .filter((user) => user.status === 'active' && user.role !== 'publisher')
            .map((user) => user.id);
        await sendPushToUsers(admins, payload);
    } catch (error) {
        console.error('Push send failed:', error);
    }
}
