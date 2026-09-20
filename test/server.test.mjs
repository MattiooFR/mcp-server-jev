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
  assert.deepEqual(tools.map((x) => x.name), ['jev_evaluate']);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[0].annotations.openWorldHint, true);
  assert.ok(tools[0].outputSchema);
  assert.ok(tools[0].inputSchema.required.includes('state'));
  const output = await client.callTool({ name: 'jev_evaluate', arguments: { state: 'Text', questions: { q: { type: 'noul', instructions: 'Relevant?' } } } });
  assert.deepEqual(output.structuredContent, result);
  assert.deepEqual(JSON.parse(output.content[0].text), result);
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
