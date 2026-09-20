# Eight live Jev scenarios

Recorded on **2026-09-20**, using `mcp-server-jev` 0.1.0 and `jev-1.13.0`. All inputs are synthetic. No customer records or private website content are included.

The [French tutorial on La Minute IA](https://la-minute-ia.fr/articles/jev-codex-claude-mcp-tests-installation) includes 12 screenshots, the installation steps, and the failed cases.

## What was measured

| Scenario | Questions | MCP round trip | Predetermined checks met |
| --- | ---: | ---: | ---: |
| Support routing, refund request, urgency | 12 | 967 ms | 10/10 |
| Search intent | 6 | 695 ms | 6/6 |
| Lead qualification | 12 | 316 ms | 11/12 |
| Editorial date and placeholder checks | 6 | 337 ms | 4/6 |
| Duplicate records | 4 | 358 ms | 3/4 |
| Adversarial instructions inside tickets | 4 | 338 ms | 4/4 |
| Vague versus concrete urgency rubric | 4 | 333 ms | 2/2 |
| Batch of 20 tickets | 60 | 521 ms | 40/40 |

The batch repeats the same four support tickets five times. Three batch runs took **521, 442, and 491 ms**, a median of **491 ms**. This is a throughput illustration, not an accuracy test on 20 independent cases. Client connection/startup is recorded separately. The timings exclude the calling agent's reasoning and final response.

The eight scenarios plus two batch repeats make 10 API calls and 228 questions. Declared API usage: 26,068 input tokens and 6,767 output tokens. Client integration calls are separate. No monetary estimate is inferred.

## Failures are part of the evidence

- A lead saying “this month” scored 0.78 on the 30-day deadline question, below the preselected 0.80 threshold.
- Two documents with no missing widget scored 0.28 and 0.25 on the placeholder question, above the preselected maximum of 0.20.
- Two records with only the same name and city were classified as the same entity. The distribution was 0.56 for same and 0.44 for review; confidence was 0.34. No records were merged.

These checks are illustrative, not a representative benchmark or a calibrated production threshold. Success on four adversarial inputs does not establish prompt-injection immunity. Provider responses can change even with a pinned model; the agent's wording also affects results.

## Files and reproduction

- [Fixtures and preselected expectations](../../examples/tutorial/cases.json)
- [All original results](results.json)
- [Real tool inputs and outputs from Codex and Claude Code](client-results.json)
- [French installation guide](../installation-fr.md)

With Node 22+ and dependencies installed:

```sh
node --env-file=/absolute/path/credentials.env scripts/tutorial-tests.mjs /absolute/path/new-results.json
```

This consumes TypeSafe quota. Omitting the output path writes an ignored `tutorial-results.json` file; it does not overwrite the published reference run. The 24 offline `npm test` checks exercise the adapter, not model accuracy.

The integration tests installed the public v0.1.0 tarball into a new temporary folder, verified SHA256 `9066a3c1461fdaf69e5eeb6c281eb99baaac547de9a7448c0deac344c9ccf136`, and used that installed entrypoint in each client. Each captured client session made one real `jev_evaluate` call. Only the tool inputs and outputs are published; local paths, session identifiers, and other client metadata are excluded. These live tests ran on macOS. Desktop configuration and Windows examples are documented, but a live Claude Desktop or Windows conversation is not claimed.

## Screenshots

The [HTML evidence pages](screens/overview.html) are a reading view created for the tutorial from the recorded JSON. They are **not the native UI of TypeSafe, Codex, or Claude**. They retain the failed checks and uncertainty. The explanatory annotations are specific to the archived 2026-09-20 run.

To regenerate these dated views locally:

```sh
node scripts/render-tutorial.mjs
python3 -m http.server 4317 --bind 127.0.0.1 --directory docs/tutorial/screens
```

Open `http://127.0.0.1:4317/overview.html`. These files are static and contain no API key or live call control.
