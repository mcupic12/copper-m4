"use client";

// The Refund Console (Module 4): the auto-refund limit, the refunds waiting
// for a person, and the customer's orders. Approve and Reject here are the
// human decisions; the chat tells the customer what happened.
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/copper/catalog";
import { CUSTOMER, type OrderStatus } from "@/lib/copper/refunds/orders";
import {
  INITIAL_STATE,
  review,
  setLimit,
  updateRefunds,
  useRefunds,
} from "@/lib/copper/refunds/store";

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-secondary text-secondary-foreground" },
  pending: {
    label: "Waiting for approval",
    className: "bg-chart-4 text-chart-5",
  },
  refunded: { label: "Refunded", className: "bg-accent text-white" },
  rejected: { label: "Refund rejected", className: "bg-chart-3 text-white" },
};

export function RefundConsole() {
  const { limitUsd, orders } = useRefunds();
  const [draft, setDraft] = useState<string | null>(null);
  const waiting = orders.filter((o) => o.status === "pending");

  return (
    <div className="mt-6 space-y-8">
      <p className="text-muted-foreground">
        Ask for a refund in the chat as the customer. Copper hands the request
        to the Refund agent, which asks the app for the refund. The app checks
        the amount against your limit: at or under it, the refund goes through
        on its own; over it, it waits here for you.
      </p>

      <section className="space-y-2">
        <Label htmlFor="refund-limit" className="text-base font-semibold">
          Auto-refund limit
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            id="refund-limit"
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            value={draft ?? String(limitUsd)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft !== null)
                updateRefunds((s) => setLimit(s, Number(draft)));
              setDraft(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="w-32"
          />
        </div>
        <p className="text-muted-foreground text-sm">
          Refunds up to {formatUsd(limitUsd)} go through on their own. Anything
          larger needs your approval.
        </p>
      </section>

      <section className="space-y-3" data-testid="refunds-waiting">
        <h2 className="text-lg font-semibold">Waiting for your approval</h2>
        {waiting.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing is waiting. Refunds over the limit will stop here.
          </p>
        ) : (
          waiting.map((order) => (
            <div
              key={order.id}
              className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  #{order.id} · {order.item}
                </p>
                <p className="text-muted-foreground text-sm">
                  {formatUsd(order.amountUsd)} for {CUSTOMER}, over your{" "}
                  {formatUsd(limitUsd)} limit
                </p>
              </div>
              <Button
                onClick={() => updateRefunds((s) => review(s, order.id, true))}
              >
                <CheckIcon /> Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => updateRefunds((s) => review(s, order.id, false))}
              >
                <XIcon /> Reject
              </Button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{CUSTOMER}&apos;s orders</h2>
        <ul className="divide-y rounded-xl border">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span className="text-muted-foreground font-mono text-sm">
                #{order.id}
              </span>
              <span className="flex-1 font-medium">{order.item}</span>
              <Badge className={STATUS[order.status].className}>
                {STATUS[order.status].label}
              </Badge>
              <span className="w-20 text-right font-mono">
                {formatUsd(order.amountUsd)}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateRefunds(() => INITIAL_STATE)}
        >
          Reset the demo orders
        </Button>
      </section>
    </div>
  );
}
