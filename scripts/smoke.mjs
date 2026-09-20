// Explicitly opt-in: this performs one real, billable TypeSafe call via MCP stdio.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

if (!process.env.TYPESAFE_API_KEY) throw new Error('Set TYPESAFE_API_KEY to run the live smoke test.');
const input = JSON.parse(await readFile(new URL('../examples/support-ticket.json', import.meta.url), 'utf8'));
const client = new Client({ name: 'jev-live-smoke', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [process.env.JEV_SMOKE_ENTRYPOINT || fileURLToPath(new URL('../src/cli.mjs', import.meta.url))],
  env: { ...process.env }, stderr: 'pipe',
});
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.some((t) => t.name === 'jev_evaluate'));
  const result = await client.callTool({ name: 'jev_evaluate', arguments: input }, undefined, { timeout: 120_000 });
  if (result.isError) throw new Error(result.content[0].text);
  assert.equal(result.structuredContent.answers.department.choice, 'billing');
  assert.ok(result.structuredContent.answers.requests_refund.noul > 0.5);
  console.log(JSON.stringify({ tools: tools.tools.map((t) => t.name), result: result.structuredContent }, null, 2));
} finally { await client.close(); }
