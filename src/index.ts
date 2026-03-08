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
// Tool 3: Cancel a pending validation request
// ────────────────────────────────────────────────────
server.tool(
    "oracle_cancel",
    "Cancel a pending validation request submitted via oracle_validate. Use this when the context has changed and the original action is no longer needed, or when you want to free up a pending request. Only works on requests still in 'pending' status.",
    {
        request_id: z.string().describe("The request_id to cancel"),
    },
    async ({ request_id }) => {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/cancel/${request_id}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${SIGNATURE_KEY}`,
                },
            });

            if (response.status === 404) {
                return {
                    content: [{
                        type: "text",
                        text: "Request not found or already decided.",
                    }],
                };
            }

            const data = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to cancel request (HTTP ${response.status}):\n${JSON.stringify(data, null, 2)}`,
                    }],
                    isError: true,
                };
            }

            return {
                content: [{
                    type: "text",
                    text: `✅ Request cancelled.`,
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
// Tool 4: List all pending validation requests
// ────────────────────────────────────────────────────
server.tool(
    "oracle_list_pending",
    "List all your pending validation requests that are still awaiting human response. Use this to recover state after a crash or restart, or to check if you have active requests before submitting a new one.",
    {},
    async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/requests?status=pending`, {
                headers: {
                    "Authorization": `Bearer ${SIGNATURE_KEY}`,
                },
            });

            const data = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to list pending requests (HTTP ${response.status}):\n${JSON.stringify(data, null, 2)}`,
                    }],
                    isError: true,
                };
            }

            const requests = data.requests as Array<Record<string, unknown>> | undefined ?? [];

            if (requests.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: "No pending requests.",
                    }],
                };
            }

            const lines = requests.map((req) => {
                const requestId = req.request_id as string;
                const action = req.action as string ?? "";
                const expiresAt = req.expires_at as string ?? "";
                return [
                    `📋 request_id: ${requestId}`,
                    `   Action: ${action.slice(0, 120)}${action.length > 120 ? "…" : ""}`,
                    `   Expires at: ${expiresAt}`,
                ].join("\n");
            });

            return {
                content: [{
                    type: "text",
                    text: `⏳ Pending requests (${requests.length}):\n\n${lines.join("\n\n")}`,
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
// Tool 5: Submit and wait for human decision in one call
// ────────────────────────────────────────────────────
server.tool(
    "oracle_wait",
    "Submit an action for human approval AND wait for the decision in a single call. This is the preferred alternative to calling oracle_validate + oracle_poll_status separately. The tool blocks until the human decides or the request expires. Use this for simple workflows where you want to submit and wait in one step.",
    {
        action: z.string().min(15).describe("Precise technical description of the action you are about to execute"),
        rationale: z.string().min(15).describe("Why this action is necessary and why it is the optimal path"),
        projected_impact: z.string().min(15).describe("Risk and impact if this action fails or is wrong. Must describe potential damage."),
        financial_amount: z.number().min(0).default(0).describe("Financial amount at stake in USD (0 if none)"),
        expires_in_seconds: z.number().min(30).default(300).describe("How long to wait for the human response before timing out (default: 5 minutes)"),
    },
    async ({ action, rationale, projected_impact, financial_amount, expires_in_seconds }) => {
        // Step 1: Submit the validation request
        let requestId: string;
        try {
            const submitResponse = await fetch(`${BASE_URL}/api/v1/validate`, {
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

            const submitData = await submitResponse.json() as Record<string, unknown>;

            if (!submitResponse.ok) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ ORACLE-H rejected the request (HTTP ${submitResponse.status}):\n${JSON.stringify(submitData, null, 2)}\n\nDo NOT proceed with the action.`,
                    }],
                    isError: true,
                };
            }

            requestId = submitData.request_id as string;
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to reach ORACLE-H: ${error instanceof Error ? error.message : String(error)}\n\nDo NOT proceed with the action if you cannot reach the validation service.`,
                }],
                isError: true,
            };
        }

        // Step 2: Poll until a terminal status or timeout
        const pollIntervalMs = 10_000;
        const maxWaitMs = expires_in_seconds * 1000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

            try {
                const pollResponse = await fetch(`${BASE_URL}/api/v1/status/${requestId}`, {
                    headers: {
                        "Authorization": `Bearer ${SIGNATURE_KEY}`,
                    },
                });

                const pollData = await pollResponse.json() as Record<string, unknown>;

                if (!pollResponse.ok) {
                    continue;
                }

                const status = pollData.status as string;
                const decisionTimestamp = pollData.decision_timestamp as string | null;

                if (status === "pending") {
                    continue;
                }

                const emoji = status === "approved" ? "✅" : status === "rejected" ? "🚫" : "⌛";
                const instruction =
                    status === "approved" ? "The human approved the action. You may now proceed." :
                        status === "rejected" ? "The human REJECTED the action. Abort immediately. Do not proceed." :
                            "The request expired without a human response. Abort the action for safety.";

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
            } catch {
                // transient error — keep polling
                continue;
            }
        }

        return {
            content: [{
                type: "text",
                text: `⌛ Status: EXPIRED\n\nThe request timed out after ${expires_in_seconds}s without a human response. Abort the action for safety.`,
            }],
        };
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
