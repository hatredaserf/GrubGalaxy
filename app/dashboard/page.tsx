"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { AlertCircle, Check, ChevronDown, ClipboardList, Loader2, LogOut, MapPin, Mail, Minus, Pencil, Phone, Plus, RefreshCw, Search, ShoppingBag, Trash2, UserRound, Wallet, X } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { apiClient } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { Button } from "@/components/ui/button";
import {
  BurgerIcon,
  CoffeeIcon,
  DonutIcon,
  FriesIcon,
  IceCreamIcon,
  PizzaIcon,
  RamenIcon,
  TacoIcon,
} from "@/components/food-icons";

const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"] });

// Change this to your app's name
const BRAND = "GrubGalaxy";

// Delivery fee in Philippine pesos. Change it in one place.
const DELIVERY_FEE = 49;

// Your backend routes. Adjust these if your server uses different paths.
// Customer-facing routes live under /my in the NestJS "dashboard" module; categories uses your existing route
const API = {
  foodItems: "/my/menu", // GET the menu
  menu: "/my/menu", // POST to add, PUT /:id to edit, DELETE /:id to remove
  categories: "/my/categories",
  restaurants: "/my/restaurants",
  orders: "/my/orders",
  profile: "/my/profile",
};

// Set to true so only admins (usersx.user_role = 'Admin') can add, edit and delete menu items.
// Set the same flag in the backend (dashboard.service.ts).
const ONLY_ADMINS_CAN_EDIT_MENU = true;

// Saved in your payment table as payment_method
const PAYMENT_METHODS = ["Cash on delivery", "GCash", "Card"];

/*
  Palette (60 / 30 / 10), shared with the login and register pages
  Surfaces 60%: off-white #F8F8F8, cream #F8F2E9 / #F1E7DA, white cards
  Text 30%:     charcoal #262626, warm gray #5F5850 (never pure black)
  Accent 10%:   vibrant orange #E8590C, used only for the main "Place order" button and focus rings
  Feedback:     green #2E8B57 for success only
*/

type IconType = ComponentType<{ size?: number; className?: string }>;
type Item = {
  id: string;
  rawId: unknown; // the id exactly as your API sent it
  name: string;
  desc: string;
  price: number;
  category: string;
  Icon: IconType;
  tilt: number;
  available: boolean;
  restaurant: string;
  categoryId?: unknown; // used when editing a food item
  restaurantId?: unknown;
};
type Raw = Record<string, any>;

// Shown only when the food items API can't be reached, so the page is never empty
const SAMPLE_MENU: Item[] = [
  { id: "burger", name: "Smash Burger", desc: "Double patty, melted cheese, tomato and crisp lettuce.", price: 149, category: "Mains", Icon: BurgerIcon, tilt: -4 },
  { id: "pizza", name: "Pepperoni Pizza", desc: "Stone-baked slice with bubbly cheese and fresh basil.", price: 289, category: "Mains", Icon: PizzaIcon, tilt: 6 },
  { id: "ramen", name: "Tonkotsu Ramen", desc: "Rich broth, springy noodles and a soft-boiled egg.", price: 249, category: "Mains", Icon: RamenIcon, tilt: -3 },
  { id: "taco", name: "Street Tacos", desc: "Crisp shell, seasoned beef, lettuce, tomato and cheese.", price: 159, category: "Mains", Icon: TacoIcon, tilt: 5 },
  { id: "fries", name: "Crispy Fries", desc: "Golden, salted and served piping hot.", price: 89, category: "Sides", Icon: FriesIcon, tilt: -6 },
  { id: "coffee", name: "Flat White", desc: "Smooth espresso with velvety steamed milk.", price: 120, category: "Drinks", Icon: CoffeeIcon, tilt: 4 },
  { id: "donut", name: "Glazed Donut", desc: "Soft, pillowy and topped with rainbow sprinkles.", price: 59, category: "Desserts", Icon: DonutIcon, tilt: -8 },
  { id: "icecream", name: "Strawberry Cone", desc: "Creamy scoop in a waffle cone with a cherry on top.", price: 79, category: "Desserts", Icon: IceCreamIcon, tilt: 5 },
].map((m) => ({ ...m, rawId: m.id, available: true, restaurant: "" }));

// Philippine peso, e.g. ₱149 or ₱149.50
const money = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);

/* ---------- Turning your API's rows into menu items ----------
   Field names differ between backends, so each value is read from the most likely names.
   If your columns are named differently, add the name to the list in normalizeMenu. */

const toList = (res: unknown): Raw[] => {
  if (Array.isArray(res)) return res;
  const r = res as Raw | null;
  const inner = r?.data ?? r?.items ?? r?.fooditems ?? r?.foodItems ?? r?.categories ?? r?.results;
  return Array.isArray(inner) ? inner : [];
};
const pick = (o: Raw, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null);

// Pick the closest-looking illustration from the item's name or category
const KEYWORDS: [RegExp, IconType][] = [
  [/burger|patty|sandwich/i, BurgerIcon],
  [/pizza/i, PizzaIcon],
  [/ramen|noodle|soup|pasta/i, RamenIcon],
  [/taco|burrito|wrap/i, TacoIcon],
  [/fries|chips|wedge/i, FriesIcon],
  [/coffee|latte|espresso|tea|drink|juice|soda|shake/i, CoffeeIcon],
  [/donut|doughnut|cake|pastry|cookie/i, DonutIcon],
  [/ice ?cream|cone|sundae|gelato|dessert/i, IceCreamIcon],
];
const FALLBACK_ICONS: IconType[] = [BurgerIcon, PizzaIcon, RamenIcon, TacoIcon, FriesIcon, DonutIcon, IceCreamIcon, CoffeeIcon];
const TILTS = [-4, 6, -3, 5, -6, 4, -8, 5];
const pickIcon = (name: string, category: string, i: number): IconType =>
  KEYWORDS.find(([re]) => re.test(name))?.[1] ?? KEYWORDS.find(([re]) => re.test(category))?.[1] ?? FALLBACK_ICONS[i % FALLBACK_ICONS.length];

function normalizeMenu(foods: Raw[], cats: Raw[]): { items: Item[]; categories: string[] } {
  const catName = new Map<string, string>();
  cats.forEach((c) => {
    const id = pick(c, ["id", "_id", "category_id", "categoryId"]);
    const name = pick(c, ["name", "category_name", "categoryName", "title"]);
    if (id !== undefined && name) catName.set(String(id), String(name));
  });
  const refName = (v: any) =>
    v && typeof v === "object" ? String(v.name ?? v.title ?? "Other") : (catName.get(String(v)) ?? String(v));

  const items: Item[] = foods.map((f, i) => {
    const rawId = pick(f, ["id", "_id", "food_id", "foodId", "fooditem_id", "foodItemId"]) ?? i;
    const name = String(pick(f, ["name", "food_name", "foodName", "title"]) ?? "Untitled item");
    const catRef = pick(f, ["category", "category_name", "categoryName", "category_id", "categoryId"]);
    const category = catRef !== undefined ? refName(catRef) : "Other";
    const av = pick(f, ["availability", "available", "is_available", "isAvailable", "in_stock", "inStock"]);
    const price = Number(pick(f, ["price", "unit_price", "unitPrice", "cost"]) ?? 0);
    return {
      id: String(rawId),
      rawId,
      name,
      desc: String(pick(f, ["description", "desc", "details"]) ?? ""),
      restaurant: String(pick(f, ["restaurant_name", "restaurantName"]) ?? ""),
      categoryId: pick(f, ["category_id", "categoryId"]),
      restaurantId: pick(f, ["restaurant_id", "restaurantId"]),
      price: Number.isFinite(price) ? price : 0,
      category,
      Icon: pickIcon(name, category, i),
      tilt: TILTS[i % TILTS.length],
      available: av === undefined ? true : av !== false && av !== 0 && av !== "0",
    };
  });

  // Categories in your table's order, only the ones that have items, then any leftovers
  const present = new Set(items.map((m) => m.category));
  const ordered = Array.from(catName.values()).filter((n) => present.has(n));
  const categories = [...ordered, ...Array.from(present).filter((n) => !ordered.includes(n))];
  return { items, categories };
}

const ic = "block h-auto w-full drop-shadow-[0_14px_16px_rgba(60,40,20,0.28)]";

/* ---------- Cart panel (used on desktop and in the mobile drawer) ---------- */

type Line = Item & { qty: number };

function CartPanel({
  lines,
  subtotal,
  placed,
  placing,
  orderError,
  address,
  payment,
  addressBad,
  onAddress,
  onPayment,
  onInc,
  onDec,
  onPlace,
  onReset,
  onClose,
}: {
  lines: Line[];
  subtotal: number;
  placed: boolean;
  placing: boolean;
  orderError: string;
  address: string;
  payment: string;
  addressBad: boolean;
  onAddress: (v: string) => void;
  onPayment: (v: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onPlace: () => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = subtotal + (count ? DELIVERY_FEE : 0);
  const uid = useId();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between">
        <h2 className={`${display.className} text-2xl font-extrabold tracking-tight`}>Your order</h2>
        <div className="flex items-center gap-2">
          {count > 0 && !placed && (
            <span className="rounded-full bg-[#F1E7DA] px-3 py-1 text-sm font-semibold">{count} {count === 1 ? "item" : "items"}</span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close cart"
              className="grid h-9 w-9 place-items-center rounded-xl text-[#5F5850] transition-colors hover:bg-[#EFE8DE] hover:text-[#262626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {placed ? (
        <div role="status" className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <span className="check-pop grid h-16 w-16 place-items-center rounded-full bg-[#2E8B57] text-white shadow-[0_14px_28px_-10px_rgba(46,139,87,0.7)]">
            <Check className="h-8 w-8" strokeWidth={3} />
          </span>
          <p className={`${display.className} mt-5 text-2xl font-extrabold tracking-tight`}>Order placed</p>
          <p className="mt-1 text-[15px] text-[#5F5850]">Thanks for ordering. Hungry again?</p>
          <button
            type="button"
            onClick={onReset}
            className="mt-6 rounded font-semibold underline underline-offset-4 hover:text-[#B54708] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
          >
            Start a new order
          </button>
        </div>
      ) : count === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="w-24 opacity-90">
            <RamenIcon className={ic} />
          </div>
          <p className={`${display.className} mt-4 text-xl font-extrabold tracking-tight`}>Your cart is empty</p>
          <p className="mt-1 max-w-[16rem] text-[15px] text-[#5F5850]">Pick something tasty from the menu and it will show up here.</p>
        </div>
      ) : (
        <>
          {/* Only the item list scrolls; the address, payment, totals and Place order button below always stay in view */}
          <div className="-mx-2 mt-5 min-h-[8rem] flex-1 overflow-y-auto px-2 pb-1">
            <ul className="space-y-3 py-1">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-[#FBF7F1] p-3 ring-1 ring-[#EFE6DA]">
                  <div className="w-14 shrink-0">
                    <l.Icon className={ic} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-tight">{l.name}</p>
                    <p className="text-sm text-[#5F5850]">{money(l.price * l.qty)}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-[#E3D9CB]">
                    <button
                      type="button"
                      onClick={() => onDec(l.id)}
                      aria-label={`Remove one ${l.name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-[#EFE8DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums" aria-live="polite">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => onInc(l.id)}
                      aria-label={`Add one more ${l.name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-[#EFE8DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 shrink-0">
            <div className="mb-3 space-y-3">
              <div className="space-y-2">
                <label htmlFor={`${uid}-address`} className="text-sm font-semibold">
                  Delivery address
                </label>
                <textarea
                  id={`${uid}-address`}
                  rows={1}
                  value={address}
                  onChange={(e) => onAddress(e.target.value)}
                  placeholder="House no., street, barangay, city"
                  aria-invalid={addressBad}
                  className={`h-11 w-full resize-none rounded-2xl bg-[#FCFBF9] px-4 py-2.5 text-base [@media(min-height:860px)]:h-[4.5rem] [@media(min-height:860px)]:py-3 text-[#262626] placeholder:text-[#8C8379] transition-[border-color,box-shadow] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-4 ${
                    addressBad
                      ? "border border-[#E5675A] focus-visible:border-[#E5675A] focus-visible:ring-[#E5675A]/25"
                      : "border border-[#A39888] hover:border-[#857A6D] focus-visible:border-[#E8590C] focus-visible:ring-[#E8590C]/20"
                  }`}
                />
                {addressBad && orderError && (
                  <p role="alert" className="flex items-center gap-1.5 text-sm text-[#9B2C1F]">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {orderError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p id={`${uid}-pay`} className="text-sm font-semibold">Payment method</p>
                <div role="group" aria-labelledby={`${uid}-pay`} className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={payment === m}
                      onClick={() => onPayment(m)}
                      className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C] focus-visible:ring-offset-2 ${
                        payment === m ? "bg-[#262626] text-white" : "bg-white text-[#262626] ring-1 ring-[#DDD2C4] hover:bg-[#EFE8DE]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[#EFE6DA] pt-3">
              <p className="flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className={`${display.className} text-2xl font-extrabold tabular-nums`}>{money(total)}</span>
              </p>
              <p className="text-sm text-[#5F5850]">
                {money(subtotal)} items + {money(DELIVERY_FEE)} delivery
              </p>
            </div>

            {orderError && !addressBad && (
              <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#F5B5AB] bg-[#FDEDEA] p-3 text-sm leading-snug text-[#9B2C1F]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {orderError}
              </div>
            )}
            <Button
              type="button"
              onClick={onPlace}
              disabled={placing}
              className="group relative mt-3 h-[52px] w-full overflow-hidden rounded-2xl bg-[#E8590C] text-base font-semibold text-[#2A1206] shadow-[0_14px_28px_-12px_rgba(232,89,12,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#F2701F] focus-visible:ring-4 focus-visible:ring-[#E8590C]/35 active:translate-y-0 disabled:opacity-80"
            >
              <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/35 blur-md transition-transform duration-700 group-hover:translate-x-[320%]" />
              <span className="relative flex items-center">
                {placing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing order...
                  </>
                ) : (
                  `Place order · ${money(total)}`
                )}
              </span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Order confirmed: celebration + delivery rider tracking ---------- */

type Summary = { count: number; total: number; payment: string; address: string };

// Sprinkle-colored confetti that bursts from the check mark (deterministic, so no random mismatch)
const CONFETTI_COLORS = ["#F2B63D", "#4CC9C0", "#F077A6", "#7CC25B", "#E8590C", "#FF8FA3", "#FFD166"];
const CONFETTI = Array.from({ length: 30 }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180;
  const dist = 90 + (i % 6) * 28;
  return {
    dx: Math.round(Math.cos(a) * dist),
    dy: Math.round(Math.sin(a) * dist * 0.8 - 50),
    rot: (i % 2 ? 1 : -1) * (240 + (i % 5) * 70),
    delay: 0.35 + (i % 6) * 0.03,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
  };
});

const TRACK_STEPS = [
  { label: "Order confirmed", sub: "We've received your order." },
  { label: "Preparing your food", sub: "The kitchen is on it." },
  { label: "Rider picked up your order", sub: "Your rider has your food." },
  { label: "On the way", sub: "Heading to your address." },
  { label: "Delivered", sub: "Enjoy your meal!" },
];

// There is no live rider data yet, so the steps advance on a timer to show how tracking will look.
// When your backend can report a real delivery status, drive `step` from that instead.
const TRACKING_IS_DEMO = true;
const TRACK_AT = [0, 1800, 8000, 11000, 19000]; // ms when each step begins
const RIDER_X = [12, 12, 30, 62, 86]; // how far across the map the rider is, in %
const TIME_LEFT = [1, 0.8, 0.5, 0.25, 0]; // share of the estimate still remaining at each step

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Rider({ moving }: { moving: boolean }) {
  const wheel = `wheel ${moving ? "spin" : ""}`;
  return (
    <svg viewBox="0 0 96 64" className="h-16 w-24 overflow-visible" aria-hidden>
      <ellipse cx="48" cy="61" rx="34" ry="3.5" fill="#000" opacity=".18" />
      {/* delivery box on the back */}
      <rect x="4" y="19" width="26" height="21" rx="3.5" fill="#E8590C" />
      <rect x="4" y="19" width="26" height="6" rx="3" fill="#F2701F" />
      <path d="M9 33h16" stroke="#FFE3C2" strokeWidth="2" strokeLinecap="round" />
      {/* wheels */}
      <g className={wheel}>
        <circle cx="22" cy="50" r="10" fill="#262626" />
        <circle cx="22" cy="50" r="4.5" fill="#D9CFC2" />
        <path d="M22 41v18M13 50h18" stroke="#D9CFC2" strokeWidth="1.4" />
      </g>
      <g className={wheel}>
        <circle cx="74" cy="50" r="10" fill="#262626" />
        <circle cx="74" cy="50" r="4.5" fill="#D9CFC2" />
        <path d="M74 41v18M65 50h18" stroke="#D9CFC2" strokeWidth="1.4" />
      </g>
      {/* bike */}
      <path d="M22 50L34 38H58L74 50" fill="none" stroke="#4A4A4A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 37c3-9 12-12 24-8l3 9z" fill="#4A4A4A" />
      <path d="M62 34L74 50" stroke="#6B6B6B" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 36h16" stroke="#262626" strokeWidth="5" strokeLinecap="round" />
      <circle cx="69" cy="33" r="2.6" fill="#FFD166" />
      {/* rider */}
      <path d="M38 34c0-10 5-16 13-17l6 9-8 10z" fill="#262626" />
      <path d="M52 24l12 6" stroke="#262626" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M40 36l7 11h12" fill="none" stroke="#262626" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="56" cy="14" r="7.5" fill="#fff" />
      <path d="M57 12h6.3a7.5 7.5 0 0 1-3 6.2H57z" fill="#262626" opacity=".85" />
      <path d="M49 11a7.5 7.5 0 0 1 7-4.5" stroke="#E8590C" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SuccessOverlay({
  summary,
  onClose,
  fixedStep,
  orderId,
  startedAt,
}: {
  summary: Summary;
  onClose: () => void;
  fixedStep?: number; // set when tracking an existing order: it shows the order's real status
  orderId?: number;
  startedAt?: Date;
}) {
  const live = fixedStep !== undefined;
  const [step, setStep] = useState(fixedStep ?? 0);

  // A brand-new order plays the demo timeline; an existing order just shows where it is
  useEffect(() => {
    if (live) return;
    const timers = TRACK_AT.slice(1).map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [live]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A rough estimate: a base time plus a little per item, shown as a 10-minute window
  const eta = useMemo(() => {
    const minutes = Math.min(25 + summary.count * 2, 45);
    const arrive = new Date((startedAt ? startedAt.getTime() : Date.now()) + minutes * 60000);
    return { minutes, arrive, range: `${clock(arrive)} - ${clock(new Date(arrive.getTime() + 10 * 60000))}` };
  }, [summary.count, startedAt]);

  const delivered = step === TRACK_STEPS.length - 1;
  const moving = step === 2 || step === 3;
  const minutesLeft = live ? Math.max(0, Math.round((eta.arrive.getTime() - Date.now()) / 60000)) : Math.round(eta.minutes * TIME_LEFT[step]);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fade-in fixed inset-0 bg-[#262626]/50 backdrop-blur-[2px]" aria-hidden />
      <div
        className="relative flex min-h-full items-center justify-center p-4 sm:p-5"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
          className="card-in relative w-full max-w-md rounded-[28px] bg-white p-5 shadow-[0_50px_100px_-30px_rgba(60,40,20,0.55)] ring-1 ring-[#EFE6DA] sm:p-6"
        >
          <p className="sr-only" role="status" aria-live="polite">{TRACK_STEPS[step].label}</p>

          {/* Confirmation, or the order's own header when tracking an existing order */}
          {live ? (
            <div className="flex items-center gap-4">
              <span className={`${display.className} grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#F1E7DA] text-lg font-extrabold tabular-nums`} aria-hidden>
                #{orderId}
              </span>
              <div className="min-w-0">
                <h2 id="success-title" className={`${display.className} text-2xl font-extrabold leading-tight tracking-tight`}>Tracking your order</h2>
                <p className="text-[15px] text-[#5F5850]">
                  {summary.count} {summary.count === 1 ? "item" : "items"} · {money(summary.total)}
                </p>
              </div>
            </div>
          ) : (
          <div className="flex items-center gap-4">
            <div className="relative grid h-14 w-14 shrink-0 place-items-center" aria-hidden>
              <span className="ring-out absolute inset-0 rounded-full border-2 border-[#2E8B57]/50" />
              <svg viewBox="0 0 52 52" className="badge-pop h-14 w-14 drop-shadow-[0_10px_14px_rgba(46,139,87,0.45)]">
                <circle cx="26" cy="26" r="25" fill="#2E8B57" />
                <path d="M15 27l8 8 14-16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="draw" />
              </svg>
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className={`confetti absolute left-1/2 top-1/2 ${c.round ? "h-2 w-2 rounded-full" : "h-1.5 w-3 rounded-[2px]"}`}
                  style={
                    {
                      backgroundColor: c.color,
                      "--dx": `${c.dx}px`,
                      "--dy": `${c.dy}px`,
                      "--rot": `${c.rot}deg`,
                      animationDelay: `${c.delay}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            <div className="min-w-0">
              <h2 id="success-title" className={`${display.className} tick text-2xl font-extrabold leading-tight tracking-tight`} style={{ animationDelay: "0.5s" }}>
                Order confirmed!
              </h2>
              <p className="tick text-[15px] text-[#5F5850]" style={{ animationDelay: "0.6s" }}>
                {summary.count} {summary.count === 1 ? "item" : "items"} · {money(summary.total)}
              </p>
            </div>
          </div>
          )}

          {/* The rider rides from the restaurant to your door as the order moves along */}
          <div className="tick relative mt-5 h-32 overflow-hidden rounded-2xl bg-gradient-to-b from-[#FFF3E2] to-[#F1E7DA] ring-1 ring-[#EFE6DA]" style={{ animationDelay: "0.7s" }} aria-hidden>
            <div className="absolute -top-8 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-[#FFD9B3]/70 blur-2xl" />

            <svg viewBox="0 0 40 40" className="absolute bottom-7 left-2 h-10 w-10">
              <rect x="6" y="16" width="28" height="20" rx="2" fill="#fff" />
              <path d="M4 16l3-9h26l3 9z" fill="#262626" />
              <path d="M13 7l-2 9M20 7v9M27 7l2 9" stroke="#FFE3C2" strokeWidth="2" />
              <rect x="16" y="24" width="8" height="12" rx="1" fill="#262626" />
            </svg>
            <svg viewBox="0 0 40 40" className="absolute bottom-7 right-2 h-10 w-10">
              <path d="M5 20L20 7l15 13v15H5z" fill="#fff" />
              <path d="M3 21L20 6l17 15" fill="none" stroke="#262626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="16" y="24" width="8" height="11" rx="1" fill="#262626" />
            </svg>

            <div className="absolute inset-x-0 bottom-0 h-7 bg-[#4A4A4A]">
              <div
                className={`absolute inset-x-0 top-1/2 h-[3px] ${moving ? "road-move" : ""}`}
                style={{ backgroundImage: "repeating-linear-gradient(90deg, #D9CFC2 0 14px, transparent 14px 28px)" }}
              />
            </div>

            <div className="absolute bottom-[10px] transition-[left] duration-[3200ms] ease-in-out" style={{ left: `${RIDER_X[step]}%`, transform: "translateX(-50%)" }}>
              <div className="ride-in relative">
                {moving && (
                  <span className="absolute right-full top-5 mr-1 flex flex-col gap-1.5">
                    {[0, 0.15, 0.3].map((d) => (
                      <span key={d} className="speed block h-0.5 w-6 rounded-full bg-[#262626]/40" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </span>
                )}
                <Rider moving={moving} />
              </div>
            </div>
          </div>

          {/* Status and estimated arrival */}
          <div className="tick mt-5 flex items-start justify-between gap-4" style={{ animationDelay: "0.8s" }}>
            <div key={step} className="tick min-w-0" style={{ animationDelay: "0s" }}>
              <p className={`${display.className} text-xl font-extrabold leading-tight tracking-tight`} aria-hidden>{TRACK_STEPS[step].label}</p>
              <p className="mt-0.5 text-[15px] text-[#5F5850]" aria-hidden>{TRACK_STEPS[step].sub}</p>
            </div>
            <div className="shrink-0 rounded-2xl bg-[#FBF7F1] px-3.5 py-2 text-right ring-1 ring-[#EFE6DA]">
              <p className="text-xs font-semibold text-[#5F5850]">{delivered ? "Status" : "Estimated arrival"}</p>
              <p className={`${display.className} text-base font-extrabold tabular-nums`}>{delivered ? "Arrived" : eta.range}</p>
              {!delivered && <p className="text-sm text-[#5F5850]">about {minutesLeft} min</p>}
            </div>
          </div>

          {/* Steps */}
          <ol className="tick mt-5 space-y-0" style={{ animationDelay: "0.9s" }}>
            {TRACK_STEPS.map((t, i) => {
              const done = i < step || (delivered && i === step);
              const current = i === step && !delivered;
              return (
                <li key={t.label} className="relative flex items-center gap-3 py-1.5">
                  {i < TRACK_STEPS.length - 1 && (
                    <span className={`absolute left-[13px] top-[2.1rem] h-[calc(100%-1.1rem)] w-0.5 ${i < step ? "bg-[#BFE3CC]" : "bg-[#EFE6DA]"}`} aria-hidden />
                  )}
                  <span
                    className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      done ? "bg-[#2E8B57] text-white" : current ? "pulse-ring bg-[#262626]" : "bg-white ring-2 ring-[#E3D9CB]"
                    }`}
                    aria-hidden
                  >
                    {done ? <Check className="h-4 w-4" strokeWidth={3} /> : current ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                  </span>
                  <span className={`text-[15px] ${current ? "font-bold text-[#262626]" : done ? "font-semibold text-[#262626]" : "text-[#8C8379]"}`}>{t.label}</span>
                </li>
              );
            })}
          </ol>

          {/* Delivery details */}
          <dl className="tick mt-4 space-y-2 rounded-2xl bg-[#FBF7F1] p-4 text-[15px] text-[#5F5850] ring-1 ring-[#EFE6DA]" style={{ animationDelay: "1s" }}>
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <dd className="min-w-0 break-words">{summary.address}</dd>
            </div>
            <div className="flex items-center gap-2.5">
              <Wallet className="h-4 w-4 shrink-0" aria-hidden />
              <dd>{summary.payment} · <span className="font-semibold text-[#262626]">{money(summary.total)}</span></dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="tick mt-5 h-12 w-full rounded-2xl bg-[#262626] text-base font-semibold text-white transition-colors hover:bg-[#3A3A3A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E8590C]/35"
            style={{ animationDelay: "1.1s" }}
          >
            Back to menu
          </button>
          {TRACKING_IS_DEMO && !live && <p className="mt-3 text-center text-xs text-[#8C8379]">Tracking is a preview: the rider and status updates are simulated.</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Account menu, My orders and Profile ---------- */

type Profile = {
  user_id: number;
  username: string;
  email?: string | null;
  user_role?: string | null;
  customer_id?: number | null;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
};
type MyOrder = {
  order_id: number;
  order_date: string;
  total_amount: number | string;
  order_status: string;
  delivery_address?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  item_count: number | string;
};

// "Pending orders" means any order that hasn't been delivered or cancelled yet
const isActive = (status: string) => status !== "Delivered" && status !== "Cancelled";
// Where an order's status sits on the tracking steps
const STATUS_STEP: Record<string, number> = { Pending: 0, Preparing: 1, "Out for delivery": 3, Delivered: 4 };
const STATUS_BADGE: Record<string, string> = {
  Pending: "bg-[#EFE8DE] text-[#5F5850]",
  Preparing: "bg-[#FFF1D6] text-[#8A5A00]",
  "Out for delivery": "bg-[#262626] text-white",
  Delivered: "bg-[#EAF6EE] text-[#1E6B41]",
  Cancelled: "bg-[#FDEDEA] text-[#9B2C1F]",
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C] focus-visible:ring-offset-2";
const fieldClass = (bad: boolean) =>
  `h-12 w-full rounded-2xl border bg-[#FCFBF9] px-4 text-base text-[#262626] placeholder:text-[#8C8379] outline-none transition-[border-color,box-shadow,background-color] focus-visible:bg-white focus-visible:ring-4 ${
    bad
      ? "border-[#E5675A] focus-visible:border-[#E5675A] focus-visible:ring-[#E5675A]/25"
      : "border-[#A39888] hover:border-[#857A6D] focus-visible:border-[#E8590C] focus-visible:ring-[#E8590C]/20"
  }`;

function Drawer({ title, onClose, escapeCloses = true, children }: { title: string; onClose: () => void; escapeCloses?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!escapeCloses) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, escapeCloses]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="fade-in absolute inset-0 bg-[#262626]/45" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-30px_0_60px_-30px_rgba(60,40,20,0.4)]"
      >
        <div className="flex items-center justify-between border-b border-[#EFE6DA] px-6 py-5">
          <h2 className={`${display.className} text-2xl font-extrabold tracking-tight`}>{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} className={`grid h-10 w-10 place-items-center rounded-xl text-[#5F5850] hover:bg-[#EFE8DE] hover:text-[#262626] ${focusRing}`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#F5B5AB] bg-[#FDEDEA] p-4 text-[15px] leading-snug text-[#9B2C1F]">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      <button type="button" onClick={onRetry} className={`flex items-center gap-1.5 rounded-lg font-semibold underline underline-offset-4 ${focusRing}`}>
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

function OrdersPanel({
  orders,
  loading,
  error,
  onRefresh,
  onTrack,
  onBrowse,
}: {
  orders: MyOrder[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onTrack: (o: MyOrder) => void;
  onBrowse: () => void;
}) {
  const [tab, setTab] = useState<"active" | "all">("active");
  const activeCount = orders.filter((o) => isActive(o.order_status)).length;
  const list = tab === "active" ? orders.filter((o) => isActive(o.order_status)) : orders;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Which orders to show">
          {([["active", `Pending (${activeCount})`], ["all", `All (${orders.length})`]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={`h-10 rounded-full px-4 text-[15px] font-semibold transition-colors ${focusRing} ${
                tab === k ? "bg-[#262626] text-white" : "bg-white text-[#262626] ring-1 ring-[#DDD2C4] hover:bg-[#EFE8DE]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh orders" className={`grid h-10 w-10 place-items-center rounded-xl text-[#5F5850] hover:bg-[#EFE8DE] disabled:opacity-60 ${focusRing}`}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-5">
        {error ? (
          <ErrorBox message={error} onRetry={onRefresh} />
        ) : loading && orders.length === 0 ? (
          <ul className="space-y-3" aria-busy="true" aria-label="Loading your orders">
            {[0, 1].map((i) => (
              <li key={i} className="h-32 animate-pulse rounded-2xl bg-[#FBF7F1] ring-1 ring-[#EFE6DA] motion-reduce:animate-none" />
            ))}
          </ul>
        ) : list.length === 0 ? (
          <div className="rounded-2xl bg-[#FBF7F1] px-5 py-12 text-center ring-1 ring-[#EFE6DA]">
            <div className="mx-auto w-20">
              <RamenIcon className={ic} />
            </div>
            <p className={`${display.className} mt-4 text-xl font-extrabold tracking-tight`}>{tab === "active" ? "No pending orders" : "No orders yet"}</p>
            <p className="mt-1 text-[15px] text-[#5F5850]">{tab === "active" ? "Everything you ordered has arrived." : "Your orders will show up here."}</p>
            <button type="button" onClick={onBrowse} className={`mt-5 h-10 rounded-xl bg-[#262626] px-5 text-[15px] font-semibold text-white hover:bg-[#3A3A3A] ${focusRing}`}>
              Browse the menu
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((o) => {
              const items = Number(o.item_count);
              return (
                <li key={o.order_id} className="rounded-2xl bg-[#FBF7F1] p-4 ring-1 ring-[#EFE6DA]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2">
                        <span className="rounded-full bg-[#F1E7DA] px-2.5 py-1 text-sm font-semibold tabular-nums">#{o.order_id}</span>
                        <span className={`${display.className} text-lg font-extrabold tabular-nums`}>{money(Number(o.total_amount))}</span>
                      </p>
                      <p className="mt-1 text-sm text-[#5F5850]">
                        {new Date(o.order_date).toLocaleString()} · {items} {items === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${STATUS_BADGE[o.order_status] ?? STATUS_BADGE.Pending}`}>{o.order_status}</span>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-sm text-[#5F5850]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{o.delivery_address || "No address"}</span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-[#5F5850]">
                    <Wallet className="h-4 w-4 shrink-0" aria-hidden />
                    {o.payment_method} · {o.payment_status}
                  </p>
                  {isActive(o.order_status) && o.order_status in STATUS_STEP && (
                    <button type="button" onClick={() => onTrack(o)} className={`mt-4 h-10 w-full rounded-xl bg-[#262626] text-[15px] font-semibold text-white transition-colors hover:bg-[#3A3A3A] ${focusRing}`}>
                      Track order
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProfilePanel({
  profile,
  loading,
  error,
  onRetry,
  onSave,
}: {
  profile: Profile | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSave: (v: { name: string; phone: string; address: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState("");
  const [badName, setBadName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setName(profile?.name ?? "");
    setPhone(profile?.phone ?? "");
    setAddr(profile?.address ?? "");
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!name.trim()) {
      setBadName(true);
      setErr("Enter your name so we know who the order is for.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), phone: phone.trim(), address: addr.trim() });
      setMsg("Profile saved.");
    } catch (e: any) {
      setErr(e.message || "We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorBox message={error} onRetry={onRetry} />;
  if (loading && !profile) {
    return (
      <div className="animate-pulse space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading your profile">
        <div className="h-20 rounded-2xl bg-[#FBF7F1]" />
        <div className="h-12 rounded-2xl bg-[#FBF7F1]" />
        <div className="h-12 rounded-2xl bg-[#FBF7F1]" />
      </div>
    );
  }
  if (!profile) return null;

  const shownName = profile.name || profile.username;
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className={`${display.className} grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#262626] text-2xl font-extrabold text-white`} aria-hidden>
          {shownName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className={`${display.className} truncate text-xl font-extrabold tracking-tight`}>{shownName}</p>
          <p className="truncate text-[15px] text-[#5F5850]">@{profile.username}</p>
          {profile.user_role && <span className="mt-1 inline-block rounded-full bg-[#F1E7DA] px-2.5 py-0.5 text-xs font-semibold">{profile.user_role}</span>}
        </div>
      </div>

      <dl className="mt-5 space-y-2 rounded-2xl bg-[#FBF7F1] p-4 text-[15px] ring-1 ring-[#EFE6DA]">
        <div className="flex items-center gap-2.5">
          <UserRound className="h-4 w-4 shrink-0 text-[#5F5850]" aria-hidden />
          <dt className="sr-only">Username</dt>
          <dd>{profile.username}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Mail className="h-4 w-4 shrink-0 text-[#5F5850]" aria-hidden />
          <dt className="sr-only">Email</dt>
          <dd className={profile.email ? "" : "text-[#8C8379]"}>{profile.email || "No email added"}</dd>
        </div>
      </dl>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <h3 className={`${display.className} text-lg font-extrabold tracking-tight`}>Your details</h3>
        {err && (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-[#F5B5AB] bg-[#FDEDEA] p-3.5 text-sm leading-snug text-[#9B2C1F]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {err}
          </div>
        )}
        {msg && (
          <div role="status" className="flex items-center gap-2.5 rounded-2xl border border-[#BFE3CC] bg-[#EAF6EE] p-3.5 text-sm text-[#1E6B41]">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#2E8B57] text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            {msg}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="profile-name" className="text-sm font-semibold">Full name</label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setBadName(false);
            }}
            aria-invalid={badName}
            placeholder="e.g. Juan Dela Cruz"
            autoComplete="name"
            className={fieldClass(badName)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-phone" className="flex items-center gap-1.5 text-sm font-semibold">
            <Phone className="h-3.5 w-3.5" aria-hidden /> Phone
          </label>
          <input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0917 123 4567" autoComplete="tel" className={fieldClass(false)} />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-address" className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Default delivery address
          </label>
          <textarea
            id="profile-address"
            rows={3}
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="House no., street, barangay, city"
            autoComplete="street-address"
            className={`${fieldClass(false)} !h-auto resize-none py-3`}
          />
          <p className="text-sm text-[#5F5850]">We fill this in at checkout so you don&rsquo;t have to type it each time.</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#E8590C] text-base font-semibold text-[#2A1206] shadow-[0_14px_28px_-12px_rgba(232,89,12,0.8)] transition-colors hover:bg-[#F2701F] disabled:opacity-80 ${focusRing}`}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save profile"
          )}
        </button>
      </form>
    </div>
  );
}

/* ---------- Add / edit a food item (POST and PUT) ---------- */

type Opt = { id: number; name: string };

// A small "add a new category / restaurant" helper so the form is never stuck with an empty dropdown
function QuickAdd({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    if (!name.trim()) {
      setErr("Type a name first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onAdd(name.trim());
      setName("");
      setOpen(false);
    } catch (e: any) {
      setErr(e.message || "We couldn't add that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`rounded text-sm font-semibold underline underline-offset-4 hover:text-[#B54708] ${focusRing}`}>
        + {label}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // don't submit the whole form
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          autoFocus
          className={`${fieldClass(false)} !h-10 !rounded-xl !text-[15px]`}
        />
        <button type="button" onClick={add} disabled={busy} className={`h-10 shrink-0 rounded-xl bg-[#262626] px-4 text-[15px] font-semibold text-white hover:bg-[#3A3A3A] disabled:opacity-60 ${focusRing}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#5F5850] hover:bg-[#EFE8DE] ${focusRing}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
      {err && <p className="text-sm text-[#9B2C1F]">{err}</p>}
    </div>
  );
}

function FoodFormPanel({
  item,
  categories,
  restaurants,
  onAddCategory,
  onAddRestaurant,
  onDone,
}: {
  item: Item | null; // null = create, otherwise edit
  categories: Opt[];
  restaurants: Opt[];
  onAddCategory: (name: string) => Promise<number>;
  onAddRestaurant: (name: string) => Promise<number>;
  onDone: (message: string) => void;
}) {
  const editing = item !== null;
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [categoryId, setCategoryId] = useState(item?.categoryId != null ? String(item.categoryId) : "");
  const [restaurantId, setRestaurantId] = useState(item?.restaurantId != null ? String(item.restaurantId) : "");
  const [available, setAvailable] = useState(item ? item.available : true);
  const [bad, setBad] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const clear = (k: string) => setBad((b) => b.filter((x) => x !== k));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    const problems: string[] = [];
    if (!name.trim()) problems.push("name");
    if (price.trim() === "" || !Number.isFinite(Number(price)) || Number(price) < 0) problems.push("price");
    if (!categoryId) problems.push("category");
    if (!restaurantId) problems.push("restaurant");
    if (problems.length) {
      setBad(problems);
      setErr(problems.length === 1 ? `Check the ${problems[0]} field.` : "Check the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const body = JSON.stringify({
        food_name: name.trim(),
        price: Number(price),
        category_id: Number(categoryId),
        restaurant_id: Number(restaurantId),
        availability: available,
      });
      if (editing) {
        await apiClient(`${API.menu}/${item!.rawId}`, { method: "PUT", requiresAuth: true, body }); // PUT = update
      } else {
        await apiClient(API.menu, { method: "POST", requiresAuth: true, body }); // POST = create
      }
      onDone(editing ? `${name.trim()} was updated.` : `${name.trim()} was added to the menu.`);
    } catch (e: any) {
      setErr(e.message || "We couldn't save that. Please try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="text-[15px] text-[#5F5850]">{editing ? "Change the details below and save." : "Fill in the details to add a dish to the menu."}</p>

      {err && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-[#F5B5AB] bg-[#FDEDEA] p-3.5 text-sm leading-snug text-[#9B2C1F]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {err}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="food-name" className="text-sm font-semibold">Food name</label>
        <input
          id="food-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clear("name");
          }}
          placeholder="e.g. Smash Burger"
          aria-invalid={bad.includes("name")}
          autoFocus
          className={fieldClass(bad.includes("name"))}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="food-price" className="text-sm font-semibold">Price (PHP)</label>
        <input
          id="food-price"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            clear("price");
          }}
          placeholder="e.g. 149"
          aria-invalid={bad.includes("price")}
          className={fieldClass(bad.includes("price"))}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="food-category" className="text-sm font-semibold">Category</label>
        <select
          id="food-category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            clear("category");
          }}
          aria-invalid={bad.includes("category")}
          className={fieldClass(bad.includes("category"))}
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <QuickAdd
          label="Add a new category"
          placeholder="e.g. Desserts"
          onAdd={async (n) => {
            setCategoryId(String(await onAddCategory(n)));
            clear("category");
          }}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="food-restaurant" className="text-sm font-semibold">Restaurant</label>
        <select
          id="food-restaurant"
          value={restaurantId}
          onChange={(e) => {
            setRestaurantId(e.target.value);
            clear("restaurant");
          }}
          aria-invalid={bad.includes("restaurant")}
          className={fieldClass(bad.includes("restaurant"))}
        >
          <option value="">Select a restaurant</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <QuickAdd
          label="Add a new restaurant"
          placeholder="e.g. Burger Hub"
          onAdd={async (n) => {
            setRestaurantId(String(await onAddRestaurant(n)));
            clear("restaurant");
          }}
        />
      </div>

      <div className="space-y-2">
        <span id="food-available-label" className="text-sm font-semibold">Availability</span>
        <button
          type="button"
          role="switch"
          aria-checked={available}
          aria-labelledby="food-available-label"
          onClick={() => setAvailable((v) => !v)}
          className={`flex h-12 w-full items-center justify-between rounded-2xl border border-[#A39888] bg-[#FCFBF9] px-4 text-base transition-colors hover:border-[#857A6D] ${focusRing}`}
        >
          <span>{available ? "Available to order" : "Sold out"}</span>
          <span className={`relative h-6 w-11 rounded-full transition-colors ${available ? "bg-[#262626]" : "bg-[#D9CFC2]"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${available ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>
      </div>

      <button
        type="submit"
        disabled={saving}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#E8590C] text-base font-semibold text-[#2A1206] shadow-[0_14px_28px_-12px_rgba(232,89,12,0.8)] transition-colors hover:bg-[#F2701F] disabled:opacity-80 ${focusRing}`}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : editing ? (
          "Save changes"
        ) : (
          "Add to menu"
        )}
      </button>
    </form>
  );
}

/* ---------- Page ---------- */

export default function DashboardPage() {
  const router = useRouter();
  const { isChecking } = useAuthGuard({ requireAuth: true });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [greeting, setGreeting] = useState("Welcome back");
  const [menu, setMenu] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "sample">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [addressBad, setAddressBad] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Account menu, profile and the user's own orders
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<"orders" | "profile" | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [tracking, setTracking] = useState<MyOrder | null>(null);

  // Menu editing (POST / PUT / DELETE)
  const [foodForm, setFoodForm] = useState<{ item: Item | null } | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [catOptions, setCatOptions] = useState<Opt[]>([]);
  const [restOptions, setRestOptions] = useState<Opt[]>([]);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const data = await apiClient<Profile>(API.profile, { method: "GET", requiresAuth: true });
      setProfile(data);
      setAddress((a) => a || data.address || ""); // fill the checkout address from the profile
    } catch (err: any) {
      setProfileError(err.message || "We couldn't load your profile.");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const data = await apiClient<MyOrder[]>(API.orders, { method: "GET", requiresAuth: true });
      setMyOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setOrdersError(err.message || "We couldn't load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isChecking) return;
    loadProfile();
    loadOrders();
  }, [isChecking, loadProfile, loadOrders]);

  // Close the account menu on an outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Load food items and categories from your backend once the session is verified
  useEffect(() => {
    if (isChecking) return;
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      apiClient<unknown>(API.foodItems, { method: "GET", requiresAuth: true }),
      apiClient<unknown>(API.categories, { method: "GET", requiresAuth: true }).catch(() => []), // categories are optional
      apiClient<unknown>(API.restaurants, { method: "GET", requiresAuth: true }).catch(() => []), // only needed for the edit form
    ])
      .then(([foods, cats, rests]) => {
        if (cancelled) return;
        const { items, categories } = normalizeMenu(toList(foods), toList(cats));
        const options = (rows: Raw[], idKeys: string[], nameKeys: string[]): Opt[] =>
          rows
            .map((r) => ({ id: Number(pick(r, idKeys)), name: String(pick(r, nameKeys) ?? "") }))
            .filter((o) => Number.isFinite(o.id) && o.name);
        setCatOptions(options(toList(cats), ["category_id", "id"], ["category_name", "name"]));
        setRestOptions(options(toList(rests), ["restaurant_id", "id"], ["restaurant_name", "name"]));
        setMenu(items);
        setCategories(categories);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setMenu(SAMPLE_MENU);
        setCategories(Array.from(new Set(SAMPLE_MENU.map((m) => m.category))));
        setStatus("sample");
      });
    return () => {
      cancelled = true;
    };
  }, [isChecking, reloadKey]);

  // Menu messages fade away on their own
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // Time-based greeting, set after mount so it never mismatches the server render
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  // Close the mobile cart with Escape
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.filter(
      (m) => (category === "All" || m.category === category) && (!q || `${m.name} ${m.desc}`.toLowerCase().includes(q)),
    );
  }, [menu, category, query]);

  const lines: Line[] = menu.filter((m) => cart[m.id]).map((m) => ({ ...m, qty: cart[m.id] }));
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const total = subtotal + (count ? DELIVERY_FEE : 0);

  if (isChecking) {
    return (
      <div className={`${body.className} flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F8F8] text-[#262626]`}>
        <style>{`@keyframes bob { 50% { transform: translateY(-10px) rotate(4deg); } } .bob { animation: bob 1.6s ease-in-out infinite; } @media (prefers-reduced-motion: reduce) { .bob { animation: none; } }`}</style>
        <div className="bob w-16">
          <DonutIcon className={ic} />
        </div>
        <p className="text-[15px] text-[#5F5850]">Verifying session...</p>
      </div>
    );
  }

  const change = (id: string, delta: number) => {
    setPlaced(false);
    setCart((c) => {
      const next = (c[id] ?? 0) + delta;
      const { [id]: _, ...rest } = c;
      return next > 0 ? { ...rest, [id]: next } : rest;
    });
    const item = menu.find((m) => m.id === id);
    if (item) setAnnounce(delta > 0 ? `Added ${item.name} to your order` : `Removed ${item.name} from your order`);
  };

  // Capture what was ordered, then clear the cart and play the celebration
  const finishOrder = () => {
    setSummary({ count, total, payment, address: address.trim() });
    setPlaced(true);
    setCart({});
    loadOrders();
  };

  const closeSuccess = () => {
    setSummary(null);
    setPlaced(false);
    setCartOpen(false);
  };

  const handlePlaceOrder = async () => {
    setOrderError("");

    // delivery.delivery_address is required, so ask for it before sending anything
    if (!address.trim()) {
      setAddressBad(true);
      setOrderError("Add a delivery address so we know where to bring your order.");
      return;
    }

    // The sample menu has no real items behind it, so there is nothing to send
    if (status === "sample") {
      finishOrder();
      return;
    }

    setPlacing(true);
    try {
      // One request; your server should create the orders, order_item, payment and
      // delivery rows together (in a transaction) and take customer_id from the logged-in user.
      // It should also recompute prices from food_item instead of trusting these numbers.
      await apiClient(API.orders, {
        method: "POST",
        requiresAuth: true,
        body: JSON.stringify({
          items: lines.map((l) => ({ food_id: l.rawId, quantity: l.qty, subtotal: l.price * l.qty })),
          total_amount: total,
          payment_method: payment,
          delivery_address: address.trim(),
        }),
      });
      finishOrder();
    } catch (err: any) {
      setOrderError(err.message || "We couldn't place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const pendingCount = myOrders.filter((o) => isActive(o.order_status)).length;
  const displayName = profile?.name || profile?.username || "Account";

  // Only a loaded menu can be edited (the sample menu has nothing behind it)
  const canEdit = status === "ready" && (!ONLY_ADMINS_CAN_EDIT_MENU || profile?.user_role?.toLowerCase() === "admin");

  const foodSaved = (message: string) => {
    setFoodForm(null);
    setNotice({ kind: "success", text: message });
    setReloadKey((k) => k + 1); // reload the menu so the change shows up
  };

  // DELETE
  const deleteFood = async (item: Item) => {
    if (!window.confirm(`Delete "${item.name}" from the menu?`)) return;
    try {
      await apiClient(`${API.menu}/${item.rawId}`, { method: "DELETE", requiresAuth: true });
      setCart((c) => {
        const { [item.id]: _removed, ...rest } = c;
        return rest;
      });
      setNotice({ kind: "success", text: `${item.name} was deleted.` });
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      setNotice({ kind: "error", text: err.message || "We couldn't delete that item. Please try again." });
    }
  };

  // POST a new category or restaurant straight from the form, then pick it
  const addCategory = async (name: string) => {
    const c = await apiClient<{ category_id: number; category_name: string }>(API.categories, {
      method: "POST",
      requiresAuth: true,
      body: JSON.stringify({ category_name: name }),
    });
    setCatOptions((o) => [...o, { id: c.category_id, name: c.category_name }]);
    return c.category_id;
  };
  const addRestaurant = async (name: string) => {
    const r = await apiClient<{ restaurant_id: number; restaurant_name: string }>(API.restaurants, {
      method: "POST",
      requiresAuth: true,
      body: JSON.stringify({ restaurant_name: name }),
    });
    setRestOptions((o) => [...o, { id: r.restaurant_id, name: r.restaurant_name }]);
    return r.restaurant_id;
  };

  const openPanel = (kind: "orders" | "profile") => {
    setMenuOpen(false);
    setPanel(kind);
    if (kind === "orders") loadOrders();
    else if (!profile) loadProfile();
  };

  const saveProfile = async (v: { name: string; phone: string; address: string }) => {
    const data = await apiClient<Profile>(API.profile, { method: "PUT", requiresAuth: true, body: JSON.stringify(v) });
    setProfile(data);
    setAddress((a) => data.address || a);
  };

  const handleLogout = () => {
    clearTokens();
    router.push(CONFIG.ROUTES.LOGIN);
  };

  const panelProps = {
    lines,
    subtotal,
    placed,
    placing,
    orderError,
    address,
    payment,
    addressBad,
    onAddress: (v: string) => {
      setAddress(v);
      setAddressBad(false);
    },
    onPayment: setPayment,
    onInc: (id: string) => change(id, 1),
    onDec: (id: string) => change(id, -1),
    onPlace: handlePlaceOrder,
    onReset: () => setPlaced(false),
  };

  return (
    <div className={`${body.className} min-h-screen bg-[#F8F8F8] text-[#262626]`}>
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(20px); } }
        .rise { animation: rise .6s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes bob { 0%, 100% { transform: translateY(0) rotate(var(--r)); } 50% { transform: translateY(-10px) rotate(calc(var(--r) + 3deg)); } }
        .bob { animation: bob var(--dur, 8s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
        @keyframes check-pop { from { transform: scale(0) rotate(-30deg); } 60% { transform: scale(1.2); } }
        .check-pop { animation: check-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes sheet { from { transform: translateY(100%); } }
        .sheet { animation: sheet .35s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes fade-in { from { opacity: 0; } }
        .fade-in { animation: fade-in .25s ease-out both; }
        @keyframes pop { from { opacity: 0; transform: scale(.4) translateY(20px); } }
        .pop { animation: pop .7s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes card-in { from { opacity: 0; transform: translateY(28px) scale(.94); } }
        .card-in { animation: card-in .5s cubic-bezier(.2,.9,.3,1.15) both; }
        @keyframes tick { from { opacity: 0; transform: translateY(10px); } }
        .tick { animation: tick .45s ease-out both; }
        @keyframes badge-pop { from { transform: scale(0); } 60% { transform: scale(1.15); } }
        .badge-pop { animation: badge-pop .55s cubic-bezier(.34,1.56,.64,1) .1s both; }
        @keyframes draw { to { stroke-dashoffset: 0; } }
        .draw { stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw .45s ease-out .4s forwards; }
        @keyframes ring-out { from { transform: scale(1); opacity: .7; } to { transform: scale(2.3); opacity: 0; } }
        .ring-out { animation: ring-out 1.3s ease-out .3s 2 both; }
        @keyframes confetti {
          0%   { transform: translate(0, 0) rotate(0) scale(.4); opacity: 0; }
          12%  { opacity: 1; }
          45%  { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--rot) * .6)) scale(1); opacity: 1; }
          100% { transform: translate(calc(var(--dx) * 1.15), calc(var(--dy) + 190px)) rotate(var(--rot)) scale(1); opacity: 0; }
        }
        .confetti { opacity: 0; animation: confetti 1.9s cubic-bezier(.2,.7,.3,1) both; }
        @keyframes drawer-in { from { transform: translateX(100%); } }
        .drawer { animation: drawer-in .35s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .wheel { transform-box: fill-box; transform-origin: center; }
        .spin { animation: spin .45s linear infinite; }
        @keyframes road { to { background-position-x: -28px; } }
        .road-move { animation: road .35s linear infinite; }
        @keyframes speed { from { opacity: 0; transform: translateX(10px); } 40% { opacity: .8; } to { opacity: 0; transform: translateX(-14px); } }
        .speed { animation: speed .6s ease-out infinite; }
        @keyframes ride-in { from { opacity: 0; transform: translateX(-140px); } }
        .ride-in { animation: ride-in 1s cubic-bezier(.2,.8,.2,1) .6s both; }
        @keyframes pulse-ring { from { box-shadow: 0 0 0 0 rgba(38,38,38,.35); } to { box-shadow: 0 0 0 10px rgba(38,38,38,0); } }
        .pulse-ring { animation: pulse-ring 1.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .spin, .road-move, .speed, .ride-in, .pulse-ring, .drawer { animation: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rise, .bob, .check-pop, .sheet, .fade-in, .pop, .card-in, .tick, .badge-pop, .ring-out { animation: none; }
          .bob { transform: rotate(var(--r)); }
          .draw { animation: none; stroke-dashoffset: 0; }
          .confetti { display: none; }
        }
      `}</style>

      <p className="sr-only" aria-live="polite">{announce}</p>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#EFE6DA] bg-[#F8F8F8]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-8">
          <div className={`${display.className} flex shrink-0 items-center gap-2.5 text-lg font-extrabold tracking-tight`}>
            <DonutIcon size={30} />
            <span className="hidden sm:inline">{BRAND}</span>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#7A7167]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu"
              aria-label="Search the menu"
              className="h-11 w-full rounded-2xl border border-[#A39888] bg-white pl-11 pr-4 text-base text-[#262626] placeholder:text-[#8C8379] transition-[border-color,box-shadow] hover:border-[#857A6D] focus-visible:border-[#E8590C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E8590C]/20"
            />
          </div>

          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="account-menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 items-center gap-2 rounded-2xl bg-white pl-1.5 pr-3 ring-1 ring-[#DDD2C4] transition-colors hover:bg-[#EFE8DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
            >
              <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#262626] text-sm font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
                {pendingCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-[#262626] ring-2 ring-[#262626]">
                    {pendingCount}
                  </span>
                )}
              </span>
              <span className="hidden max-w-[8rem] truncate text-[15px] font-semibold sm:inline">{displayName}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} aria-hidden />
              <span className="sr-only">Account menu{pendingCount > 0 ? `, ${pendingCount} pending ${pendingCount === 1 ? "order" : "orders"}` : ""}</span>
            </button>

            {menuOpen && (
              <div id="account-menu" className="fade-in absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl bg-white p-2 shadow-[0_30px_60px_-24px_rgba(60,40,20,0.45)] ring-1 ring-[#EFE6DA]">
                <div className="px-3 py-2.5">
                  <p className="truncate font-semibold">{displayName}</p>
                  {profile && <p className="truncate text-sm text-[#5F5850]">@{profile.username}</p>}
                </div>
                <div className="my-1 h-px bg-[#EFE6DA]" />
                <button type="button" onClick={() => openPanel("orders")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold hover:bg-[#EFE8DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]">
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  My orders
                  {pendingCount > 0 && <span className="ml-auto rounded-full bg-[#FFF1D6] px-2 py-0.5 text-xs font-bold text-[#8A5A00]">{pendingCount} pending</span>}
                </button>
                <button type="button" onClick={() => openPanel("profile")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold hover:bg-[#EFE8DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]">
                  <UserRound className="h-4 w-4" aria-hidden />
                  Profile
                </button>
                <div className="my-1 h-px bg-[#EFE6DA]" />
                <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold hover:bg-[#EFE8DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]">
                  <LogOut className="h-4 w-4" aria-hidden />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-28 pt-6 sm:px-8 lg:grid-cols-[1fr_23rem] lg:pb-10">
        <main>
          {/* Hero */}
          <section className="rise relative overflow-hidden rounded-[32px] bg-[#F1E7DA] p-7 sm:p-10">
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#FFD9B3]/70 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-[#D9C6AE]/70 blur-3xl" aria-hidden />
            <div className="relative max-w-md">
              <p className="text-[15px] font-semibold text-[#5F5850]">{greeting}</p>
              <h1 className={`${display.className} mt-2 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl`}>
                What are you craving?
              </h1>
              <p className="mt-3 text-base text-[#5F5850]">Pick your favorites and we&rsquo;ll get them to you hot.</p>
            </div>
            <div className="pointer-events-none absolute -right-2 top-1/2 hidden w-[44%] max-w-[22rem] -translate-y-1/2 sm:block" aria-hidden>
              <div className="relative aspect-[5/4]">
                <div className="bob absolute left-[22%] top-[6%] w-[52%]" style={{ "--r": "6deg", "--dur": "8s" } as React.CSSProperties}>
                  <BurgerIcon className={ic} />
                </div>
                <div className="bob absolute left-0 top-[48%] w-[36%]" style={{ "--r": "-12deg", "--dur": "9s", "--delay": "-2s" } as React.CSSProperties}>
                  <PizzaIcon className={ic} />
                </div>
                <div className="bob absolute right-0 top-[52%] w-[26%]" style={{ "--r": "14deg", "--dur": "7s", "--delay": "-4s" } as React.CSSProperties}>
                  <DonutIcon className={ic} />
                </div>
              </div>
            </div>
          </section>

          {status === "sample" && (
            <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E9D5B5] bg-[#FFF6E5] p-4 text-sm text-[#6B4300]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="min-w-0 flex-1">
                We couldn&rsquo;t load your menu from the server, so this is a sample menu. Orders aren&rsquo;t sent while it&rsquo;s showing.
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="flex items-center gap-1.5 rounded-lg font-semibold underline underline-offset-4 hover:text-[#262626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          )}

          {notice && (
            <div
              role={notice.kind === "error" ? "alert" : "status"}
              className={`mt-6 flex items-center gap-2.5 rounded-2xl border p-4 text-[15px] ${
                notice.kind === "error" ? "border-[#F5B5AB] bg-[#FDEDEA] text-[#9B2C1F]" : "border-[#BFE3CC] bg-[#EAF6EE] text-[#1E6B41]"
              }`}
            >
              {notice.kind === "error" ? (
                <AlertCircle className="h-5 w-5 shrink-0" />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2E8B57] text-white">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
              <p className="min-w-0 flex-1">{notice.text}</p>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="rounded-lg p-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Categories */}
          <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
            {["All", ...categories].map((c) => {
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={`h-10 rounded-full px-5 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C] focus-visible:ring-offset-2 ${
                    on ? "bg-[#262626] text-white" : "bg-white text-[#262626] ring-1 ring-[#DDD2C4] hover:bg-[#EFE8DE]"
                  }`}
                >
                  {c}
                </button>
              );
            })}
            {canEdit && (
              <button
                type="button"
                onClick={() => setFoodForm({ item: null })}
                className="ml-auto flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-[#262626] ring-1 ring-[#DDD2C4] transition-colors hover:bg-[#EFE8DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
              >
                <Plus className="h-4 w-4" />
                Add food item
              </button>
            )}
          </div>

          {/* Menu */}
          {status === "loading" ? (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading the menu">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="animate-pulse rounded-3xl bg-white p-4 ring-1 ring-[#EFE6DA] motion-reduce:animate-none">
                  <div className="aspect-[4/3] rounded-2xl bg-[#EFE8DE]" />
                  <div className="mt-4 h-5 w-2/3 rounded bg-[#EFE8DE]" />
                  <div className="mt-2 h-4 w-full rounded bg-[#F3EDE4]" />
                  <div className="mt-4 h-10 rounded-xl bg-[#EFE8DE]" />
                </li>
              ))}
            </ul>
          ) : visible.length === 0 ? (
            <div className="mt-10 rounded-3xl bg-white p-10 text-center ring-1 ring-[#EFE6DA]">
              <p className={`${display.className} text-xl font-extrabold tracking-tight`}>{menu.length === 0 ? "No dishes yet" : "Nothing matches that"}</p>
              <p className="mt-1 text-[15px] text-[#5F5850]">
                {menu.length === 0
                  ? canEdit
                    ? "Add your first food item to get started."
                    : "Check back soon, the menu is being updated."
                  : "Try a different word or pick another category."}
              </p>
              {menu.length === 0 && canEdit && (
                <button
                  type="button"
                  onClick={() => setFoodForm({ item: null })}
                  className="mx-auto mt-5 flex h-10 items-center gap-2 rounded-xl bg-[#262626] px-5 text-[15px] font-semibold text-white hover:bg-[#3A3A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C] focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  Add a food item
                </button>
              )}
            </div>
          ) : (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((m, i) => {
                const qty = cart[m.id] ?? 0;
                return (
                  <li
                    key={m.id}
                    className="rise group flex flex-col rounded-3xl bg-white p-4 shadow-[0_24px_50px_-34px_rgba(60,40,20,0.45)] ring-1 ring-[#EFE6DA] transition-transform hover:-translate-y-1"
                    style={{ animationDelay: `${0.1 + i * 0.06}s` }}
                  >
                    <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#FBF7F1,#EADFD2_90%)]">
                      <div className="absolute h-[70%] w-[55%] rounded-full bg-[#FFE3C2]/70 blur-2xl" aria-hidden />
                      <div
                        className="relative w-[46%] transition-transform duration-300 group-hover:scale-110"
                        style={{ transform: `rotate(${m.tilt}deg)` }}
                      >
                        <m.Icon className={ic} />
                      </div>
                      <span className="absolute left-3 top-3 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#5F5850] ring-1 ring-white">
                        {m.category}
                      </span>
                      {canEdit && (
                        <div className="absolute right-3 top-3 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFoodForm({ item: m })}
                            aria-label={`Edit ${m.name}`}
                            className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#262626] ring-1 ring-white transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFood(m)}
                            aria-label={`Delete ${m.name}`}
                            className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#9B2C1F] ring-1 ring-white transition-colors hover:bg-[#FDEDEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex-1">
                      <h3 className={`${display.className} text-xl font-extrabold tracking-tight`}>{m.name}</h3>
                      <p className="mt-1 text-[15px] leading-snug text-[#5F5850]">{m.desc || (m.restaurant ? `From ${m.restaurant}` : "")}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className={`${display.className} text-xl font-extrabold tabular-nums`}>{money(m.price)}</span>
                      {!m.available ? (
                        <span className="rounded-xl bg-[#EFE8DE] px-4 py-2 text-[15px] font-semibold text-[#5F5850]">Sold out</span>
                      ) : qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => change(m.id, 1)}
                          aria-label={`Add ${m.name} to your order`}
                          className="flex h-10 items-center gap-1.5 rounded-xl bg-[#262626] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#3A3A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C] focus-visible:ring-offset-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 rounded-xl bg-[#F1E7DA] p-1">
                          <button
                            type="button"
                            onClick={() => change(m.id, -1)}
                            aria-label={`Remove one ${m.name}`}
                            className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-6 text-center text-[15px] font-bold tabular-nums">{qty}</span>
                          <button
                            type="button"
                            onClick={() => change(m.id, 1)}
                            aria-label={`Add one more ${m.name}`}
                            className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        {/* Desktop cart */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] min-h-[26rem] flex-col overflow-y-auto overscroll-contain rounded-[28px] bg-white p-6 shadow-[0_40px_80px_-40px_rgba(60,40,20,0.35)] ring-1 ring-[#EFE6DA]">
            <CartPanel {...panelProps} />
          </div>
        </aside>
      </div>

      {/* Mobile: bottom bar + cart sheet */}
      {(count > 0 || placed) && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 flex h-14 items-center justify-between rounded-2xl bg-[#262626] px-5 text-white shadow-[0_20px_40px_-14px_rgba(38,38,38,0.6)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E8590C]/40 lg:hidden"
        >
          <span className="flex items-center gap-2.5 font-semibold">
            <ShoppingBag className="h-5 w-5" />
            {placed ? "Order placed" : `View order · ${count} ${count === 1 ? "item" : "items"}`}
          </span>
          {!placed && <span className="font-bold tabular-nums">{money(total)}</span>}
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fade-in absolute inset-0 bg-[#262626]/45" onClick={() => setCartOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            className="sheet absolute inset-x-0 bottom-0 flex max-h-[88vh] min-h-[50vh] flex-col overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-[0_-30px_60px_-30px_rgba(60,40,20,0.4)]"
          >
            <CartPanel {...panelProps} onClose={() => setCartOpen(false)} />
          </div>
        </div>
      )}

      {foodForm && (
        <Drawer title={foodForm.item ? "Edit food item" : "Add food item"} onClose={() => setFoodForm(null)}>
          <FoodFormPanel
            key={foodForm.item ? String(foodForm.item.rawId) : "new"}
            item={foodForm.item}
            categories={catOptions}
            restaurants={restOptions}
            onAddCategory={addCategory}
            onAddRestaurant={addRestaurant}
            onDone={foodSaved}
          />
        </Drawer>
      )}
      {panel === "orders" && (
        <Drawer title="My orders" onClose={() => setPanel(null)} escapeCloses={!tracking}>
          <OrdersPanel orders={myOrders} loading={ordersLoading} error={ordersError} onRefresh={loadOrders} onTrack={setTracking} onBrowse={() => setPanel(null)} />
        </Drawer>
      )}
      {panel === "profile" && (
        <Drawer title="Profile" onClose={() => setPanel(null)}>
          <ProfilePanel profile={profile} loading={profileLoading} error={profileError} onRetry={loadProfile} onSave={saveProfile} />
        </Drawer>
      )}

      {tracking && (
        <SuccessOverlay
          summary={{
            count: Number(tracking.item_count),
            total: Number(tracking.total_amount),
            payment: tracking.payment_method ?? "",
            address: tracking.delivery_address ?? "",
          }}
          orderId={tracking.order_id}
          fixedStep={STATUS_STEP[tracking.order_status] ?? 0}
          startedAt={new Date(tracking.order_date)}
          onClose={() => setTracking(null)}
        />
      )}

      {summary && <SuccessOverlay summary={summary} onClose={closeSuccess} />}
    </div>
  );
}