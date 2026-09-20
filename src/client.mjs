import { setTimeout as sleep } from 'node:timers/promises';
import { inputSchema, outputSchema, validateAnswerSet } from './schema.mjs';

export const DEFAULT_MODEL = 'jev-1.13.0';
export const API_URL = 'https://api.typesafe.ai/v1/systemone';
export const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;

export class JevError extends Error {
  constructor(code, message) { super(message); this.name = 'JevError'; this.code = code; }
}

async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new JevError('INVALID_RESPONSE', 'TypeSafe returned an empty response.');
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new JevError('INVALID_RESPONSE', 'TypeSafe response exceeded 1 MiB.');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) {
    await reader.cancel().catch(() => {});
    if (e instanceof JevError) throw e;
    throw new JevError('INVALID_RESPONSE', 'TypeSafe response could not be read as JSON.');
  } finally { reader.releaseLock(); }
}

// One client per MCP process. Hold the slot through body consumption and retries.
export function createJevClient({
  apiKey = process.env.TYPESAFE_API_KEY,
  model = process.env.JEV_MODEL || DEFAULT_MODEL,
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep,
  timeoutMs = 30_000,
} = {}) {
  let active = 0;
  const waiters = [];
  async function acquire() {
    if (active < 3) { active++; return; }
    await new Promise((resolve) => waiters.push(resolve));
  }
  function release() {
    const next = waiters.shift();
    if (next) next(); else active--;
  }

  return async function evaluate(raw, { signal } = {}) {
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) throw new JevError('INVALID_INPUT', 'Invalid state or questions. Check the tool schema (1–100 questions, choice ≤255 options, score 2–10 levels).');
    if (!apiKey?.trim()) throw new JevError('MISSING_API_KEY', 'Set TYPESAFE_API_KEY in the MCP server environment.');
    if (!/^jev-(?:latest|\d+\.\d+\.\d+)$/.test(model)) throw new JevError('INVALID_MODEL', 'JEV_MODEL must be jev-latest or a pinned version such as jev-1.13.0.');
    const body = JSON.stringify({ model, ...parsed.data });
    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) throw new JevError('INPUT_TOO_LARGE', 'Request exceeds 256 KiB. Split the state/questions into smaller calls. This byte limit does not guarantee the provider token limit.');
    const started = Date.now();
    await acquire();
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (signal?.aborted) throw new JevError('CANCELLED', 'Evaluation cancelled.');
        const timeout = AbortSignal.timeout(timeoutMs);
        const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
        let response;
        try {
          response = await fetchImpl(API_URL, {
            method: 'POST', redirect: 'error', signal: requestSignal,
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body,
          });
        } catch {
          // Never echo provider messages, request content, URLs or credentials.
          if (signal?.aborted) throw new JevError('CANCELLED', 'Evaluation cancelled.');
          if (timeout.aborted) throw new JevError('TIMEOUT', 'TypeSafe timed out. The request may have been processed; no automatic retry was made.');
          throw new JevError('NETWORK_ERROR', 'Unable to reach TypeSafe. No automatic retry was made.');
        }
        if (!response.ok) {
          await response.body?.cancel();
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < 3) {
            const rawRetry = response.headers.get('retry-after');
            const seconds = rawRetry === null ? NaN : Number(rawRetry);
            const delay = Number.isFinite(seconds) ? seconds * 1000 : rawRetry ? Date.parse(rawRetry) - Date.now() : 500 * attempt;
            // Respect a long Retry-After by returning to the caller, not retrying early.
            if (delay > 5000) throw new JevError('RATE_LIMITED', 'TypeSafe requests a longer cooldown. Retry later.');
            try { await sleepImpl(Math.max(100, delay || 500 * attempt), undefined, { signal }); }
            catch { throw new JevError('CANCELLED', 'Evaluation cancelled.'); }
            continue;
          }
          const hint = response.status === 401 || response.status === 403 ? ' Check TYPESAFE_API_KEY.' : response.status === 429 ? ' Retry later.' : '';
          throw new JevError(`HTTP_${response.status}`, `TypeSafe returned HTTP ${response.status}.${hint}`);
        }
        let json;
        try { json = await readJson(response); }
        catch (e) {
          if (signal?.aborted) throw new JevError('CANCELLED', 'Evaluation cancelled.');
          if (timeout.aborted) throw new JevError('TIMEOUT', 'TypeSafe response timed out. No automatic retry was made.');
          throw e;
        }
        try {
          const output = outputSchema.parse({ ...json, latency_ms: Date.now() - started, attempts: attempt });
          return validateAnswerSet(output, parsed.data.questions);
        } catch { throw new JevError('INVALID_RESPONSE', 'TypeSafe returned missing, invalid or mismatched typed answers. No decision was accepted.'); }
      }
    } finally { release(); }
  };
}
