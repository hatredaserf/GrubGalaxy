"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { AlertCircle, Check, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { apiClient } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/*
  Palette (60 / 30 / 10)
  Surfaces 60%: off-white #F8F8F8, cream #F8F2E9, beige #E6DBCD / #EADFD2
  Text 30%:     charcoal #262626, warm gray #5F5850 (never pure black)
  Accent 10%:   vibrant orange #E8590C, used only for the Log in button and focus rings
  Feedback:     soft coral #E5675A / #FDEDEA for form errors, green #2E8B57 for success only
*/

// Soft paper grain, laid over the beige surfaces
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
}

/** A floating food: outside = mouse parallax, middle = one-time entrance, inside = idle bob. */
function Float({
  className,
  k,
  rotate = 0,
  dur = 8,
  delay = 0,
  enter = 0,
  children,
}: {
  className: string;
  k: number;
  rotate?: number;
  dur?: number;
  delay?: number;
  enter?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute transition-transform duration-300 ease-out ${className}`}
      style={{ transform: `translate3d(calc(var(--mx, 0) * ${k}px), calc(var(--my, 0) * ${k}px), 0)` }}
    >
      <div className="pop" style={{ animationDelay: `${enter}s` }}>
        <div
          className="bob"
          style={{ "--r": `${rotate}deg`, "--dur": `${dur}s`, "--delay": `${delay}s` } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const ic = "block h-auto w-full drop-shadow-[0_18px_22px_rgba(60,40,20,0.28)]";
const icFar = `${ic} opacity-60 blur-[2px]`;

type Invalid = { username: boolean; password: boolean };

// Crumbs, seeds, herbs and pepper flakes around the plate: [left, top, width, height, color, rotation]
const SCATTER: [string, string, number, number, string, number][] = [
  ["10%", "32%", 9, 4, "#E9B15A", 30],
  ["88%", "38%", 7, 3.5, "#FFF3D2", -20],
  ["74%", "90%", 10, 4.5, "#5E9E3A", 50],
  ["20%", "84%", 7, 3.5, "#C5321B", 15],
  ["50%", "97%", 6, 3, "#E9B15A", -40],
  ["95%", "72%", 8, 4, "#FFF3D2", 25],
  ["3%", "58%", 6, 3, "#5E9E3A", -35],
  ["62%", "3%", 7, 3.5, "#C5321B", 60],
  ["33%", "-1%", 8, 4, "#E9B15A", -15],
];

// Loading screen: the burger is eaten bite by bite, then the dashboard opens
const EAT_BG = "#F8F2E9"; // the stage disc is this flat color, so bites read as missing pieces
const BITE_START = 0.6; // seconds before the first bite
const BITE_GAP = 0.4; // seconds between bites
// [cx, cy, r] in the burger's 64x64 viewBox, working from right to left
const BITES: [number, number, number][] = [
  [56, 32, 14],
  [56, 52, 13],
  [38, 26, 16],
  [38, 48, 16],
  [20, 30, 16],
  [18, 50, 16],
  [8, 40, 12],
];
const EAT_S = BITE_START + BITES.length * BITE_GAP; // seconds until the burger is gone
const EAT_MS = 3900; // total time before navigating (all bites + a short "Yum!" beat)
const CRUMB_COLORS = ["#F2B766", "#4A9A38", "#7E4A17", "#FFE98A"];

export default function LoginPage() {
  const router = useRouter();
  const { isChecking } = useAuthGuard({ requireAuth: false });
  const artRef = useRef<HTMLElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [invalid, setInvalid] = useState<Invalid>({ username: false, password: false });
  const [loading, setLoading] = useState(false);
  const [eating, setEating] = useState(false);
  const [bitesLeft, setBitesLeft] = useState(BITES.length);
  const [calm, setCalm] = useState(false); // reduced motion: no counting, plain label
  const navTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(navTimer.current), []);

  // Count the bites down in step with the animation
  useEffect(() => {
    if (!eating) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCalm(true);
      return;
    }
    const timers = BITES.map((_, i) =>
      setTimeout(() => setBitesLeft(BITES.length - i - 1), (BITE_START + i * BITE_GAP) * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [eating]);

  // Mouse parallax on the artwork panel only: writes two CSS variables (-1 to 1), no re-renders
  useEffect(() => {
    const el = artRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", ((e.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
        el.style.setProperty("--my", ((e.clientY / window.innerHeight - 0.5) * 2).toFixed(3));
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [isChecking]);

  if (isChecking) return null;

  const showError = (message: string, which: Invalid) => {
    setError(message);
    setErrorKey((k) => k + 1); // re-triggers the shake
    setInvalid(which);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (eating) return;
    setError("");

    // Friendly inline validation instead of the browser's tooltip bubble
    const user = username.trim();
    if (!user || !password) {
      showError(
        !user && !password
          ? "Enter your username and password."
          : !user
            ? "Enter your username."
            : "Enter your password.",
        { username: !user, password: !password },
      );
      (!user ? usernameRef : passwordRef).current?.focus();
      return;
    }

    setInvalid({ username: false, password: false });
    setLoading(true);

    try {
      const data = await apiClient<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password }),
      });

      // Show the burger first. Tokens are saved just before navigating, so the
      // auth guard can't redirect early and cut the animation short.
      (document.activeElement as HTMLElement | null)?.blur();
      setEating(true);
      router.prefetch(CONFIG.ROUTES.DASHBOARD);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      navTimer.current = setTimeout(() => {
        setTokens(data.accessToken, data.refreshToken);
        router.push(CONFIG.ROUTES.DASHBOARD);
      }, reduced ? 800 : EAT_MS);
    } catch (err: any) {
      showError(err.message || "We couldn't log you in. Check your username and password, then try again.", {
        username: true,
        password: true,
      });
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (bad: boolean) =>
    `h-[52px] rounded-2xl bg-[#FCFBF9] pl-12 text-base text-[#262626] placeholder:text-[#8C8379] shadow-none transition-[border-color,box-shadow,background-color] focus-visible:bg-white focus-visible:ring-4 disabled:opacity-60 ${
      bad
        ? "border-[#E5675A] focus-visible:border-[#E5675A] focus-visible:ring-[#E5675A]/25"
        : "border-[#A39888] hover:border-[#857A6D] focus-visible:border-[#E8590C] focus-visible:ring-[#E8590C]/20"
    }`;

  return (
    <main className={`${body.className} min-h-screen bg-[#F8F8F8] text-[#262626] lg:grid lg:grid-cols-[1.05fr_1fr]`}>
      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0) rotate(var(--r)); }
          50%      { transform: translateY(-10px) rotate(calc(var(--r) + 3deg)); }
        }
        .bob { animation: bob var(--dur) ease-in-out infinite; animation-delay: var(--delay); }
        @keyframes pop { from { opacity: 0; transform: scale(.5) translateY(24px); } }
        .pop { animation: pop .8s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes rise { from { opacity: 0; transform: translateY(24px); } }
        .rise { animation: rise .7s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); } 40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); } 80% { transform: translateX(2px); }
        }
        .shake { animation: shake .4s ease-in-out; }
        @keyframes fade-in { from { opacity: 0; } }
        .fade-in { animation: fade-in .4s ease-out both; }
        @keyframes bite { from { transform: scale(0); } to { transform: scale(1); } }
        .bite { transform-box: fill-box; transform-origin: center; animation: bite .16s ease-out both; }

        /* 3D burger: perspective scene > idle sway > per-bite chomp */
        .scene { perspective: 900px; }
        .tilt, .chomp { transform-style: preserve-3d; }
        @keyframes sway {
          from { transform: rotateX(10deg) rotateY(-20deg) translateY(0); }
          to   { transform: rotateX(-4deg) rotateY(20deg) translateY(-8px); }
        }
        .tilt { animation: sway 2.6s ease-in-out infinite alternate; }
        @keyframes chomp {
          0%, 100% { transform: translateZ(0) rotateX(0) scale(1); }
          35%      { transform: translateZ(40px) rotateX(14deg) scale(1.07, .92); }
        }
        .chomp { animation: chomp ${BITE_GAP}s ease-in-out ${BITE_START - 0.05}s ${BITES.length}; }
        @keyframes vanish { to { opacity: 0; transform: scale(.85) translateY(10px); } }
        .vanish { animation: vanish .25s ease-in ${EAT_S - 0.1}s both; }
        @keyframes shadow-shrink { to { transform: scaleX(.4); opacity: .35; } }
        .ground-shadow { animation: shadow-shrink ${EAT_S}s ease-in-out both; }
        @keyframes crumb {
          from { opacity: 1; transform: translate3d(0, 0, 0) rotate(0) scale(1); }
          to   { opacity: 0; transform: translate3d(var(--dx), var(--dy), 70px) rotate(240deg) scale(.5); }
        }
        .crumb { animation: crumb .8s cubic-bezier(.2, .7, .4, 1) forwards; }
        @keyframes tick { from { opacity: 0; transform: translateY(10px) scale(.96); } }
        .tick { animation: tick .3s ease-out both; }
        @keyframes ripple { from { transform: scale(1); opacity: .6; } to { transform: scale(1.7); opacity: 0; } }
        .ripple { animation: ripple 3.6s ease-out infinite; }
        @keyframes check-pop { from { transform: scale(0) rotate(-30deg); } 60% { transform: scale(1.2); } }
        .check-pop { animation: check-pop .5s cubic-bezier(.34, 1.56, .64, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .bob, .pop, .rise, .shake, .tilt, .chomp, .vanish, .ground-shadow, .crumb, .tick, .ripple, .check-pop { animation: none; }
          .bob { transform: rotate(var(--r)); }
          .bite { display: none; }
        }
      `}</style>

      {/* Artwork panel (desktop only): the food is the hero, the form stays calm */}
      <aside
        ref={artRef}
        style={{ "--mx": 0, "--my": 0 } as React.CSSProperties}
        className="relative hidden flex-col justify-between overflow-hidden bg-[#F1E7DA] p-12 lg:flex"
        aria-hidden
      >
        {/* Soft light: a peach glow top-left and a deeper beige pool bottom-right */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-[#FFD9B3]/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[#D9C6AE]/70 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />

        <div className={`${display.className} relative flex w-fit items-center gap-2.5 rounded-full bg-white/70 py-2 pl-3 pr-5 text-lg font-extrabold tracking-tight shadow-[0_8px_24px_-12px_rgba(60,40,20,0.3)] ring-1 ring-white`}>
          <DonutIcon size={28} />
          {BRAND}
        </div>

        <div className="relative mx-auto my-6 aspect-square w-full max-w-[32rem]">
          {/* Rings around the plate, like ripples on a table */}
          <div className="absolute -inset-[8%] rounded-full border border-[#8C6F4E]/15" />
          <div className="absolute -inset-[20%] rounded-full border border-[#8C6F4E]/10" />
          <div className="absolute inset-[4%] rounded-full bg-white/80 shadow-[0_40px_90px_-30px_rgba(60,40,20,0.45)] ring-1 ring-white" />
          <div className="absolute inset-[13%] rounded-full bg-[#FBF7F1] shadow-[inset_0_2px_10px_rgba(60,40,20,0.08)]" />
          <div className="absolute inset-[19%] rounded-full border border-dashed border-[#8C6F4E]/20" />

          {/* Styled like a food shoot: warm light on the plate, crumbs and herbs scattered on the table */}
          <div className="absolute inset-[16%] rounded-full bg-[#FFE3C2]/70 blur-2xl" />
          {SCATTER.map(([left, top, w, h, color, rot], i) => (
            <span
              key={i}
              className="absolute rounded-full shadow-[0_2px_3px_rgba(60,40,20,0.25)]"
              style={{ left, top, width: w, height: h, backgroundColor: color, transform: `rotate(${rot}deg)` }}
            />
          ))}

          <Float className="left-[26%] top-[20%] z-10 w-[48%]" k={18} rotate={6} dur={8} enter={0.15}>
            <BurgerIcon className={ic} />
          </Float>
          <Float className="left-[2%] top-[46%] z-20 w-[32%]" k={-24} rotate={-14} dur={9} delay={-2} enter={0.3}>
            <PizzaIcon className={ic} />
          </Float>
          <Float className="right-0 top-[50%] z-20 w-[36%]" k={24} rotate={8} dur={10} delay={-4} enter={0.45}>
            <RamenIcon className={ic} />
          </Float>
          <Float className="left-[8%] top-[10%] w-[24%]" k={-14} rotate={-8} dur={8} delay={-3} enter={0.6}>
            <CoffeeIcon className={ic} />
          </Float>
          <Float className="right-[10%] top-[8%] w-[22%]" k={16} rotate={18} dur={7} delay={-1} enter={0.75}>
            <DonutIcon className={ic} />
          </Float>
          <Float className="bottom-0 left-[38%] z-20 w-[24%]" k={-12} rotate={-10} dur={9} delay={-5} enter={0.9}>
            <TacoIcon className={ic} />
          </Float>
        </div>

        <div className="relative max-w-md">
          <p className={`${display.className} text-balance text-4xl font-extrabold leading-[1.05] tracking-tight`}>
            Your next meal is a few taps away.
          </p>
          <p className="mt-3 text-base text-[#5F5850]">Log in to see the menu and track your orders.</p>
        </div>
      </aside>

      {/* Form panel */}
      <section className="relative flex min-h-screen flex-col overflow-hidden lg:min-h-0">
        <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#FFD9B3]/45 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#E6DBCD]/70 blur-3xl" aria-hidden />

        {/* Mobile header: brand + two foods on the beige backdrop */}
        <header className="relative overflow-hidden rounded-b-[2rem] bg-[#EADFD2] px-6 pb-8 pt-6 lg:hidden">
          <div className={`${display.className} relative z-10 flex items-center gap-2.5 text-xl font-extrabold tracking-tight`}>
            <DonutIcon size={28} />
            {BRAND}
          </div>
          <BurgerIcon className="pointer-events-none absolute -right-2 top-1 w-24 rotate-6 drop-shadow-[0_10px_14px_rgba(60,40,20,0.25)]" />
          <PizzaIcon className="pointer-events-none absolute right-20 top-6 w-14 -rotate-12 drop-shadow-[0_8px_10px_rgba(60,40,20,0.25)]" />
        </header>

        <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="rise w-full max-w-[26rem] rounded-[28px] bg-white p-7 shadow-[0_40px_80px_-40px_rgba(60,40,20,0.35),0_2px_6px_rgba(60,40,20,0.04)] ring-1 ring-[#EFE6DA] sm:p-10">
            <h1 className={`${display.className} text-[2.5rem] font-extrabold leading-none tracking-tight`}>Log in</h1>
            <p className="mt-3 text-base text-[#5F5850]">Welcome back. Enter your details to order.</p>

            <form onSubmit={handleLogin} noValidate aria-busy={loading} className="mt-8 space-y-5">
              {error && (
                <div
                  key={errorKey}
                  id="login-error"
                  role="alert"
                  className="shake flex items-start gap-2.5 rounded-2xl border border-[#F5B5AB] bg-[#FDEDEA] p-3.5 text-sm leading-snug text-[#9B2C1F]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-[#262626]">
                  Username
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#7A7167]" />
                  <Input
                    id="username"
                    ref={usernameRef}
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    placeholder="e.g. juan_delacruz"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (invalid.username) setInvalid((v) => ({ ...v, username: false }));
                    }}
                    disabled={loading}
                    aria-invalid={invalid.username}
                    aria-describedby={error ? "login-error" : undefined}
                    className={inputClass(invalid.username)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-[#262626]">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#7A7167]" />
                  <Input
                    id="password"
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (invalid.password) setInvalid((v) => ({ ...v, password: false }));
                    }}
                    onKeyDown={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                    onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                    onBlur={() => setCapsOn(false)}
                    disabled={loading}
                    aria-invalid={invalid.password}
                    aria-describedby={error ? "login-error" : capsOn ? "caps-hint" : undefined}
                    className={`${inputClass(invalid.password)} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#5F5850] transition-colors hover:bg-[#EFE8DE] hover:text-[#262626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {capsOn && (
                  <p id="caps-hint" className="text-sm font-medium text-amber-700">
                    Caps Lock is on.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="group relative mt-2 h-[52px] w-full overflow-hidden rounded-2xl bg-[#E8590C] text-base font-semibold text-[#2A1206] shadow-[0_14px_28px_-12px_rgba(232,89,12,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#F2701F] focus-visible:ring-4 focus-visible:ring-[#E8590C]/35 active:translate-y-0 disabled:opacity-80"
              >
                <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/35 blur-md transition-transform duration-700 group-hover:translate-x-[320%]" />
                <span className="relative flex items-center">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Log in"
                  )}
                </span>
              </Button>
            </form>

            <p className="mt-8 border-t border-[#EFE6DA] pt-6 text-center text-[15px] text-[#5F5850]">
              New here?{" "}
              <Link
                href={CONFIG.ROUTES.REGISTER}
                className="rounded font-semibold text-[#262626] underline underline-offset-4 hover:text-[#B54708] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Success screen: the burger gets eaten on a plate, then the dashboard opens */}
      {eating && (
        <div
          role="status"
          className="fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#F1E7DA,#DFD0BC_85%)] px-6"
        >
          <span className="sr-only">Logging you in. Loading your dashboard.</span>
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply" style={{ backgroundImage: GRAIN }} aria-hidden />

          {/* Far foods drifting at the edges for depth */}
          <Float className="left-[8%] top-[12%] w-14 sm:w-20" k={0} rotate={-14} dur={11} enter={0.3}>
            <DonutIcon className={icFar} />
          </Float>
          <Float className="right-[9%] top-[16%] w-12 sm:w-16" k={0} rotate={16} dur={12} delay={-4} enter={0.45}>
            <IceCreamIcon className={icFar} />
          </Float>
          <Float className="bottom-[14%] left-[10%] w-14 sm:w-20" k={0} rotate={20} dur={10} delay={-6} enter={0.6}>
            <TacoIcon className={icFar} />
          </Float>
          <Float className="bottom-[12%] right-[10%] w-14 sm:w-20" k={0} rotate={-12} dur={13} delay={-2} enter={0.75}>
            <FriesIcon className={icFar} />
          </Float>

          {/* Stage: ripples, a flat cream disc, and the burger on its plate */}
          <div className="relative grid h-[19rem] w-[19rem] place-items-center sm:h-[25rem] sm:w-[25rem]" aria-hidden>
            {[0, 1.2, 2.4].map((d) => (
              <span
                key={d}
                className="ripple absolute inset-0 rounded-full border border-[#8C6F4E]/30"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
            <div
              className="absolute inset-0 rounded-full shadow-[0_50px_90px_-30px_rgba(60,40,20,0.4)] ring-1 ring-white"
              style={{ backgroundColor: EAT_BG }}
            />
            <div className="absolute inset-[7%] rounded-full border border-dashed border-[#8C6F4E]/20" />

            <div className="relative w-44 sm:w-56">
              {/* Plate and soft shadow stay flat on the table while the burger turns */}
              <div className="absolute -left-[10%] top-[92%] h-[18%] w-[120%] rounded-[50%] bg-white shadow-[0_16px_26px_-12px_rgba(60,40,20,0.35)] ring-1 ring-[#EFE6DA]" />
              <div className="ground-shadow absolute inset-x-0 top-[93%] mx-auto h-[9%] w-[75%] rounded-[50%] bg-[#262626]/20 blur-md" />

              <div className="vanish scene">
                <div className="tilt relative">
                  <div className="chomp relative aspect-square">
                    <BurgerIcon className="absolute inset-0 h-full w-full" />
                    <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" style={{ clipPath: "inset(0 0 8% 0)" }}>
                      {BITES.map(([cx, cy, r], i) => (
                        <g key={i} className="bite" fill={EAT_BG} style={{ animationDelay: `${BITE_START + i * BITE_GAP}s` }}>
                          <circle cx={cx} cy={cy} r={r} />
                          <circle cx={cx - r * 0.85} cy={cy - r * 0.55} r={r * 0.5} />
                          <circle cx={cx - r * 0.85} cy={cy + r * 0.55} r={r * 0.5} />
                        </g>
                      ))}
                    </svg>

                    {/* Crumbs fly out of each bite */}
                    {BITES.flatMap(([cx, cy], i) =>
                      CRUMB_COLORS.map((color, j) => (
                        <span
                          key={`${i}-${j}`}
                          className="crumb absolute h-2 w-2 rounded-full opacity-0"
                          style={
                            {
                              left: `${(cx / 64) * 100}%`,
                              top: `${(cy / 64) * 100}%`,
                              backgroundColor: color,
                              animationDelay: `${BITE_START + i * BITE_GAP}s`,
                              "--dx": `${Math.round((cx - 32) * 1.1 + (j - 1.5) * 18)}px`,
                              "--dy": `${60 + j * 18}px`,
                            } as React.CSSProperties
                          }
                        />
                      )),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Countdown: a big number that ticks down with every bite */}
          <div className="relative flex min-h-[7.5rem] flex-col items-center text-center" aria-hidden>
            {calm ? (
              <p className={`${display.className} text-3xl font-extrabold tracking-tight text-[#262626]`}>
                Loading your dashboard...
              </p>
            ) : bitesLeft > 0 ? (
              <div key={bitesLeft} className="tick flex items-baseline gap-3">
                <span className={`${display.className} text-7xl font-extrabold leading-none tabular-nums text-[#262626]`}>
                  {bitesLeft}
                </span>
                <span className="text-xl font-semibold text-[#5F5850]">{bitesLeft === 1 ? "bite to go" : "bites to go"}</span>
              </div>
            ) : (
              <div key="done" className="tick flex items-center gap-3">
                <span className="check-pop grid h-11 w-11 place-items-center rounded-full bg-[#2E8B57] text-white shadow-[0_10px_20px_-8px_rgba(46,139,87,0.7)]">
                  <Check className="h-6 w-6" strokeWidth={3} />
                </span>
                <span className={`${display.className} text-5xl font-extrabold leading-none tracking-tight text-[#262626]`}>Yum!</span>
              </div>
            )}
            {!calm && (
              <p className="mt-4 text-[15px] text-[#5F5850]">
                {bitesLeft > 0 ? "Getting your dashboard ready" : "Opening your dashboard"}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}