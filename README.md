# ORACLE-H MCP Server

> Human-on-the-Loop validation for autonomous AI agents — via Model Context Protocol

[![smithery badge](https://smithery.ai/badge/@tponscr-debug/oracle-h-mcp)](https://smithery.ai/server/@tponscr-debug/oracle-h-mcp)

## What is ORACLE-H?

ORACLE-H is a safety infrastructure that acts as a mandatory checkpoint for autonomous AI agents. Before executing any **critical, destructive, or irreversible action**, the agent submits it for human approval via **Telegram**. The human decides with a single tap.

```
Agent → oracle_validate → Human gets Telegram alert → Approve/Reject → Agent proceeds
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `oracle_validate` | Submit a risky action for human approval. Returns a `request_id`. |
| `oracle_poll_status` | Poll the decision status until approved, rejected, or expired. |

## Installation

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oracle-h": {
      "command": "npx",
      "args": ["-y", "oracle-h-mcp"],
      "env": {
        "ORACLE_SIGNATURE_KEY": "<your-signature-key>",
        "ORACLE_BASE_URL": "https://oracle-h.online"
      }
    }
  }
}
```

### Cursor / Windsurf

Add to your MCP settings:
```json
{
  "oracle-h": {
    "command": "npx",
    "args": ["-y", "oracle-h-mcp"],
    "env": {
      "ORACLE_SIGNATURE_KEY": "<your-signature-key>",
      "ORACLE_BASE_URL": "https://oracle-h.online"
    }
  }
}
```

## Demo

Use the public demo key to test immediately (no registration required):

```
ORACLE_SIGNATURE_KEY=demo-signature-key-change-in-production
ORACLE_BASE_URL=https://oracle-h.online
```

## How it works

1. **Agent calls `oracle_validate`** with action, rationale, projected impact, and TTL
2. **Human receives a Telegram notification** with full context and risk analysis
3. **Human taps Approve or Reject** directly in Telegram
4. **Agent polls `oracle_poll_status`** until decision arrives
5. **Agent proceeds or aborts** based on the human decision

The system includes:
- 🛡️ **Anti-hallucination Watchdog** — detects context truncation before submitting
- 📊 **Reliability Calculator** — shows the statistical improvement (81.5% → 99.6%) from adding a human checkpoint
- ⏳ **TTL / Expiry** — requests auto-expire if no human response within the configured timeout
- 🔐 **Bearer Token Auth** — each agent has a unique signature key

## API

Full API documentation: [oracle-h.online/llms.txt](https://oracle-h.online/llms.txt)  
OpenAPI spec: [oracle-h.online/openapi.json](https://oracle-h.online/openapi.json)

## License

MIT
