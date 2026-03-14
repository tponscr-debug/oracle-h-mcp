# ORACLE-H MCP Server

> Human-on-the-Loop validation for autonomous AI agents — via Model Context Protocol

[![npm version](https://badge.fury.io/js/oracle-h-mcp.svg)](https://www.npmjs.com/package/oracle-h-mcp)
[![npm downloads](https://img.shields.io/npm/dm/oracle-h-mcp.svg)](https://www.npmjs.com/package/oracle-h-mcp)
[![smithery badge](https://smithery.ai/badge/@tponscr-debug/oracle-h-mcp)](https://smithery.ai/server/@tponscr-debug/oracle-h-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is ORACLE-H?

ORACLE-H is a safety infrastructure that acts as a mandatory checkpoint for autonomous AI agents. Before executing any **critical, destructive, or irreversible action**, the agent submits it for human approval via **Telegram**. The human decides with a single tap.

```
Agent → oracle_validate → Human gets Telegram alert → Approve/Reject → Agent proceeds
```

**Without ORACLE-H**: 4-step workflow succeeds ~81.5% of the time.
**With ORACLE-H**: Same workflow succeeds ~99.6% of the time.

<a href="https://glama.ai/mcp/servers/tponscr-debug/mcp-oracle-h">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/tponscr-debug/mcp-oracle-h/badge" alt="mcp-oracle-h MCP server" />
</a>

## MCP Tools

| Tool | Description |
|------|-------------|
| `oracle_validate` | Submit a risky action for human approval. Returns a `request_id`. |
| `oracle_poll_status` | Poll the decision until approved, rejected, or expired. |

## Quick Start (Demo — no signup required)

```bash
# Test immediately with the public demo key
ORACLE_SIGNATURE_KEY=demo-signature-key-change-in-production
ORACLE_BASE_URL=https://oracle-h.online
```

---

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

### Cline (VS Code)

```json
// File: cline_mcp_settings.json
{
  "mcpServers": {
    "oracle-h": {
      "command": "npx",
      "args": ["-y", "oracle-h-mcp"],
      "env": {
        "ORACLE_SIGNATURE_KEY": "demo-signature-key-change-in-production",
        "ORACLE_BASE_URL": "https://oracle-h.online"
      }
    }
  }
}
```

### Roo Code (VS Code)

```json
// File: .roo/mcp.json (project-level)
{
  "mcpServers": {
    "oracle-h": {
      "command": "npx",
      "args": ["-y", "oracle-h-mcp"],
      "env": {
        "ORACLE_SIGNATURE_KEY": "demo-signature-key-change-in-production",
        "ORACLE_BASE_URL": "https://oracle-h.online"
      }
    }
  }
}
```

### GitHub Copilot (VS Code)

Add to VS Code settings.json:
```json
{
  "github.copilot.chat.mcp.servers": {
    "oracle-h": {
      "command": "npx",
      "args": ["-y", "oracle-h-mcp"],
      "env": {
        "ORACLE_SIGNATURE_KEY": "demo-signature-key-change-in-production",
        "ORACLE_BASE_URL": "https://oracle-h.online"
      }
    }
  }
}
```

### n8n

Use the MCP Client Tool node in n8n, running via supergateway:
```bash
npx -y supergateway --stdio "npx -y oracle-h-mcp" --port 8811
```
Then connect n8n's MCP Client Tool to http://localhost:8811/sse

### Zed Editor

Add to `settings.json`:
```json
{
  "context_servers": {
    "oracle-h": {
      "command": {
        "path": "npx",
        "args": ["-y", "oracle-h-mcp"]
      },
      "env": {
        "ORACLE_SIGNATURE_KEY": "<your-signature-key>",
        "ORACLE_BASE_URL": "https://oracle-h.online"
      }
    }
  }
}
```

### Continue.dev

Create `.continue/mcpServers/oracle-h.yaml`:
```yaml
name: oracle-h
version: 1.0.0
schema: v1
mcpServers:
  - name: oracle-h
    command: npx
    args:
      - -y
      - oracle-h-mcp
    env:
      ORACLE_SIGNATURE_KEY: <your-signature-key>
      ORACLE_BASE_URL: https://oracle-h.online
```

### LangGraph (Python)

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

async with MultiServerMCPClient({
    "oracle-h": {
        "command": "npx",
        "args": ["-y", "oracle-h-mcp"],
        "env": {
            "ORACLE_SIGNATURE_KEY": "your-key",
            "ORACLE_BASE_URL": "https://oracle-h.online"
        },
        "transport": "stdio"
    }
}) as client:
    tools = client.get_tools()
```

---

## How it works

1. **Agent calls `oracle_validate`** with action, rationale, projected impact, and TTL
2. **Human receives a Telegram notification** with full context and risk analysis
3. **Human taps Approve or Reject** directly in Telegram
4. **Agent polls `oracle_poll_status`** until decision arrives
5. **Agent proceeds or aborts** based on the human decision

The system includes:
- 🛡️ **Anti-hallucination Watchdog** — detects context truncation before submitting
- 📊 **Reliability Calculator** — shows the statistical improvement (81.5% → 99.6%)
- ⏳ **TTL / Expiry** — requests auto-expire if no human response within the configured timeout
- 🔐 **Bearer Token Auth** — each agent has a unique signature key
- 🔒 **HMAC-SHA256 signed webhooks** — tamper-proof decisions

---

## System Prompt Snippet

Add this to your agent's system prompt to ensure ORACLE-H is always used correctly:

```
## Human Approval Gate — ORACLE-H (MANDATORY)

Call oracle_validate BEFORE executing any action in these categories:

DESTRUCTIVE: Deleting files, dropping databases, removing users, git force-push
EXTERNAL WRITES: Sending emails, posting to APIs, submitting forms
FINANCIAL: Payments, billing changes, subscription modifications
INFRASTRUCTURE: Deployments, server config, DNS, environment variables

POLLING PROTOCOL:
After oracle_validate, poll oracle_poll_status every 10-15 seconds until:
- "approved" → proceed
- "rejected" → STOP, inform user, propose alternatives
- "expired"  → STOP, ask user if they want to retry

HARD RULES:
- NEVER execute before "approved"
- If oracle_validate is unreachable: BLOCK the action, inform user
- Read-only operations do NOT require oracle_validate
```

---

## API

Full API documentation: [oracle-h.online/llms.txt](https://oracle-h.online/llms.txt)
OpenAPI spec: [oracle-h.online/openapi.json](https://oracle-h.online/openapi.json)

## License

MIT