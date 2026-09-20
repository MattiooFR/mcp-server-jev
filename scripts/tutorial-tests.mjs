// Opt-in live evaluations. Sends only the synthetic fixtures in examples/tutorial.
// Calls consume your TypeSafe quota; no prices or accuracy guarantees are inferred.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

if (!process.env.TYPESAFE_API_KEY) throw new Error('Set TYPESAFE_API_KEY before running live tests.');
const root = fileURLToPath(new URL('../', import.meta.url));
const cases = JSON.parse(await fs.readFile(path.join(root, 'examples/tutorial/cases.json'), 'utf8'));
const output = path.resolve(process.argv[2] || path.join(root, 'tutorial-results.json'));
const client = new Client({ name: 'jev-reproducible-tutorial', version: '1.0.0' });
const report = { started_at: new Date().toISOString(), node: process.version, data: 'synthetic',
  interpretation: 'Illustrative checks on predetermined fixtures, not an accuracy benchmark.', runs: [] };
const save = async () => {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
};
const transport = new StdioClientTransport({ command: process.execPath,
  args: [process.env.JEV_SMOKE_ENTRYPOINT || path.join(root, 'src/cli.mjs')],
  env: { ...process.env }, stderr: 'pipe' });
try {
  const start = performance.now();
  await client.connect(transport);
  report.connection_ms = Math.round(performance.now() - start);
  report.tools = (await client.listTools()).tools.map(t => t.name);
  const runs = [...cases, ...Array.from({ length: 2 }, () => cases.find(c => c.id === 'batch'))];
  for (const c of runs) {
    const started = performance.now();
    const response = await client.callTool({ name: 'jev_evaluate', arguments: c.input }, undefined, { timeout: 120_000 });
    const wall_ms = Math.round(performance.now() - started);
    if (response.isError) {
      report.runs.push({ case_id: c.id, wall_ms, error: response.content[0].text });
      await save();
      console.log(JSON.stringify({ case_id: c.id, error: true, wall_ms }));
      continue;
    }
    const result = response.structuredContent;
    const checks = Object.entries(c.expected).map(([key, expected]) => {
      const a = result.answers[key];
      const actual = a?.choice ?? a?.noul ?? a?.score;
      const pass = 'equals' in expected ? actual === expected.equals
        : typeof actual === 'number' && (expected.min === undefined || actual >= expected.min)
          && (expected.max === undefined || actual <= expected.max);
      return { key, expected, actual, pass };
    });
    report.runs.push({ case_id: c.id, repeat: report.runs.filter(r => r.case_id === c.id).length + 1,
      question_count: Object.keys(c.input.questions).length, wall_ms, result, checks });
    await save();
    console.log(JSON.stringify({ case_id: c.id, wall_ms, questions: Object.keys(c.input.questions).length,
      checks: checks.length, passed: checks.filter(c => c.pass).length, usage: result.usage }));
  }
  report.finished_at = new Date().toISOString();
  await save();
} finally { await client.close(); }
