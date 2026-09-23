import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.mjs';
import { JevError } from '../src/client.mjs';

async function connected(t, evaluate) {
  const server = createServer({ evaluate });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

test('MCP handshake, discovery, schema, structured output and annotations', async (t) => {
  const result = { model: 'jev-1.13.0', answers: { q: { type: 'noul', noul: 0.7 } }, usage: { input_tokens: 30, output_tokens: 10 }, latency_ms: 2, attempts: 1 };
  const client = await connected(t, async () => result);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((x) => x.name), ['jev_evaluate', 'jev_classify']);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[0].annotations.openWorldHint, true);
  assert.ok(tools[0].outputSchema);
  assert.ok(tools[0].inputSchema.required.includes('state'));
  assert.match(tools[0].description, /Delegate a narrow semantic judgment/);
  assert.match(tools[1].description, /one logical TypeSafe evaluation/);
  const output = await client.callTool({ name: 'jev_evaluate', arguments: { state: 'Text', questions: { q: { type: 'noul', instructions: 'Relevant?' } } } });
  assert.deepEqual(output.structuredContent, result);
  assert.deepEqual(JSON.parse(output.content[0].text), result);
});

test('jev_classify sends one batch, keeps item IDs out of provider questions and flags ambiguity', async (t) => {
  const calls = [];
  const client = await connected(t, async (input) => {
    calls.push(input);
    return {
      model: 'jev-1.13.0',
      answers: {
        i0: { type: 'choice', choice: 'c0', probabilities: { c0: 0.91, c1: 0.05, c2: 0.04 }, confidence: 0.9 },
        i1: { type: 'choice', choice: 'c1', probabilities: { c0: 0.41, c1: 0.44, c2: 0.15 }, confidence: 0.44 },
      },
      usage: { input_tokens: 40, output_tokens: 20 }, latency_ms: 8, attempts: 1,
    };
  });
  const output = await client.callTool({ name: 'jev_classify', arguments: {
    purpose: 'Route a support request',
    items: [{ id: 'ticket-17', content: 'Refund my double charge.' }, { id: 'ticket-18', content: 'Maybe a bug with my bill.' }],
    classes: [{ id: 'billing', description: 'Payments and refunds' }, { id: 'technical', description: 'Software bugs' }],
    none: { id: 'review', description: 'No class fits or evidence is insufficient' },
  } });
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].questions), ['i0', 'i1']);
  assert.deepEqual(calls[0].questions.i0.criteria, { c0: null, c1: null, c2: null });
  assert.deepEqual(output.structuredContent.results.map((x) => x.classId), ['billing', 'technical']);
  assert.deepEqual(output.structuredContent.reviewIds, ['ticket-18']);
  assert.equal(output.structuredContent.upstreamCalls, 1);
});

test('jev_classify rejects duplicate class IDs before calling provider', async (t) => {
  let calls = 0;
  const client = await connected(t, async () => { calls++; return {}; });
  const output = await client.callTool({ name: 'jev_classify', arguments: {
    purpose: 'Route', items: [{ id: 'a', content: 'Request' }],
    classes: [{ id: 'billing', description: 'Billing' }, { id: 'technical', description: 'Technical' }],
    none: { id: 'billing', description: 'No match' },
  } });
  assert.equal(output.isError, true);
  assert.equal(calls, 0);
});

test('MCP error response is actionable and does not leak unexpected errors', async (t) => {
  const client = await connected(t, async () => { throw new Error('private-content and test-key'); });
  const output = await client.callTool({ name: 'jev_evaluate', arguments: { state: 'Text', questions: { q: { type: 'noul', instructions: 'Relevant?' } } } });
  assert.equal(output.isError, true);
  assert.ok(!JSON.stringify(output).includes('private-content'));
});

test('MCP missing credential response gives setup guidance', async (t) => {
  const client = await connected(t, async () => { throw new JevError('MISSING_API_KEY', 'Set TYPESAFE_API_KEY.'); });
  const output = await client.callTool({ name: 'jev_evaluate', arguments: { state: 'Text', questions: { q: { type: 'noul', instructions: 'Relevant?' } } } });
  assert.equal(output.isError, true);
  assert.match(output.content[0].text, /TYPESAFE_API_KEY/);
});
