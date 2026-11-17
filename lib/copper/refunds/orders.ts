// The customer's orders and the refund rule (Module 4). The rule is plain code,
// not AI: an amount at or under the auto-refund limit is refunded straight
// away, anything larger waits for a person in the Refund Console.

export type OrderStatus = "paid" | "pending" | "refunded" | "rejected";

export interface Order {
  id: string;
  item: string;
  amountUsd: number;
  status: OrderStatus;
}

/** The orders the Refund agent can see and act on. */
export interface RefundContext {
  customer: string;
  limitUsd: number;
  orders: Order[];
}

export type RefundDecision =
  | {
      status: "refunded" | "pending_approval";
      orderId: string;
      item: string;
      amountUsd: number;
      limitUsd: number;
    }
  | { status: "not_refundable"; orderId: string; reason: string };

export const CUSTOMER = "Maya Reyes";

export const DEFAULT_LIMIT_USD = 50;

export const DEFAULT_ORDERS: Order[] = [
  { id: "1001", item: "Copper Plus, monthly", amountUsd: 7.99, status: "paid" },
  { id: "1002", item: "Copper Plus, annual", amountUsd: 79, status: "paid" },
  { id: "1003", item: "Copper Notes", amountUsd: 129, status: "paid" },
  { id: "1004", item: "Copper Home", amountUsd: 149, status: "paid" },
];

/** "#1004", " 1004 " and "order 1004" all mean order 1004. */
export function normalizeOrderId(id: string): string {
  return id.replace(/\D/g, "");
}

/** The refund rule: the one decision made by code, not by a model or a person. */
export function decideRefund(
  orders: Order[],
  orderId: string,
  limitUsd: number,
): RefundDecision {
  const id = normalizeOrderId(orderId);
  const order = orders.find((o) => o.id === id);
  if (!order)
    return { status: "not_refundable", orderId: id, reason: "No such order." };
  if (order.status === "refunded")
    return {
      status: "not_refundable",
      orderId: id,
      reason: "This order has already been refunded.",
    };
  if (order.status === "pending")
    return {
      status: "not_refundable",
      orderId: id,
      reason: "A refund for this order is already waiting for approval.",
    };
  if (order.status === "rejected")
    return {
      status: "not_refundable",
      orderId: id,
      reason: "A refund for this order was already reviewed and rejected.",
    };
  return {
    status: order.amountUsd <= limitUsd ? "refunded" : "pending_approval",
    orderId: id,
    item: order.item,
    amountUsd: order.amountUsd,
    limitUsd,
  };
}
