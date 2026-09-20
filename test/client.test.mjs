import test from 'node:test';
import assert from 'node:assert/strict';
import { createJevClient, API_URL, MAX_REQUEST_BYTES } from '../src/client.mjs';

const input = { state: 'The export fails.', questions: { urgent: { type: 'noul', instructions: 'Is it urgent?' } } };
const valid = { model: 'jev-1.13.0', answers: { urgent: { type: 'noul', noul: 0.8 } }, usage: { input_tokens: 20, output_tokens: 8 } };
const json = (data = valid) => Response.json(data);
const setup = (fetchImpl, extra = {}) => createJevClient({ apiKey: 'test-key', fetchImpl, ...extra });

test('forwards structured state and returns provider usage without credentials', async () => {
  const evaluate = setup(async (url, options) => {
    assert.equal(url, API_URL);
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { model: 'jev-1.13.0', ...input });
    return json();
  });
  const result = await evaluate(input);
  assert.equal(result.answers.urgent.noul, 0.8);
  assert.equal(result.usage.input_tokens, 20);
  assert.equal(result.attempts, 1);
  assert.ok(!JSON.stringify(result).includes('test-key'));
});

test('supports all three native question types and structured rubrics', async () => {
  const questions = {
    urgent: { type: 'noul', instructions: { question: 'Urgent?' }, criteria: { true: 'Blocking' } },
    route: { type: 'choice', instructions: 'Route?', criteria: { bug: null, sales: { description: 'Sales' } } },
    severity: { type: 'score', instructions: 'Severity?', criteria: ['Cosmetic', { description: 'Blocking' }] },
  };
  const result = await setup(async () => json({ ...valid, answers: {
    urgent: { type: 'noul', noul: 1 },
    route: { type: 'choice', choice: 'bug', probabilities: { bug: 1, sales: 0 }, confidence: 1 },
    severity: { type: 'score', score: 0.7, probabilities: { 0: 0.3, 1: 0.7 }, confidence: 0.4, legend: { 0: 'Cosmetic', 1: 'Blocking' } },
  } }))({ state: ['Export fails'], questions });
  assert.equal(result.answers.route.choice, 'bug');
  assert.equal(result.answers.severity.score, 0.7);
});

for (const [label, args] of [
  ['empty questions', { ...input, questions: {} }],
  ['missing state', { questions: input.questions }],
  ['null state', { ...input, state: null }],
  ['extra endpoint', { ...input, endpoint: 'https://example.com' }],
  ['one-level score', { ...input, questions: { q: { type: 'score', instructions: 'Rate', criteria: ['one'] } } }],
  ['256 choices', { ...input, questions: { q: { type: 'choice', instructions: 'Pick', criteria: Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`o${i}`, 'Option'])) } } }],
  ['101 questions', { ...input, questions: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`q${i}`, input.questions.urgent])) }],
]) {
  test(`rejects ${label} before spending quota`, async () => {
    let called = false;
    await assert.rejects(setup(async () => { called = true; return json(); })(args), { code: 'INVALID_INPUT' });
    assert.equal(called, false);
  });
}

test('missing key and oversized input fail before network', async () => {
  const fetchImpl = () => { throw new Error('must not call'); };
  await assert.rejects(setup(fetchImpl, { apiKey: '' })(input), { code: 'MISSING_API_KEY' });
  await assert.rejects(setup(fetchImpl)({ ...input, state: 'a'.repeat(MAX_REQUEST_BYTES) }), { code: 'INPUT_TOO_LARGE' });
});

test('retries rate limits, respects cooldown and counts attempts', async () => {
  let calls = 0;
  const sleeps = [];
  const result = await setup(async () => ++calls < 3 ? new Response('busy', { status: 429, headers: { 'retry-after': '1' } }) : json(), {
    sleepImpl: async (ms) => { sleeps.push(ms); },
  })(input);
  assert.equal(result.attempts, 3);
  assert.deepEqual(sleeps, [1000, 1000]);
});

test('long Retry-After returns without retrying early', async () => {
  let calls = 0;
  await assert.rejects(setup(async () => { calls++; return new Response('busy', { status: 429, headers: { 'retry-after': '120' } }); })(input), { code: 'RATE_LIMITED' });
  assert.equal(calls, 1);
});

test('authentication errors never retry or echo provider body', async () => {
  let calls = 0;
  await assert.rejects(setup(async () => { calls++; return new Response('secret-test-key and private document', { status: 401 }); })(input), (e) => e.code === 'HTTP_401' && !e.message.includes('secret') && !e.message.includes('private'));
  assert.equal(calls, 1);
});

test('network errors are sanitized and are not automatically replayed', async () => {
  let calls = 0;
  await assert.rejects(setup(async () => { calls++; throw new Error('test-key'); })(input), (e) => e.code === 'NETWORK_ERROR' && !e.message.includes('test-key'));
  assert.equal(calls, 1);
});

test('cancelled requests do not call the provider', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(setup(() => { throw new Error('must not call'); })(input, { signal: controller.signal }), { code: 'CANCELLED' });
});

for (const [label, patch] of [
  ['missing answers', { answers: {} }],
  ['wrong question ID', { answers: { other: { type: 'noul', noul: 0.5 } } }],
  ['out-of-range probability', { answers: { urgent: { type: 'noul', noul: 2 } } }],
  ['wrong answer type', { answers: { urgent: { type: 'choice', choice: 'x', probabilities: { x: 1 }, confidence: 1 } } }],
]) {
  test(`fails closed on ${label}`, async () => {
    await assert.rejects(setup(async () => json({ ...valid, ...patch }))(input), { code: 'INVALID_RESPONSE' });
  });
}

test('rejects a choice outside its rubric and an incomplete distribution', async () => {
  const request = { ...input, questions: { urgent: { type: 'choice', instructions: 'Route', criteria: { yes: 'Yes', no: 'No' } } } };
  for (const a of [
    { type: 'choice', choice: 'invented', probabilities: { yes: 1, no: 0 }, confidence: 1 },
    { type: 'choice', choice: 'yes', probabilities: { yes: 1 }, confidence: 1 },
    { type: 'choice', choice: 'yes', probabilities: { yes: 0.1, no: 0.1 }, confidence: 1 },
  ]) await assert.rejects(setup(async () => json({ ...valid, answers: { urgent: a } }))(request), { code: 'INVALID_RESPONSE' });
});

test('bounds concurrent requests through response consumption', async () => {
  let inFlight = 0; let max = 0;
  const evaluate = setup(async () => {
    inFlight++; max = Math.max(max, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--; return json();
  });
  await Promise.all(Array.from({ length: 10 }, () => evaluate(input)));
  assert.equal(max, 3);
});
