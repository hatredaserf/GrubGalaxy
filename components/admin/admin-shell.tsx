"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { ArrowLeft, LogOut } from "lucide-react";
import { clearTokens } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { BurgerIcon, DonutIcon, PizzaIcon } from "@/components/food-icons";

export const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
export const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"] });

// Change this to your app's name
export const BRAND = "GrubGalaxy";

/*
  Palette (60 / 30 / 10), shared with the other GrubGalaxy pages
  Surfaces: off-white #F8F8F8, cream #F1E7DA, white cards | Text: charcoal #262626, warm gray #5F5850
  Accent: orange #E8590C for the main action only | Errors and delete: soft coral | Success: green #2E8B57
*/

type IconType = ComponentType<{ size?: number; className?: string }>;

export const ic = "block h-auto w-full drop-shadow-[0_14px_16px_rgba(60,40,20,0.28)]";
export const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C] focus-visible:ring-offset-2";
export const btn = `inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors disabled:opacity-60 ${focus}`;
export const btnOutline = `${btn} bg-white text-[#262626] ring-1 ring-[#DDD2C4] hover:bg-[#EFE8DE]`;
export const btnDark = `${btn} bg-[#262626] text-white hover:bg-[#3A3A3A]`;
export const btnPrimary = `${btn} bg-[#E8590C] text-[#2A1206] shadow-[0_10px_22px_-10px_rgba(232,89,12,0.7)] hover:bg-[#F2701F]`;
export const btnDanger = `${btn} bg-white text-[#9B2C1F] ring-1 ring-[#F5B5AB] hover:bg-[#FDEDEA]`;
export const small = "!h-9 !px-3 !text-sm";
export const card = "rise rounded-[28px] bg-white shadow-[0_30px_60px_-40px_rgba(60,40,20,0.35)] ring-1 ring-[#EFE6DA]";

export const inputClass = (bad: boolean) =>
  `h-[52px] w-full rounded-2xl border bg-[#FCFBF9] px-4 text-base text-[#262626] placeholder:text-[#8C8379] shadow-none outline-none transition-[border-color,box-shadow,background-color] focus-visible:bg-white focus-visible:ring-4 ${
    bad
      ? "border-[#E5675A] focus-visible:border-[#E5675A] focus-visible:ring-[#E5675A]/25"
      : "border-[#A39888] hover:border-[#857A6D] focus-visible:border-[#E8590C] focus-visible:ring-[#E8590C]/20"
  }`;

// Philippine peso, e.g. ₱149 or ₱149.50
export const money = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);

export const ADMIN_LINKS = [{ href: "/admin/orders", label: "Orders" }];

export function VerifyingScreen() {
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

export function AdminShell({
  title,
  subtitle,
  icons = [BurgerIcon, PizzaIcon],
  children,
}: {
  title: string;
  subtitle: string;
  icons?: [IconType, IconType];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [IconA, IconB] = icons;

  const handleLogout = () => {
    clearTokens();
    router.push(CONFIG.ROUTES.LOGIN);
  };

  return (
    <div className={`${body.className} min-h-screen bg-[#F8F8F8] text-[#262626]`}>
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(18px); } }
        .rise { animation: rise .55s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes bob { 0%, 100% { transform: translateY(0) rotate(var(--r)); } 50% { transform: translateY(-10px) rotate(calc(var(--r) + 3deg)); } }
        .bob { animation: bob var(--dur, 8s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
        @media (prefers-reduced-motion: reduce) { .rise, .bob { animation: none; } .bob { transform: rotate(var(--r)); } }
      `}</style>

      <header className="sticky top-0 z-30 border-b border-[#EFE6DA] bg-[#F8F8F8]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className={`${display.className} flex items-center gap-2.5 text-lg font-extrabold tracking-tight`}>
            <DonutIcon size={30} />
            <span className="hidden sm:inline">{BRAND}</span>
            <span className="rounded-full bg-[#262626] px-2.5 py-0.5 text-xs font-semibold text-white">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={CONFIG.ROUTES.DASHBOARD} className={btnOutline}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to menu</span>
              <span className="sr-only sm:hidden">Back to menu</span>
            </Link>
            <button type="button" onClick={handleLogout} className={btnOutline}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
              <span className="sr-only sm:hidden">Log out</span>
            </button>
          </div>
        </div>
        <nav aria-label="Admin sections" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-8">
          {ADMIN_LINKS.map((l) => {
            const on = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`h-10 shrink-0 rounded-full px-5 text-[15px] font-semibold leading-10 transition-colors ${focus} ${
                  on ? "bg-[#262626] text-white" : "bg-white text-[#262626] ring-1 ring-[#DDD2C4] hover:bg-[#EFE8DE]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-6 sm:px-8">
        <section className="rise relative overflow-hidden rounded-[32px] bg-[#F1E7DA] p-7 sm:p-9">
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#FFD9B3]/70 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-[#D9C6AE]/70 blur-3xl" aria-hidden />
          <div className="relative max-w-md">
            <h1 className={`${display.className} text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl`}>{title}</h1>
            <p className="mt-3 text-base text-[#5F5850]">{subtitle}</p>
          </div>
          <div className="pointer-events-none absolute right-4 top-1/2 hidden w-40 -translate-y-1/2 sm:block" aria-hidden>
            <div className="bob absolute -top-12 left-2 w-24" style={{ "--r": "6deg", "--dur": "8s" } as React.CSSProperties}>
              <IconA className={ic} />
            </div>
            <div className="bob absolute left-14 top-6 w-16" style={{ "--r": "-12deg", "--dur": "9s", "--delay": "-3s" } as React.CSSProperties}>
              <IconB className={ic} />
            </div>
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}