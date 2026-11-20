"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, MapPin, Phone, RefreshCw, Wallet, X } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { apiClient } from "@/lib/api";
import { PizzaIcon, RamenIcon, TacoIcon } from "@/components/food-icons";
import { AdminShell, VerifyingScreen, btnOutline, card, display, focus, ic, inputClass, money } from "@/components/admin/admin-shell";

type Order = {
  order_id: number;
  order_date: string;
  total_amount: number | string;
  order_status: string;
  customer_name: string;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  item_count: number | string;
};
type OrderItem = { food_id: number; food_name: string; quantity: number; subtotal: number | string };

// Must match the statuses your backend accepts
const STATUSES = ["Pending", "Preparing", "Out for delivery", "Delivered", "Cancelled"];

// Each status gets its own soft tint; green is reserved for "Delivered" (a success)
const BADGE: Record<string, string> = {
  Pending: "bg-[#EFE8DE] text-[#5F5850]",
  Preparing: "bg-[#FFF1D6] text-[#8A5A00]",
  "Out for delivery": "bg-[#262626] text-white",
  Delivered: "bg-[#EAF6EE] text-[#1E6B41]",
  Cancelled: "bg-[#FDEDEA] text-[#9B2C1F]",
};

export default function OrdersAdminPage() {
  const { isChecking } = useAuthGuard({ requireAuth: true });
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("All");
  const [openId, setOpenId] = useState<number | null>(null);
  const [items, setItems] = useState<Record<number, OrderItem[]>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient<Order[]>("/my/admin/orders", { method: "GET", requiresAuth: true });
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isChecking) load();
  }, [isChecking, load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4500);
    return () => clearTimeout(t);
  }, [success]);

  const toggle = async (id: number) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (items[id]) return;
    try {
      const data = await apiClient<Order & { items: OrderItem[] }>(`/my/admin/orders/${id}`, { method: "GET", requiresAuth: true });
      setItems((s) => ({ ...s, [id]: data.items ?? [] }));
    } catch (err: any) {
      setError(err.message || "Failed to load the order's items.");
    }
  };

  const changeStatus = async (id: number, status: string) => {
    setError("");
    setSuccess("");
    setSavingId(id);
    try {
      const updated = await apiClient<Order>(`/my/admin/orders/${id}/status`, {
        method: "PATCH",
        requiresAuth: true,
        body: JSON.stringify({ status }),
      });
      setOrders((list) => list.map((o) => (o.order_id === id ? { ...o, ...updated } : o)));
      setSuccess(`Order #${id} marked as ${status.toLowerCase()}.`);
    } catch (err: any) {
      setError(err.message || "Failed to update the order.");
    } finally {
      setSavingId(null);
    }
  };

  if (isChecking) return <VerifyingScreen />;

  const counts = (s: string) => (s === "All" ? orders.length : orders.filter((o) => o.order_status === s).length);
  const visible = filter === "All" ? orders : orders.filter((o) => o.order_status === filter);

  return (
    <AdminShell title="Orders" subtitle="See what customers ordered and move each order from the kitchen to the door." icons={[TacoIcon, PizzaIcon]}>
      {error && (
        <div role="alert" className="rise flex items-start gap-2.5 rounded-2xl border border-[#F5B5AB] bg-[#FDEDEA] p-4 text-[15px] leading-snug text-[#9B2C1F]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss message" className={`rounded-lg p-1 hover:bg-[#F8D4CD] ${focus}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div role="status" className="rise flex items-center gap-2.5 rounded-2xl border border-[#BFE3CC] bg-[#EAF6EE] p-4 text-[15px] text-[#1E6B41]">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2E8B57] text-white">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <p className="flex-1">{success}</p>
          <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss message" className={`rounded-lg p-1 hover:bg-[#D3EDDC] ${focus}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className={`${card} p-6 sm:p-8`} aria-labelledby="orders-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="orders-title" className={`${display.className} text-2xl font-extrabold tracking-tight`}>All orders</h2>
          <button type="button" onClick={load} disabled={loading} className={btnOutline}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
          {["All", ...STATUSES].map((s) => {
            const on = filter === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(s)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors ${focus} ${
                  on ? "bg-[#262626] text-white" : "bg-white text-[#262626] ring-1 ring-[#DDD2C4] hover:bg-[#EFE8DE]"
                }`}
              >
                {s}
                <span className={`rounded-full px-2 text-xs tabular-nums ${on ? "bg-white/20" : "bg-[#F1E7DA]"}`}>{counts(s)}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <ul className="mt-6 space-y-3" aria-busy="true" aria-label="Loading orders">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-[#FBF7F1] ring-1 ring-[#EFE6DA] motion-reduce:animate-none" />
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-[#FBF7F1] px-5 py-12 text-center ring-1 ring-[#EFE6DA]">
            <div className="mx-auto w-20">
              <RamenIcon className={ic} />
            </div>
            <p className={`${display.className} mt-4 text-xl font-extrabold tracking-tight`}>
              {orders.length === 0 ? "No orders yet" : `No ${filter.toLowerCase()} orders`}
            </p>
            <p className="mt-1 text-[15px] text-[#5F5850]">
              {orders.length === 0 ? "New orders will show up here as customers place them." : "Try another status."}
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {visible.map((o) => {
              const open = openId === o.order_id;
              const saving = savingId === o.order_id;
              return (
                <li key={o.order_id} className="rounded-2xl bg-[#FBF7F1] ring-1 ring-[#EFE6DA]">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 sm:p-5">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="flex items-center gap-2">
                        <span className="rounded-full bg-[#F1E7DA] px-2.5 py-1 text-sm font-semibold tabular-nums">#{o.order_id}</span>
                        <span className="truncate font-semibold">{o.customer_name}</span>
                      </p>
                      <p className="mt-1 text-sm text-[#5F5850]">
                        {new Date(o.order_date).toLocaleString()} · {Number(o.item_count)} {Number(o.item_count) === 1 ? "item" : "items"}
                      </p>
                    </div>

                    <p className={`${display.className} text-xl font-extrabold tabular-nums`}>{money(Number(o.total_amount))}</p>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${BADGE[o.order_status] ?? BADGE.Pending}`}>{o.order_status}</span>

                    <div className="flex items-center gap-2">
                      <label htmlFor={`status-${o.order_id}`} className="sr-only">Change status for order {o.order_id}</label>
                      <select
                        id={`status-${o.order_id}`}
                        value={o.order_status}
                        disabled={saving}
                        onChange={(e) => changeStatus(o.order_id, e.target.value)}
                        className={`${inputClass(false)} !h-10 !w-44 !rounded-xl !py-0 !text-[15px]`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {saving && <Loader2 className="h-4 w-4 animate-spin text-[#5F5850]" aria-label="Saving" />}
                      <button
                        type="button"
                        onClick={() => toggle(o.order_id)}
                        aria-expanded={open}
                        aria-label={`${open ? "Hide" : "Show"} details for order ${o.order_id}`}
                        className={`grid h-10 w-10 place-items-center rounded-xl text-[#5F5850] hover:bg-[#EFE8DE] hover:text-[#262626] ${focus}`}
                      >
                        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="grid gap-5 border-t border-[#EFE6DA] p-4 sm:grid-cols-2 sm:p-5">
                      <ul className="space-y-2 text-[15px]">
                        {items[o.order_id] ? (
                          items[o.order_id].map((it) => (
                            <li key={it.food_id} className="flex justify-between gap-3">
                              <span>{it.quantity} × {it.food_name}</span>
                              <span className="tabular-nums text-[#5F5850]">{money(Number(it.subtotal))}</span>
                            </li>
                          ))
                        ) : (
                          <li className="flex items-center gap-2 text-[#5F5850]">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading items...
                          </li>
                        )}
                      </ul>
                      <dl className="space-y-2 text-[15px] text-[#5F5850]">
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                          <dd>{o.delivery_address || "No address"}</dd>
                        </div>
                        {o.customer_phone && (
                          <div className="flex items-start gap-2">
                            <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                            <dd>{o.customer_phone}</dd>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                          <dd>{o.payment_method} · {o.payment_status}</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}