// The Refund agent (Module 4): a second AI agent that Copper hands refund
// requests to. It has its own instructions and its own two tools. It never
// decides whether money moves: request_refund asks the app, and the app applies
// the auto-refund limit in code (decideRefund).
import { stepCountIs, tool } from "ai";
import { z } from "zod";
import { callText } from "@/lib/ai/call";
import {
  decideRefund,
  type RefundContext,
  type RefundDecision,
} from "@/lib/copper/refunds/orders";

export const REFUND_AGENT_INSTRUCTIONS = `You are the Refund agent for Copper State Labs. Copper, the shopping assistant, hands you a customer's refund request.
1. Call list_orders to see the customer's orders.
2. Work out which single order they want refunded. If it isn't clear which order they mean, don't call request_refund: ask which order, listing their paid orders.
3. Call request_refund with that order's id. The app decides, not you:
   - "refunded": tell the customer it's done and the money goes back to their original payment method.
   - "pending_approval": tell the customer it's over the auto-refund limit, so a person in the Refund team will review it, and they'll hear back here.
   - "not_refundable": explain the reason.
Never say a refund went through unless request_refund returned "refunded". Reply in two or three short, warm sentences that Copper can pass on to the customer.`;

export interface RefundAgentStep {
  tool: string;
  input: unknown;
  output: unknown;
}

export interface RefundAgentResult {
  agent: "Refund agent";
  steps: RefundAgentStep[];
  decision: RefundDecision | null;
  reply: string;
}

/** Runs the Refund agent on one request, against the orders and limit given. */
export async function runRefundAgent(
  request: string,
  context: RefundContext,
): Promise<RefundAgentResult> {
  const steps: RefundAgentStep[] = [];
  let decision: RefundDecision | null = null;

  const tools = {
    list_orders: tool({
      description: `Lists ${context.customer}'s orders: id, item, amount in US dollars and status.`,
      inputSchema: z.object({}),
      execute: async () => {
        const output = { customer: context.customer, orders: context.orders };
        steps.push({ tool: "list_orders", input: {}, output });
        return output;
      },
    }),
    request_refund: tool({
      description:
        "Asks the app to refund one order. The app checks the amount against the auto-refund limit and returns refunded, pending_approval or not_refundable.",
      inputSchema: z.object({
        orderId: z.string().describe("The order id, like 1004."),
      }),
      execute: async ({ orderId }) => {
        // One refund per hand-off, so the app's decision can't be overwritten.
        if (
          decision?.status === "refunded" ||
          decision?.status === "pending_approval"
        )
          return decision;
        decision = decideRefund(context.orders, orderId, context.limitUsd);
        steps.push({
          tool: "request_refund",
          input: { orderId },
          output: decision,
        });
        return decision;
      },
    }),
  };

  const result = await callText(
    { module: 4, feature: "refund-agent" },
    {
      instructions: REFUND_AGENT_INSTRUCTIONS,
      prompt: `Customer: ${context.customer}\nRefund request: ${request}`,
      tools,
      stopWhen: stepCountIs(4),
    },
  );

  return { agent: "Refund agent", steps, decision, reply: result.text };
}
