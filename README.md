# Jev MCP Server

Give Codex, Claude, and other MCP clients a tool for typed decisions with [TypeSafe Jev](https://docs.typesafe.ai/introduction).

Classify documents. Triage tickets. Score relevance. Review content against a rubric. Ask several independent questions in one call and get structured answers instead of generated prose.

**Independent, community-maintained project. Not affiliated with TypeSafe.** No database, application backend, or project-specific integration is required.

**En français : [installation pas à pas dans Codex et Claude](docs/installation-fr.md).** Includes a prompt you can give your agent, private API-key setup, client configuration, and troubleshooting.

**[Eight reproducible live scenarios](docs/tutorial/README.md)** cover support, search intent, lead qualification, editorial checks, duplicates, adversarial messages, rubric design, and batching. The published evidence includes failures, raw results, and real Codex/Claude Code tool calls.

Read the illustrated French walkthrough: **[Jev dans Codex et Claude : 8 tests et un MCP à installer](https://la-minute-ia.fr/articles/jev-codex-claude-mcp-tests-installation)**.

## What it exposes

One tool: **`jev_evaluate`**.

| Question type | Use it for | Result |
| --- | --- | --- |
| `noul` | A yes/no judgment | Probability of yes, from 0 to 1 |
| `choice` | Selecting one of your named options | Choice, probability distribution, confidence |
| `score` | Rating against ordered descriptive levels | Fractional score, probability distribution, confidence |

Each response also includes the actual model, token usage, total latency, and attempt count. Questions may be mixed in one call. The server uses the [native TypeSafe API shapes](https://docs.typesafe.ai/api), including structured instructions and criteria.

Jev evaluates the content you supply. It does not fetch URLs, search the web, write explanations, or perform actions. Confidence describes the model's distribution; it does not prove factual accuracy. Keep consequential decisions with the calling agent or a human reviewer.

## Install from source

Requires **Node.js 22+** and a [TypeSafe API key](https://console.typesafe.ai/).

```sh
git clone https://github.com/MattiooFR/mcp-server-jev.git
cd mcp-server-jev
npm ci --ignore-scripts
```

Create a private environment file **outside the repository**, for example `~/.config/jev/credentials.env`:

```dotenv
TYPESAFE_API_KEY=your-typesafe-api-key
```

On macOS/Linux, restrict its permissions with `chmod 600 ~/.config/jev/credentials.env`. Do not commit this file. Use absolute paths in client configuration: most MCP clients do not expand `~` in arguments.

The server starts over **stdio**. No HTTP port or background daemon is needed; each MCP client launches its own process.

### Codex

```sh
codex mcp add jev -- node \
  --env-file=/absolute/path/to/credentials.env \
  /absolute/path/to/mcp-server-jev/src/cli.mjs
```

This adds a user-level server, available across projects. Start a new Codex session after registration.

### Claude Code

```sh
claude mcp add --scope user --transport stdio jev -- node \
  --env-file=/absolute/path/to/credentials.env \
  /absolute/path/to/mcp-server-jev/src/cli.mjs
```

Start a new session, then check `/mcp`.

### Claude Desktop and other MCP clients

Add this entry to the client's MCP configuration, preserving its existing servers:

```json
{
  "mcpServers": {
    "jev": {
      "command": "node",
      "args": [
        "--env-file=/absolute/path/to/credentials.env",
        "/absolute/path/to/mcp-server-jev/src/cli.mjs"
      ]
    }
  }
}
```

If a desktop client cannot find Node, set `command` to its absolute path. Restart that client to load the server. Local stdio configuration does not expose the server to hosted web clients such as claude.ai.

## Example

Ask your agent:

> Use Jev to route this support ticket, detect whether it requests a refund, and score its urgency.

The tool takes a `state` and a map of `questions`:

```json
{
  "state": "I was charged twice for one order. Please refund the duplicate.",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which department should handle this ticket?",
      "criteria": {
        "billing": "Payments, invoices, refunds",
        "technical": "Bugs and broken features",
        "other": "Neither category fits"
      }
    },
    "refund": {
      "type": "noul",
      "instructions": "Does the ticket explicitly request a refund?"
    },
    "urgency": {
      "type": "score",
      "instructions": "How time-sensitive is this ticket?",
      "criteria": [
        "Routine request without a deadline",
        "Time-sensitive issue with a workaround",
        "Immediate deadline or blocked critical activity"
      ]
    }
  }
}
```

A three-level score ranges from **0 to 2**, not 0 to 3. It may fall between levels. Define concrete descriptions rather than labels such as “low / medium / high”.

For a batch, put items with stable IDs in `state` and ask questions that explicitly reference each item. **Question IDs are output keys only; Jev does not see them.** For example, use instructions like `Does item A17 contain a deadline?`, not just a question named `A17_deadline`.

Do not expect one question to use another question's answer. Questions run independently against the same state. Send a second call when a decision depends on a previous result.

See [examples/support-ticket.json](examples/support-ticket.json) and [examples/content-review.json](examples/content-review.json).

## Configuration and limits

| Setting | Default |
| --- | --- |
| `TYPESAFE_API_KEY` | Required; read from the server environment |
| `JEV_MODEL` | `jev-1.13.0` |

The model is pinned for reproducibility. Set `JEV_MODEL=jev-latest` to follow the provider alias, or specify another `jev-x.y.z` version. Recheck your thresholds when changing models.

Local limits: 1–100 questions per call, 1–255 choices, 2–10 score levels, and a 256 KiB serialized request. The byte limit is not a token estimate: the provider can still reject a request over its context limit. Split large batches instead of truncating content silently.

The server allows three concurrent calls per process. It retries HTTP 429/5xx responses up to three attempts, honors short `Retry-After` values, and returns longer cooldowns to the caller. Network errors and timeouts are not automatically replayed because the provider may already have processed the request. Each attempt has a 30-second timeout. Configure the MCP client timeout to at least 120 seconds for retries. Separate client processes share your upstream account quota.

Malformed, incomplete, or mismatched responses return a tool error instead of a usable decision. No fallback model is substituted.

## Privacy and cost

- Calls send the supplied state and questions to **`https://api.typesafe.ai/v1/systemone`** using your API key. TypeSafe's terms, retention policy, and pricing apply.
- This server does not log or persist input content, answers, or API keys. Your MCP client may retain tool arguments and results in its own history.
- The endpoint is fixed; callers cannot redirect credentials to another host. HTTP redirects are rejected.
- Tool results include token usage, not an estimated dollar cost. Calls and retries may consume provider quota.
- Treat evaluated documents as untrusted data. Scores do not authorize file deletion, publication, payment, or any other action.

## Development

```sh
npm ci --ignore-scripts
npm test
```

Tests run offline with mocked provider responses and real MCP client/server protocol exchanges. CI runs on Node 22 and 24.

An **optional live test** makes one API evaluation using a synthetic support ticket:

```sh
node --env-file=/absolute/path/to/credentials.env scripts/smoke.mjs
```

## Distribution

The project provides a standard npm executable, `mcp-server-jev`, with a restricted package file list. It is not yet published to npm. To build and install a distributable tarball:

```sh
npm pack
npm install -g ./mcp-server-jev-0.1.0.tgz
```

After installation, MCP clients can run `mcp-server-jev` when `TYPESAFE_API_KEY` is supplied in their server environment. The source installation above works without a registry release.

## Contributing

Bug reports and focused pull requests are welcome. Include a minimal synthetic example and run `npm test`. Never include API keys, private documents, or customer data in issues or fixtures. Live API tests must remain opt-in.

## License

[MIT](LICENSE).
