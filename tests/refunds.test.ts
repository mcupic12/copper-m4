import { describe, expect, it } from "vitest";
import { decideRefund, DEFAULT_ORDERS } from "@/lib/copper/refunds/orders";
import {
  applyDecision,
  INITIAL_STATE,
  review,
  reviewMessage,
  setLimit,
} from "@/lib/copper/refunds/store";

const statusOf = (state: typeof INITIAL_STATE, id: string) =>
  state.orders.find((o) => o.id === id)?.status;

describe("the auto-refund rule (code, not AI)", () => {
  it("refunds an order at or under the limit straight away", () => {
    expect(decideRefund(DEFAULT_ORDERS, "1001", 50)).toMatchObject({
      status: "refunded",
      amountUsd: 7.99,
    });
    expect(decideRefund(DEFAULT_ORDERS, "#1002", 79).status).toBe("refunded");
  });

  it("holds an order over the limit for a person to approve", () => {
    expect(decideRefund(DEFAULT_ORDERS, "order 1004", 50)).toMatchObject({
      status: "pending_approval",
      orderId: "1004",
      amountUsd: 149,
      limitUsd: 50,
    });
  });

  it("won't refund an unknown, already refunded or already waiting order", () => {
    expect(decideRefund(DEFAULT_ORDERS, "9999", 50).status).toBe(
      "not_refundable",
    );
    const refunded = DEFAULT_ORDERS.map((o) =>
      o.id === "1001" ? { ...o, status: "refunded" as const } : o,
    );
    expect(decideRefund(refunded, "1001", 50).status).toBe("not_refundable");
    const waiting = DEFAULT_ORDERS.map((o) =>
      o.id === "1004" ? { ...o, status: "pending" as const } : o,
    );
    expect(decideRefund(waiting, "1004", 500).status).toBe("not_refundable");
  });
});

describe("the Refund Console", () => {
  it("records the app's decision on the order", () => {
    const auto = applyDecision(
      INITIAL_STATE,
      decideRefund(INITIAL_STATE.orders, "1001", 50),
    );
    expect(statusOf(auto, "1001")).toBe("refunded");
    const held = applyDecision(
      INITIAL_STATE,
      decideRefund(INITIAL_STATE.orders, "1004", 50),
    );
    expect(statusOf(held, "1004")).toBe("pending");
  });

  it("Approve refunds a waiting order and Reject keeps the money", () => {
    const held = applyDecision(
      applyDecision(
        INITIAL_STATE,
        decideRefund(INITIAL_STATE.orders, "1003", 50),
      ),
      decideRefund(INITIAL_STATE.orders, "1004", 50),
    );
    const approved = review(held, "1004", true, 1);
    expect(statusOf(approved, "1004")).toBe("refunded");
    const rejected = review(approved, "1003", false, 2);
    expect(statusOf(rejected, "1003")).toBe("rejected");
    expect(rejected.reviews.map((r) => r.approved)).toEqual([true, false]);
    // Only waiting orders can be reviewed.
    expect(review(INITIAL_STATE, "1001", true)).toBe(INITIAL_STATE);
  });

  it("tells the customer what the person decided", () => {
    const base = {
      id: 1,
      orderId: "1004",
      item: "Copper Home",
      amountUsd: 149,
      at: 0,
    };
    expect(reviewMessage({ ...base, approved: true })).toMatch(
      /approved your \$149 refund for Copper Home \(order #1004\)/,
    );
    expect(reviewMessage({ ...base, approved: false })).toMatch(
      /rejected it, so no money has been refunded/,
    );
  });

  it("only accepts a sensible limit", () => {
    expect(setLimit(INITIAL_STATE, 100).limitUsd).toBe(100);
    expect(setLimit(INITIAL_STATE, -5)).toBe(INITIAL_STATE);
    expect(setLimit(INITIAL_STATE, Number.NaN)).toBe(INITIAL_STATE);
  });
});
