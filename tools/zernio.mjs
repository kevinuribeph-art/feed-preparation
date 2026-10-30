#!/usr/bin/env node
// Zernio from this Mac: the only place that holds the API key (read from ZERNIO_API_KEY or the repo's .env,
// which is gitignored). The mesa never sees the key: Claude asks here for presigned upload URLs, the mesa PUTs the
// cropped photos to them (MESA.startZernio) and Claude creates the post here with the publicUrls.
// Node 18 or later, no dependencies. Every command prints JSON; on failure it prints {error, ...} and exits 1.
//
//   node tools/zernio.mjs accounts                 connected social accounts (id, platform, username)
//   node tools/zernio.mjs presign <n>              n upload URLs for JPEG photos (valid 1 h): [{uploadUrl, publicUrl}]
//   node tools/zernio.mjs schedule <post.json|->   creates a scheduled post (refuses past times and publishNow)
//   node tools/zernio.mjs posts [--account ID] [--status S] [--platform P] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
//   node tools/zernio.mjs post <id>
//   node tools/zernio.mjs update <id> <patch.json|->
//   node tools/zernio.mjs delete <id>              only a post not yet published

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const API = 'https://zernio.com/api/v1';
const MIN_AHEAD_MS = 10 * 60 * 1000;   // a scheduledFor in the past is published at once by Zernio: keep a margin

function loadKey() {
  if (process.env.ZERNIO_API_KEY) return process.env.ZERNIO_API_KEY.trim();
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const m = env.match(/^\s*ZERNIO_API_KEY\s*=\s*["']?([^"'\s]+)["']?\s*$/m);
    if (m) return m[1];
  } catch (e) { /* no .env */ }
  return null;
}

class Fail extends Error { constructor(msg, extra) { super(msg); this.extra = extra; } }

async function call(method, path, { body, query, headers } = {}) {
  const key = loadKey();
  if (!key) throw new Fail('falta ZERNIO_API_KEY (en el entorno o en .env, junto a este repo)');
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')) : '';
  const r = await fetch(API + path + qs, {
    method,
    headers: { authorization: 'Bearer ' + key, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000)
  });
  const text = await r.text();
  let js = null; try { js = text ? JSON.parse(text) : {}; } catch (e) { /* not json */ }
  if (!r.ok) throw new Fail(`Zernio ${r.status}: ${(js && (js.error || js.message)) || text.slice(0, 300)}`, { http: r.status, ...(js && js.details ? { details: js.details } : {}), ...(js && js.existingPostId ? { existingPostId: js.existingPostId } : {}) });
  return js;
}

function readJson(arg) {
  if (!arg) throw new Fail('falta el JSON del post (un archivo, o «-» para leerlo de la entrada)');
  const raw = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
  try { return JSON.parse(raw); } catch (e) { throw new Fail('el JSON del post no es válido: ' + e.message); }
}

// The guard that matters: nothing goes out now by accident.
function checkTiming(b, isNew) {
  if (b.publishNow) throw new Fail('publishNow no está permitido: este script solo programa');
  if (b.isDraft) return;
  const times = [b.scheduledFor, ...(b.platforms || []).map(p => p && p.scheduledFor)].filter(Boolean);
  if (isNew && !b.scheduledFor) throw new Fail('falta scheduledFor (sin él Zernio lo guarda como borrador; para eso, isDraft: true)');
  for (const t of times) {
    if (!/(Z|[+-]\d\d:\d\d)$/.test(t)) throw new Fail(`scheduledFor «${t}» tiene que llevar Z o la diferencia horaria (p. ej. 2026-11-03T17:00:00Z)`);
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) throw new Fail(`scheduledFor «${t}» no es una fecha válida`);
    if (ms < Date.now() + MIN_AHEAD_MS) throw new Fail(`scheduledFor «${t}» es pasado o falta menos de ${MIN_AHEAD_MS / 60000} min: Zernio lo publicaría ya`);
  }
  if (isNew && !(b.platforms || []).length) throw new Fail('falta platforms: [{platform, accountId}]');
}

const slim = p => p && ({
  id: p._id, status: p.status, scheduledFor: p.scheduledFor, timezone: p.timezone,
  content: p.content, media: (p.mediaItems || []).map(m => m.url),
  platforms: (p.platforms || []).map(x => ({ platform: x.platform, accountId: x.accountId && (x.accountId._id || x.accountId), status: x.status, ...(x.platformPostUrl ? { url: x.platformPostUrl } : {}), ...(x.errorMessage ? { error: x.errorMessage } : {}) })),
  ...(p.metadata && Object.keys(p.metadata).length ? { metadata: p.metadata } : {})
});

function flags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) out[args[i].slice(2)] = args[++i];
  return out;
}

const commands = {
  async accounts() {
    const { accounts = [] } = await call('GET', '/accounts');
    return accounts.map(a => ({ id: a._id || a.id, platform: a.platform, username: a.username, displayName: a.displayName, isActive: a.isActive, profileId: a.profileId && (a.profileId._id || a.profileId) }));
  },
  async presign(n) {
    const k = Number(n || 1);
    if (!Number.isInteger(k) || k < 1 || k > 20) throw new Fail('presign <n>: entre 1 y 20 (un carrusel de Instagram admite hasta 20)');
    const out = [];
    for (let i = 0; i < k; i++) {
      const r = await call('POST', '/media/presign', { body: { filename: `mesa-${Date.now()}-${i + 1}.jpg`, contentType: 'image/jpeg' } });
      out.push({ uploadUrl: r.uploadUrl, publicUrl: r.publicUrl, expiresIn: r.expiresIn });
    }
    return out;
  },
  async schedule(file) {
    const b = readJson(file);
    checkTiming(b, true);
    // same body → same key: a retry after a timeout returns the post already created instead of a second one
    const idem = createHash('sha256').update(JSON.stringify(b)).digest('hex');
    const r = await call('POST', '/posts', { body: b, headers: { 'idempotency-key': idem } });
    return slim(r.post || r);
  },
  async posts(...args) {
    const f = flags(args), all = [];
    for (let page = 1; ; page++) {
      const r = await call('GET', '/posts', { query: { page, limit: 100, accountId: f.account, status: f.status, platform: f.platform, dateFrom: f.from, dateTo: f.to } });
      all.push(...(r.posts || []));
      if (!r.pagination || page >= r.pagination.pages) break;
    }
    return all.map(slim);
  },
  async post(id) {
    if (!id) throw new Fail('post <id>');
    const r = await call('GET', '/posts/' + encodeURIComponent(id));
    return slim(r.post || r);
  },
  async update(id, file) {
    if (!id) throw new Fail('update <id> <patch.json|->');
    const b = readJson(file);
    checkTiming(b, false);
    const r = await call('PUT', '/posts/' + encodeURIComponent(id), { body: b });
    return slim(r.post || r);
  },
  async delete(id) {
    if (!id) throw new Fail('delete <id>');
    await call('DELETE', '/posts/' + encodeURIComponent(id));
    return { id, deleted: true };
  }
};

const [cmd, ...rest] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log(JSON.stringify({ error: `orden desconocida «${cmd || ''}»`, usage: Object.keys(commands) }));
  process.exit(1);
}
try {
  console.log(JSON.stringify(await commands[cmd](...rest), null, 2));
} catch (e) {
  console.log(JSON.stringify({ error: e.message, ...(e.extra || {}) }, null, 2));
  process.exit(1);
}
