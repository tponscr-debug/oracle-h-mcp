#!/usr/bin/env node
/**
 * ORACLE-H MCP Server
 * Exposes 2 tools to any MCP-compatible AI agent (Claude Desktop, Cursor, Windsurf...):
 *   - oracle_validate    : Submit a risky action for human approval via Telegram
 *   - oracle_poll_status : Check if the human has responded (polling)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.ORACLE_BASE_URL ?? "https://oracle-h.online";
const SIGNATURE_KEY = process.env.ORACLE_SIGNATURE_KEY ?? "demo-signature-key-change-in-production";

const server = new McpServer({
    name: "oracle-h",
    version: "1.0.0",
});

// ─────────────────────────────────────────────
// Tool 1: Submit an action for human validation
// ─────────────────────────────────────────────
server.tool(
    "oracle_validate",
    `Submit a critical or irreversible action to ORACLE-H for human approval.
The human operator will receive a Telegram notification with full context and can approve or reject.
ALWAYS use this tool before executing any destructive, financial, or irreversible operation.
Returns a request_id to use with oracle_poll_status to retrieve the decision.`,
    {
        action: z.string().min(15).describe("Precise technical description of the action you are about to execute"),
        rationale: z.string().min(15).describe("Why this action is necessary and why it is the optimal path"),
        projected_impact: z.string().min(15).describe("Risk and impact if this action fails or is wrong. Must describe potential damage."),
        financial_amount: z.number().min(0).default(0).describe("Financial amount at stake in USD (0 if none)"),
        expires_in_seconds: z.number().min(30).default(300).describe("How long to wait for the human response before timing out (default: 5 minutes)"),
    },
    async ({ action, rationale, projected_impact, financial_amount, expires_in_seconds }) => {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/validate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${SIGNATURE_KEY}`,
                },
                body: JSON.stringify({
                    action,
                    rationale,
                    projected_impact,
                    financial_amount,
                    expires_in_seconds,
                }),
            });

            const data = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ ORACLE-H rejected the request (HTTP ${response.status}):\n${JSON.stringify(data, null, 2)}\n\nDo NOT proceed with the action.`,
                    }],
                    isError: true,
                };
            }

            const requestId = data.request_id as string;
            const expiresAt = data.expires_at as string;
            const reliability = data.reliability as { summary?: string } | undefined;

            return {
                content: [{
                    type: "text",
                    text: [
                        `✅ Request submitted to ORACLE-H for human validation.`,
                        ``,
                        `📋 request_id: ${requestId}`,
                        `⏳ Expires at: ${expiresAt}`,
                        `📊 ${reliability?.summary ?? ""}`,
                        ``,
                        `🔄 NEXT STEP: Call oracle_poll_status with request_id="${requestId}" every 10-15 seconds until you get "approved" or "rejected".`,
                        `⚠️  Do NOT execute the action until you receive "approved". If "rejected" or "expired", abort immediately.`,
                    ].join("\n"),
                }],
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to reach ORACLE-H: ${error instanceof Error ? error.message : String(error)}\n\nDo NOT proceed with the action if you cannot reach the validation service.`,
                }],
                isError: true,
            };
        }
    }
);

// ────────────────────────────────────────────────────
// Tool 2: Poll the status of a validation request
// ────────────────────────────────────────────────────
server.tool(
    "oracle_poll_status",
    `Check the current status of a validation request previously submitted via oracle_validate.
Poll every 10-15 seconds until status is "approved" or "rejected".
If "expired", the human did not respond in time — abort the action.`,
    {
        request_id: z.string().describe("The request_id returned by oracle_validate"),
    },
    async ({ request_id }) => {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/status/${request_id}`, {
                headers: {
                    "Authorization": `Bearer ${SIGNATURE_KEY}`,
                },
            });

            const data = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Could not fetch status (HTTP ${response.status}): ${JSON.stringify(data)}`,
                    }],
                    isError: true,
                };
            }

            const status = data.status as string;
            const decisionTimestamp = data.decision_timestamp as string | null;

            const emoji = status === "approved" ? "✅" : status === "rejected" ? "🚫" : status === "expired" ? "⌛" : "⏳";
            const instruction =
                status === "approved" ? "The human approved the action. You may now proceed." :
                    status === "rejected" ? "The human REJECTED the action. Abort immediately. Do not proceed." :
                        status === "expired" ? "The request expired without a human response. Abort the action for safety." :
                            "Still waiting for human response. Poll again in 10-15 seconds.";

            return {
                content: [{
                    type: "text",
                    text: [
                        `${emoji} Status: ${status.toUpperCase()}`,
                        decisionTimestamp ? `🕐 Decision at: ${decisionTimestamp}` : "",
                        ``,
                        `📋 ${instruction}`,
                    ].filter(Boolean).join("\n"),
                }],
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to reach ORACLE-H: ${error instanceof Error ? error.message : String(error)}`,
                }],
                isError: true,
            };
        }
    }
);

// ────────────────────────────────────────────────────
// Start the MCP server (stdio transport)
// ────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ORACLE-H MCP Server running (stdio)");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
