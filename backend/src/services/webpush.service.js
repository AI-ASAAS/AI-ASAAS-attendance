'use strict';

const fs = require('node:fs');
const path = require('node:path');
let webpush = null;
try {
  webpush = require('web-push');
} catch (e) {
  try {
    webpush = require(path.resolve(__dirname, '../../node_modules/web-push'));
  } catch (_) {
    console.warn('[WebPush] web-push module not found, push notifications will be simulated');
  }
}

const VAPID_FILE = path.resolve(__dirname, '../../../database/vapid.json');
let vapidKeys = null;

function initVapidKeys() {
  if (vapidKeys) return vapidKeys;

  // 1. Check environment variables
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY.trim(),
      privateKey: process.env.VAPID_PRIVATE_KEY.trim()
    };
  } else {
    // 2. Check persistent JSON file
    try {
      if (fs.existsSync(VAPID_FILE)) {
        const content = fs.readFileSync(VAPID_FILE, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.publicKey && parsed.privateKey) {
          vapidKeys = parsed;
        }
      }
    } catch (e) {
      console.warn('[WebPush] Error reading vapid.json:', e.message);
    }

    // 3. Generate fresh keys if none exist and save
    if (!vapidKeys && webpush) {
      try {
        vapidKeys = webpush.generateVAPIDKeys();
        const dir = path.dirname(VAPID_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf8');
        console.log('[WebPush] Generated and persisted new VAPID keys for PWA push notifications');
      } catch (err) {
        console.error('[WebPush] Failed to generate VAPID keys:', err.message);
      }
    }
  }

  if (webpush && vapidKeys) {
    try {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@asas.ye',
        vapidKeys.publicKey,
        vapidKeys.privateKey
      );
    } catch (err) {
      console.warn('[WebPush] Failed to set VAPID details:', err.message);
    }
  }

  return vapidKeys;
}

// Initialize immediately
initVapidKeys();

function getPublicKey() {
  const keys = initVapidKeys();
  return keys ? keys.publicKey : null;
}

async function saveSubscription(db, accountId, sub, userAgent) {
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new Error('بيانات الاشتراك في الإشعارات غير مكتملة');
  }

  const endpoint = String(sub.endpoint).trim();
  const p256dh = String(sub.keys.p256dh).trim();
  const auth = String(sub.keys.auth).trim();
  const ua = userAgent ? String(userAgent).slice(0, 300) : null;
  const now = new Date().toISOString();

  // SQLite upsert
  await db.query(`
    INSERT INTO push_subscriptions(account_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
    VALUES($1, $2, $3, $4, $5, $6, $6)
    ON CONFLICT(endpoint) DO UPDATE SET
      account_id = excluded.account_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at
  `, [accountId, endpoint, p256dh, auth, ua, now]);

  return { success: true };
}

async function removeSubscription(db, endpoint) {
  if (!endpoint) return;
  await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

async function sendNotificationToSub(db, subRecord, payloadObj) {
  if (!webpush || !vapidKeys) return false;

  const pushSubscription = {
    endpoint: subRecord.endpoint,
    keys: {
      p256dh: subRecord.p256dh,
      auth: subRecord.auth
    }
  };

  const rawBody = String(payloadObj.body || 'إشعار جديد من نظام أساس').trim();
  const fullBodyRaw = String(payloadObj.fullBody || rawBody).trim();
  const fullBody = fullBodyRaw.length > 2000 ? `${fullBodyRaw.slice(0, 1997).trim()}…` : fullBodyRaw;
  const shortBody = rawBody.length > 180 ? `${rawBody.slice(0, 177).trim()}…` : rawBody;

  const payloadString = JSON.stringify({
    title: payloadObj.title || 'نظام أساس · تنبيه الدوام',
    body: shortBody,
    fullBody,
    type: payloadObj.type || 'general',
    priority: payloadObj.priority || 'normal',
    announcementId: payloadObj.announcementId || null,
    senderName: payloadObj.senderName || 'إدارة نظام أساس',
    createdAt: payloadObj.createdAt || new Date().toISOString(),
    icon: payloadObj.icon || '/icon-192.png',
    badge: payloadObj.badge || '/favicon.png',
    tag: payloadObj.tag || 'asas-alert-' + Date.now(),
    url: payloadObj.url || '/asas',
    timestamp: Date.now()
  });

  try {
    await webpush.sendNotification(pushSubscription, payloadString, {
      TTL: 86400, // 24 hours queue retention in push server (Google/Apple)
      urgency: 'high'
    });
    return true;
  } catch (err) {
    // 404 or 410 indicates the subscription has expired or user revoked permission on phone
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log(`[WebPush] Subscription expired or revoked (${err.statusCode}), pruning endpoint.`);
      await removeSubscription(db, subRecord.endpoint).catch(() => {});
    } else {
      console.warn(`[WebPush] Push notification send error (${err.statusCode || err.code}):`, err.message);
    }
    return false;
  }
}

async function sendPushToAccount(db, accountId, payload) {
  if (!accountId) return 0;
  const subs = (await db.query(
    `SELECT * FROM push_subscriptions WHERE account_id = $1`,
    [accountId]
  )).rows;

  let sent = 0;
  for (const sub of subs) {
    const ok = await sendNotificationToSub(db, sub, payload);
    if (ok) sent++;
  }
  return sent;
}

async function sendPushToMultipleAccounts(db, accountIds, payload) {
  if (!accountIds || accountIds.length === 0) return 0;
  let sent = 0;
  for (const accId of accountIds) {
    sent += await sendPushToAccount(db, accId, payload);
  }
  return sent;
}

async function sendPushToAll(db, payload, options = {}) {
  let query = `
    SELECT ps.* FROM push_subscriptions ps
    JOIN accounts a ON a.id = ps.account_id
    WHERE a.active = TRUE
  `;
  const params = [];
  if (options.role) {
    params.push(options.role);
    query += ` AND a.role = $1`;
  }
  if (options.branch_id) {
    params.push(options.branch_id);
    query += ` AND a.branch_id = $${params.length}`;
  }

  const subs = (await db.query(query, params)).rows;
  let sent = 0;
  for (const sub of subs) {
    const ok = await sendNotificationToSub(db, sub, payload);
    if (ok) sent++;
  }
  return sent;
}

module.exports = {
  getPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushToAccount,
  sendPushToMultipleAccounts,
  sendPushToAll
};
