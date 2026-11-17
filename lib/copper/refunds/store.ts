"use client";

// The Support page's refund state, shared by the Refund Console and the chat:
// the orders, the auto-refund limit and the decisions a person made. It lives
// in the browser (localStorage), so both sides of the page always agree and a
// refresh keeps it. The pure update functions are exported for the tests.
import { useSyncExternalStore } from "react";
import {
  DEFAULT_LIMIT_USD,
  DEFAULT_ORDERS,
  type Order,
  type RefundDecision,
} from "@/lib/copper/refunds/orders";

/** A person's Approve or Reject, which the chat announces to the customer. */
export interface ReviewDecision {
  id: number;
  orderId: string;
  item: string;
  amountUsd: number;
  approved: boolean;
  /** When it was decided, so the chat only announces new decisions. */
  at: number;
}

export interface RefundState {
  limitUsd: number;
  orders: Order[];
  reviews: ReviewDecision[];
}

export const INITIAL_STATE: RefundState = {
  limitUsd: DEFAULT_LIMIT_USD,
  orders: DEFAULT_ORDERS,
  reviews: [],
};

const setStatus = (
  orders: Order[],
  orderId: string,
  status: Order["status"],
): Order[] =>
  orders.map((order) => (order.id === orderId ? { ...order, status } : order));

/** Records what the app decided when the Refund agent asked for a refund. */
export function applyDecision(
  state: RefundState,
  decision: RefundDecision,
): RefundState {
  if (decision.status === "not_refundable") return state;
  return {
    ...state,
    orders: setStatus(
      state.orders,
      decision.orderId,
      decision.status === "refunded" ? "refunded" : "pending",
    ),
  };
}

/** A person approves or rejects a refund that was over the limit. */
export function review(
  state: RefundState,
  orderId: string,
  approved: boolean,
  at = Date.now(),
): RefundState {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status !== "pending") return state;
  return {
    ...state,
    orders: setStatus(
      state.orders,
      orderId,
      approved ? "refunded" : "rejected",
    ),
    reviews: [
      ...state.reviews,
      {
        id: state.reviews.length + 1,
        orderId,
        item: order.item,
        amountUsd: order.amountUsd,
        approved,
        at,
      },
    ],
  };
}

/** What Copper tells the customer after a person approves or rejects. */
export function reviewMessage(decision: ReviewDecision): string {
  const what = `your ${formatAmount(decision.amountUsd)} refund for ${decision.item} (order #${decision.orderId})`;
  return decision.approved
    ? `Good news: our Refund team approved ${what}. The money is on its way back to your original payment method.`
    : `An update on ${what}: our Refund team reviewed it and rejected it, so no money has been refunded. If you have questions, contact the Copper Crew in the Copper app (Settings > Help).`;
}

const formatAmount = (usd: number) =>
  Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;

export function setLimit(state: RefundState, limitUsd: number): RefundState {
  return Number.isFinite(limitUsd) && limitUsd >= 0
    ? { ...state, limitUsd: Math.round(limitUsd * 100) / 100 }
    : state;
}

// The store itself: one shared value, saved to localStorage on every change.
const KEY = "copper-refunds-v1";
let state: RefundState = INITIAL_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved) state = { ...INITIAL_STATE, ...JSON.parse(saved) };
  } catch {
    // A blocked or corrupt store falls back to the starting orders.
  }
}

export function updateRefunds(change: (current: RefundState) => RefundState) {
  load();
  state = change(state);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private windows can refuse storage; the page still works until refresh.
  }
  listeners.forEach((listener) => listener());
}

export function getRefunds(): RefundState {
  load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current refund state, re-rendering whenever it changes. */
export function useRefunds(): RefundState {
  return useSyncExternalStore(subscribe, getRefunds, () => INITIAL_STATE);
}
