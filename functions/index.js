'use strict';

// Bet Buddy league server: checks each league bet when it is logged, settles bets from official
// results, keeps every player's league stats, and builds the regional ladders.
//
//   users/{uid}/leagueBets/{day}   written by the app (create only), checked and settled here
//   leagueStats/{uid}              this server only: the player's points for week, month and season
//   leagues/{code}/members/{uid}   stats fields written only here; the app writes handle/avatar
//   ladders/{period}__{tier}       this server only: top 50 for world, Europe, UK, country, region, town
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const scoring = require('./lib/scoring');

admin.initializeApp();
const db = admin.firestore();
const { FieldValue, Timestamp, FieldPath } = admin.firestore;

// Must suit the Firestore database location: betbuddyuk's database is eur3 (Europe), so europe-west1.
const REGION = process.env.FUNCTIONS_REGION || 'europe-west1';
setGlobalOptions({ region: REGION, maxInstances: 10 });

// Fixtures, results and bookmaker prices are the same files the app reads.
const DATA_BASE = process.env.BETBUDDY_DATA_BASE || 'https://headpark23.github.io/MatchIQ/data/';
const dataCache = new Map();
async function loadData(name) {
  const hit = dataCache.get(name);
  if (hit && Date.now() - hit.at < 5 * 60000) return hit.data;
  const res = await fetch(DATA_BASE + name + '?t=' + Date.now(), { redirect: 'follow' });
  if (!res.ok) throw new Error('Could not load ' + name + ': HTTP ' + res.status);
  const data = await res.json();
  dataCache.set(name, { at: Date.now(), data });
  return data;
}
const loadFixtures = async () => (await loadData('fixtures.json')).fixtures || [];

// ---------------------------------------------------------- owner-only: signed-in user totals
// Firebase Auth accounts can't be listed from a browser, so the founder dashboard asks here.
// The caller's ID token must belong to a verified owner email; nobody else gets a count.
const OWNER_EMAILS = ['headpark@gmail.com'];
exports.ownerUserStats = onRequest({ cors: true }, async (req, res) => {
  try {
    const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
    if (!m) { res.status(401).json({ error: 'unauthenticated' }); return; }
    const tok = await admin.auth().verifyIdToken(m[1]);
    if (!tok.email_verified || !OWNER_EMAILS.includes((tok.email || '').toLowerCase())) {
      res.status(403).json({ error: 'forbidden' }); return;
    }
    let total = 0, google = 0, last7 = 0, new7 = 0, token;
    const now = Date.now(), week = 7 * 864e5;
    do {
      const page = await admin.auth().listUsers(1000, token);
      for (const u of page.users) {
        total++;
        if (u.providerData.some(p => p.providerId === 'google.com')) google++;
        const created = Date.parse(u.metadata.creationTime);
        const seen = Date.parse(u.metadata.lastSignInTime);
        if (now - created < week) new7++;
        if (now - seen < week) last7++;
      }
      token = page.pageToken;
    } while (token);
    res.json({ total, google, new7, active7: last7, at: new Date().toISOString() });
  } catch (e) {
    logger.warn('ownerUserStats failed', e);
    res.status(401).json({ error: 'invalid token' });
  }
});

// ---------------------------------------------------------- BetAI: signed-in football Q&A, 4 a day
// The Gemini key lives only here (firebase functions:secrets:set GEMINI_API_KEY). The browser sends a
// question with its ID token; the answer is built from the app's own model data, picks only.
const { defineSecret } = require('firebase-functions/params');
const betai = require('./lib/betai');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const BETAI_MODEL = process.env.BETAI_MODEL || 'gemini-2.5-flash';

async function callGemini(key, question, ctx, nowMs) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + BETAI_MODEL + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: betai.SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: betai.buildPrompt(question, ctx, nowMs) }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096, responseMimeType: 'application/json', responseSchema: betai.RESPONSE_SCHEMA }
    })
  });
  if (!res.ok) throw new Error('Gemini HTTP ' + res.status);
  const body = await res.json();
  const text = body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts &&
    body.candidates[0].content.parts.map(p => p.text || '').join('');
  if (!text) throw new Error('Gemini returned no text');
  return JSON.parse(text);
}

// One counter per user per UK day. Taken before the model call, handed back if the call fails.
async function takeBetAIQuestion(uid, day) {
  const ref = db.collection('betaiUsage').doc(uid);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const used = snap.exists && snap.data().day === day ? snap.data().count || 0 : 0;
    if (used >= betai.DAILY_LIMIT) return { ok: false, remaining: 0 };
    tx.set(ref, { day, count: used + 1, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, remaining: betai.DAILY_LIMIT - used - 1 };
  });
}
async function readBetAIRemaining(uid, day) {
  const snap = await db.collection('betaiUsage').doc(uid).get();
  const used = snap.exists && snap.data().day === day ? snap.data().count || 0 : 0;
  return Math.max(0, betai.DAILY_LIMIT - used);
}
async function giveBackBetAIQuestion(uid, day) {
  const ref = db.collection('betaiUsage').doc(uid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data().day === day && snap.data().count > 0) tx.update(ref, { count: snap.data().count - 1 });
  });
}

exports.betAI = onRequest({ cors: true, secrets: [GEMINI_API_KEY], timeoutSeconds: 60, memory: '256MiB' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'post only' }); return; }
  let uid;
  try {
    const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
    if (!m) { res.status(401).json({ error: 'sign-in-required' }); return; }
    uid = (await admin.auth().verifyIdToken(m[1])).uid;
  } catch (e) { res.status(401).json({ error: 'sign-in-required' }); return; }

  const now = Date.now();
  const day = betai.ukDay(now);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    if (body.quota) { res.json({ remaining: await readBetAIRemaining(uid, day), limit: betai.DAILY_LIMIT }); return; }
    const question = betai.cleanQuestion(body.question);
    if (question.length < 3) { res.status(400).json({ error: 'question-too-short' }); return; }
    const slot = await takeBetAIQuestion(uid, day);
    if (!slot.ok) { res.status(429).json({ error: 'daily-limit', remaining: 0, limit: betai.DAILY_LIMIT }); return; }
    try {
      const ctx = betai.buildContext(await loadData('predictions.json'), question, now);
      const out = betai.normalise(await callGemini(GEMINI_API_KEY.value(), question, ctx, now));
      res.json(Object.assign(out, { remaining: slot.remaining, limit: betai.DAILY_LIMIT }));
    } catch (e) {
      logger.warn('betAI failed', e);
      await giveBackBetAIQuestion(uid, day).catch(() => {});
      res.status(502).json({ error: 'ai-unavailable', remaining: slot.remaining + 1, limit: betai.DAILY_LIMIT });
    }
  } catch (e) {
    logger.warn('betAI quota failed', e);
    res.status(500).json({ error: 'unavailable' });
  }
});

const STAT_FIELDS = ['points','winRate', 'roi', 'settled', 'form'];

// ---------------------------------------------------------- 1. a league bet is logged
exports.checkLeagueBet = onDocumentCreated('users/{uid}/leagueBets/{day}', async event => {
  const snap = event.data;
  if (!snap) return;
  const bet = snap.data() || {};
  let result;
  try {
    const [fixtures, odds, predictions] = await Promise.all([loadFixtures(), loadData('odds.json'), loadData('predictions.json').catch(() => null)]);
    result = scoring.validateLeagueBet({
      bet,
      dayKey: event.params.day,
      createdMs: snap.createTime.toMillis(),  // server clock, not the phone's
      fixtures,
      odds,
      predictions
    });
  } catch (e) {
    logger.error('checkLeagueBet: data unavailable', e);
    result = { status: 'rejected', reason: 'Could not check the bet just now. Remove it and try again.' };
  }
  const update = Object.assign({}, result, { checkedAt: FieldValue.serverTimestamp() });
  if (result.kickoffMs) {
    update.kickoffAt = Timestamp.fromMillis(result.kickoffMs);
    delete update.kickoffMs;
  }
  await snap.ref.update(update);
});

// ---------------------------------------------------------- 2. a player joins a league
// New members start with their current stats instead of zeros.
exports.seedLeagueMember = onDocumentCreated('leagues/{code}/members/{uid}', async event => {
  const stats = await db.collection('leagueStats').doc(event.params.uid).get();
  if (!stats.exists || !event.data) return;
  await event.data.ref.update(memberStatsFields(stats.data()));
});

// ---------------------------------------------------------- 3. a profile changes
// Keeps the gamertag and location used on the ladders in step with the profile.
exports.syncLeagueProfile = onDocumentWritten('users/{uid}', async event => {
  const after = event.data && event.data.after;
  if (!after || !after.exists) return;
  const ref = db.collection('leagueStats').doc(event.params.uid);
  const existing = await ref.get();
  if (!existing.exists) return;
  await ref.set(profileFields(after.data()), { merge: true });
});

// ---------------------------------------------------------- 4. settle, score and rank
exports.settleLeagues = onSchedule({ schedule: 'every 30 minutes', timeZone: 'Europe/London', timeoutSeconds: 540, memory: '512MiB' }, async () => {
  const now = new Date();
  const fixtures = await loadFixtures();

  // Settle every pending bet whose match should be over.
  const due = await db.collectionGroup('leagueBets')
    .where('status', '==', 'pending')
    .where('kickoffAt', '<=', Timestamp.fromMillis(now.getTime() - scoring.SETTLE_AFTER_MS))
    .limit(3000)
    .get();
  const touched = new Set();
  const writer = db.bulkWriter();
  due.docs.forEach(doc => {
    const bet = doc.data();
    const res = scoring.settleLeagueBet(Object.assign({}, bet, { kickoffMs: bet.kickoffAt && bet.kickoffAt.toMillis() }), fixtures, now.getTime());
    if (!res) return;
    writer.update(doc.ref, Object.assign(res, { settledAt: FieldValue.serverTimestamp() }));
    touched.add(doc.ref.parent.parent.id);
  });
  await writer.close();

  // Recompute the stats of everyone who had a bet settled.
  for (const uid of touched) {
    try { await recomputePlayer(uid, now); } catch (e) { logger.error('recomputePlayer failed', uid, e); }
  }

  // Rebuild the ladders when results changed, or at least every 6 hours so weekly/monthly resets show.
  const metaRef = db.collection('system').doc('ladders');
  const meta = (await metaRef.get()).data() || {};
  const builtMs = meta.builtAt ? meta.builtAt.toMillis() : 0;
  if (touched.size || now.getTime() - builtMs > 6 * 3600000) {
    await rebuildLadders(now);
    await metaRef.set({ builtAt: FieldValue.serverTimestamp(), settled: due.size });
  }
  logger.info('settleLeagues', { due: due.size, players: touched.size });
});

function profileFields(user) {
  const u = user || {};
  return {
    handle: String(u.handle || 'Player').slice(0, 20),
    avatar: String(u.avatar || '⚽').slice(0, 10),
    town: String(u.town || '').slice(0, 40),
    region: String(u.region || '').slice(0, 40),
    country: String(u.country || '').slice(0, 40)
  };
}

// What a private-league member record shows: the league-period stats at the top level for older
// app versions, all three periods in `periods`, and scoredAt to mark them as server-calculated.
function memberStatsFields(stats) {
  const periods = stats.periods || {};
  const fields = { periods, scoredAt: stats.updatedAt || FieldValue.serverTimestamp() };
  STAT_FIELDS.forEach(f => { fields[f] = (periods.weekly || {})[f] != null ? periods.weekly[f] : (f === 'form' ? ['—'] : 0); });
  return fields;
}

async function recomputePlayer(uid, now) {
  const userRef = db.collection('users').doc(uid);
  const since = scoring.statsWindowStart(now);
  const [betsSnap, userSnap, membershipsSnap] = await Promise.all([
    userRef.collection('leagueBets').where(FieldPath.documentId(), '>=', since).get(),
    userRef.get(),
    userRef.collection('leagueMemberships').get()
  ]);
  const bets = betsSnap.docs.map(d => Object.assign({ day: d.id }, d.data()));
  const periods = scoring.computePeriods(bets, now);
  const stats = Object.assign(profileFields(userSnap.data()), { periods, updatedAt: Timestamp.now() });
  await db.collection('leagueStats').doc(uid).set(stats);

  // Copy into every private league the player is in.
  const writer = db.bulkWriter();
  writer.onWriteError(err => err.code !== 5 && err.failedAttempts < 3);  // 5 = NOT_FOUND: no longer a member
  membershipsSnap.docs.forEach(m => {
    writer.update(db.collection('leagues').doc(m.id).collection('members').doc(uid), memberStatsFields(stats));
  });
  await writer.close();
}

async function rebuildLadders(now) {
  const snap = await db.collection('leagueStats').get();
  const players = snap.docs.map(d => Object.assign({ uid: d.id }, d.data()));
  const ladders = scoring.buildLadders(players, now);
  const writer = db.bulkWriter();
  const keep = new Set(ladders.map(l => l.id));
  ladders.forEach(l => writer.set(db.collection('ladders').doc(l.id), Object.assign(l, { updatedAt: FieldValue.serverTimestamp() })));
  // Ladders with nobody in them this period are removed rather than left showing old tables.
  (await db.collection('ladders').select().get()).docs.forEach(d => { if (!keep.has(d.id)) writer.delete(d.ref); });
  await writer.close();
}
