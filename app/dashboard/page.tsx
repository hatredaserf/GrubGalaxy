"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { AlertCircle, Check, Loader2, LogOut, Minus, Plus, RefreshCw, Search, ShoppingBag, X } from "lucide-react";
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
const API = { foodItems: "/fooditems", categories: "/categories", orders: "/orders" };

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

/* ---------- Order success celebration ---------- */

type Summary = { count: number; total: number; payment: string };

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

function SuccessOverlay({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Foods that pop in around the card, then keep gently bobbing
  const around: [IconType, string, string, number, number][] = [
    [BurgerIcon, "-left-6 -top-8 w-16", "-14deg", 0.5, 6],
    [DonutIcon, "-right-5 -top-6 w-14", "16deg", 0.65, 7],
    [IceCreamIcon, "-bottom-6 -left-4 w-12", "10deg", 0.8, 8],
    [PizzaIcon, "-bottom-7 -right-5 w-16", "-12deg", 0.95, 6.5],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div className="fade-in absolute inset-0 bg-[#262626]/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
        className="card-in relative w-full max-w-sm rounded-[28px] bg-white px-7 pb-7 pt-12 text-center shadow-[0_50px_100px_-30px_rgba(60,40,20,0.55)] ring-1 ring-[#EFE6DA]"
      >
        {around.map(([Icon, pos, rot, delay, dur], i) => (
          <div key={i} className={`pointer-events-none absolute ${pos}`} aria-hidden>
            <div className="pop" style={{ animationDelay: `${delay}s` }}>
              <div className="bob" style={{ "--r": rot, "--dur": `${dur}s` } as React.CSSProperties}>
                <Icon className={ic} />
              </div>
            </div>
          </div>
        ))}

        {/* Check mark: ripples, a pop-in badge, a stroke that draws itself, and a confetti burst */}
        <div className="relative mx-auto grid h-20 w-20 place-items-center" aria-hidden>
          <span className="ring-out absolute inset-0 rounded-full border-2 border-[#2E8B57]/50" />
          <span className="ring-out absolute inset-0 rounded-full border-2 border-[#2E8B57]/30" style={{ animationDelay: "0.55s" }} />
          <svg viewBox="0 0 52 52" className="badge-pop h-20 w-20 drop-shadow-[0_14px_18px_rgba(46,139,87,0.45)]">
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

        <h2 id="success-title" className={`${display.className} tick mt-6 text-[2rem] font-extrabold leading-tight tracking-tight`} style={{ animationDelay: "0.5s" }}>
          Order placed!
        </h2>
        <p className="tick mt-2 text-base text-[#5F5850]" style={{ animationDelay: "0.6s" }}>
          Thanks for ordering. We&rsquo;ve got it from here.
        </p>

        <dl className="tick mt-6 space-y-2 rounded-2xl bg-[#FBF7F1] p-4 text-left text-[15px] ring-1 ring-[#EFE6DA]" style={{ animationDelay: "0.7s" }}>
          <div className="flex justify-between">
            <dt className="text-[#5F5850]">Items</dt>
            <dd className="font-semibold tabular-nums">{summary.count}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5F5850]">Payment</dt>
            <dd className="font-semibold">{summary.payment}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-[#EFE6DA] pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className={`${display.className} text-xl font-extrabold tabular-nums`}>{money(summary.total)}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="tick mt-6 h-12 w-full rounded-2xl bg-[#262626] text-base font-semibold text-white transition-colors hover:bg-[#3A3A3A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E8590C]/35"
          style={{ animationDelay: "0.8s" }}
        >
          Back to menu
        </button>
      </div>
    </div>
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

  // Load food items and categories from your backend once the session is verified
  useEffect(() => {
    if (isChecking) return;
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      apiClient<unknown>(API.foodItems),
      apiClient<unknown>(API.categories).catch(() => []), // categories are optional
    ])
      .then(([foods, cats]) => {
        if (cancelled) return;
        const { items, categories } = normalizeMenu(toList(foods), toList(cats));
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
    setSummary({ count, total, payment });
    setPlaced(true);
    setCart({});
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

          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="h-11 shrink-0 gap-2 rounded-xl border-[#A39888] bg-white px-4 font-semibold text-[#262626] hover:bg-[#EFE8DE] focus-visible:ring-2 focus-visible:ring-[#E8590C]"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
            <span className="sr-only sm:hidden">Log out</span>
          </Button>
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
                {menu.length === 0 ? "Check back soon, the menu is being updated." : "Try a different word or pick another category."}
              </p>
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

      {summary && <SuccessOverlay summary={summary} onClose={closeSuccess} />}
    </div>
  );
}