"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Outfit } from "next/font/google";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const font = Outfit({ subsets: ["latin"], weight: ["400", "500", "600"] });

// Change this to your app's name
export const BRAND = "FoodOrdering";

export type Theme = "garden" | "night";

const T = {
  garden: {
    mobileBg: "bg-gradient-to-b from-[#CDEAE5] via-[#EAF6F3] to-white",
    text: "text-[#17324D]",
    sub: "text-[#17324D]/65",
    input:
      "border-[#B8CFCB] bg-white/70 text-[#17324D] placeholder:text-[#17324D]/40 focus-visible:ring-[#2F4858]/30",
    button: "bg-[#2F4858] hover:bg-[#263b49]",
    link: "text-[#1F8A7A]",
    drop: "#165A55",
  },
  night: {
    mobileBg: "bg-[#14284B]",
    text: "text-white lg:text-[#17324D]",
    sub: "text-white/70 lg:text-[#17324D]/65",
    input:
      "border-white/25 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/30 lg:border-[#B8CFCB] lg:bg-white lg:text-[#17324D] lg:placeholder:text-[#17324D]/40 lg:focus-visible:ring-[#E8604C]/30",
    button: "bg-[#E8604C] hover:bg-[#d9533f]",
    link: "text-[#E8604C]",
    drop: "#14284B",
  },
};

/* ---------- Illustrations (600 x 800 canvas) ---------- */

const LEAF = "M0 0C30-46 86-46 116 0C86 46 30 46 0 0Z";

function Leaf({ x, y, r, s, fill }: { x: number; y: number; r: number; s: number; fill: string }) {
  return <path d={LEAF} fill={fill} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} />;
}

function Bowl() {
  return (
    <g transform="translate(114 330) scale(2.2)">
      <path className="steam" d="M62 30c-8-8 8-14 0-24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path className="steam" d="M80 26c-8-8 8-14 0-24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path className="steam" d="M98 30c-8-8 8-14 0-24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 64C34 42 62 36 80 36s46 6 54 28Z" fill="#F2B63D" />
      <circle cx="62" cy="52" r="6" fill="#C73E2E" />
      <circle cx="98" cy="50" r="5" fill="#C73E2E" />
      <path d="M44 58c5-7 13-8 17-4-4 6-11 8-17 4Z" fill="#7FD1BE" />
      <path d="M104 58c6-6 14-6 17-1-5 6-12 7-17 1Z" fill="#7FD1BE" />
      <line x1="90" y1="50" x2="132" y2="-8" stroke="#F6D9A0" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="100" y1="52" x2="144" y2="-2" stroke="#F6D9A0" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M18 64h124c0 40-26 58-62 58S18 104 18 64Z" fill="#E8604C" />
      <rect x="14" y="59" width="132" height="10" rx="5" fill="#FFF9EE" />
    </g>
  );
}

function Garden({ uid }: { uid: string }) {
  return (
    <>
      <rect width="600" height="800" fill="#165A55" />
      <circle cx="310" cy="360" r="270" fill={`url(#${uid}m)`} />
      <Leaf x={-20} y={60} r={40} s={1.7} fill="#0B3B3A" />
      <Leaf x={80} y={-10} r={75} s={1.4} fill="#0F4D49" />
      <Leaf x={430} y={30} r={120} s={1.3} fill="#0F4D49" />
      {/* floating ingredients */}
      <circle cx="120" cy="250" r="24" fill="#E8604C" />
      <Leaf x={120} y={228} r={-30} s={0.25} fill="#7FD1BE" />
      <circle cx="455" cy="260" r="20" fill="#F2B63D" />
      <circle cx="455" cy="260" r="13" fill="none" stroke="#FFE7A8" strokeWidth="2" />
      {[[200, 160, 10], [380, 120, 7], [470, 420, 9], [90, 430, 6]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
      ))}
      <Bowl />
      {/* foreground leaves */}
      <Leaf x={60} y={800} r={-80} s={2.6} fill="#0F4D49" />
      <Leaf x={240} y={800} r={-70} s={1.9} fill="#1F8A7A" />
      <Leaf x={380} y={800} r={-100} s={2.1} fill="#0B3B3A" />
      <Leaf x={120} y={720} r={-30} s={1.5} fill="#2FA58F" />
      <Leaf x={420} y={770} r={-125} s={1.4} fill="#7FD1BE" />
    </>
  );
}

function Night() {
  const stars = [[60, 300, 2], [200, 90, 2], [330, 60, 1.5], [500, 200, 2], [540, 360, 1.5], [90, 480, 1.5], [450, 470, 2], [250, 230, 1.5]];
  const pep = [[265, 412, 20], [340, 430, 18], [300, 500, 16]];
  return (
    <>
      <rect width="600" height="800" fill="#14284B" />
      {stars.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity=".7" />
      ))}
      {/* tomato planet */}
      <circle cx="110" cy="150" r="72" fill="#E8604C" />
      <circle cx="85" cy="130" r="14" fill="#C73E2E" />
      <circle cx="135" cy="175" r="10" fill="#C73E2E" />
      <circle cx="140" cy="115" r="7" fill="#C73E2E" />
      <ellipse cx="110" cy="150" rx="118" ry="22" transform="rotate(-20 110 150)" fill="none" stroke="#F28B7B" strokeWidth="2.5" />
      {/* mint planet */}
      <circle cx="400" cy="250" r="44" fill="#4CC9C0" />
      <circle cx="388" cy="238" r="9" fill="#3AA9A1" />
      <circle cx="415" cy="266" r="6" fill="#3AA9A1" />
      <ellipse cx="400" cy="250" rx="70" ry="14" transform="rotate(-25 400 250)" fill="none" stroke="#9BE7E0" strokeWidth="2.5" />
      {/* pizza slice rising from the sauce */}
      <g transform="rotate(-8 300 500)">
        <path d="M200 360H400L300 660Z" fill="#F2B63D" />
        <rect x="190" y="334" width="220" height="36" rx="18" fill="#F6D9A0" />
        {pep.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="#D24C3A" />
            <circle cx={x - 4} cy={y - 4} r={r / 3} fill="#E8604C" />
          </g>
        ))}
      </g>
      <path d="M0 560C120 520 260 545 400 525C500 510 560 520 600 530V800H0Z" fill="#E8604C" />
      <ellipse cx="90" cy="620" rx="40" ry="10" fill="#D24C3A" />
      <ellipse cx="470" cy="600" rx="50" ry="12" fill="#D24C3A" />
      <circle cx="180" cy="590" r="6" fill="#F28B7B" />
      <circle cx="380" cy="610" r="5" fill="#F28B7B" />
      <path d="M0 700C150 670 320 710 600 675V800H0Z" fill="#D24C3A" />
    </>
  );
}

function Art({ theme, clip }: { theme: Theme; clip?: boolean }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 600 800"
      preserveAspectRatio={clip ? "xMinYMid slice" : "xMidYMax slice"}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <clipPath id={`${uid}c`}>
          <path d="M0 0H440C490 90 400 170 430 260C465 355 545 400 495 520C450 625 505 705 450 800H0Z" />
        </clipPath>
        <radialGradient id={`${uid}m`}>
          <stop offset="0" stopColor="#E6F7F3" />
          <stop offset="1" stopColor="#E6F7F3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={clip ? `url(#${uid}c)` : undefined}>
        {theme === "garden" ? <Garden uid={uid} /> : <Night />}
      </g>
      {clip && (
        <>
          <circle cx="475" cy="170" r="9" fill={T[theme].drop} />
          <circle cx="530" cy="590" r="13" fill={T[theme].drop} />
        </>
      )}
    </svg>
  );
}

/* ---------- Layout ---------- */

export function AuthShell({
  theme,
  title,
  subtitle,
  footer,
  children,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
  footer: { text: string; label: string; href: string };
  children: React.ReactNode;
}) {
  const t = T[theme];
  return (
    <main
      className={`${font.className} flex min-h-screen flex-col ${t.mobileBg} lg:grid lg:grid-cols-[1.1fr_1fr] lg:bg-none lg:bg-white`}
    >
      <style>{`
        @keyframes rise {
          0%   { transform: translateY(6px); opacity: 0; }
          30%  { opacity: .85; }
          100% { transform: translateY(-6px); opacity: 0; }
        }
        .steam { animation: rise 3s ease-in-out infinite; }
        .steam:nth-of-type(2) { animation-delay: .9s; }
        .steam:nth-of-type(3) { animation-delay: 1.8s; }
        @media (prefers-reduced-motion: reduce) {
          .steam { animation: none; opacity: .7; }
        }
      `}</style>

      {/* Illustration: left panel on desktop */}
      <aside className="relative hidden lg:block">
        <Art theme={theme} clip />
      </aside>

      {/* Form */}
      <section className={`relative flex flex-1 flex-col items-center justify-center px-6 py-14 lg:px-10 ${t.text}`}>
        <span className="absolute left-6 top-5 text-sm font-semibold lg:left-10 lg:top-8">{BRAND}</span>
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center text-3xl font-medium">{title}</h1>
          <p className={`mb-8 text-center text-sm ${t.sub}`}>{subtitle}</p>
          {children}
          <p className={`mt-6 text-center text-sm ${t.sub}`}>
            {footer.text}{" "}
            <Link href={footer.href} className={`font-semibold underline-offset-4 hover:underline ${t.link}`}>
              {footer.label}
            </Link>
          </p>
        </div>
      </section>

      {/* Illustration: bottom on mobile */}
      <div className="relative mt-auto h-[38vh] shrink-0 [mask-image:linear-gradient(to_bottom,transparent,black_30%)] lg:hidden">
        <Art theme={theme} />
      </div>
    </main>
  );
}

/* ---------- Form pieces ---------- */

export function Field({
  theme,
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  theme: Theme;
  id: string;
  label: string;
  type?: "text" | "password";
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && show ? "text" : type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={`h-11 rounded-full px-5 ${isPassword ? "pr-11" : ""} ${T[theme].input}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-2xl border border-[#F0B8AE] bg-[#FCE9E3] p-3 text-sm text-[#A63A24]">
      {message}
    </div>
  );
}

export function SubmitButton({
  theme,
  loading,
  label,
  loadingLabel,
}: {
  theme: Theme;
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className={`h-11 w-full rounded-full text-sm font-semibold text-white disabled:opacity-70 ${T[theme].button}`}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}