"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { AlertCircle, Check, Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { apiClient } from "@/lib/api";
import { CONFIG } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CoffeeIcon,
  DonutIcon,
  FriesIcon,
  IceCreamIcon,
  PizzaIcon,
  RamenIcon,
} from "@/components/food-icons";

const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"] });

// Change this to your app's name
const BRAND = "GrubGalaxy";

/*
  Palette (60 / 30 / 10), shared with the login page
  Surfaces 60%: off-white #F8F8F8, cream #F8F2E9, beige #E6DBCD / #EADFD2
  Text 30%:     charcoal #262626, warm gray #5F5850 (never pure black)
  Accent 10%:   vibrant orange #E8590C, used only for the main button and focus rings
  Feedback:     soft coral #E5675A / #FDEDEA for form errors, green #2E8B57 for success only
*/

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

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

type Invalid = { username: boolean; password: boolean; confirm: boolean };
const NONE: Invalid = { username: false, password: false, confirm: false };

export default function RegisterPage() {
  const router = useRouter();
  const { isChecking } = useAuthGuard({ requireAuth: false });
  const artRef = useRef<HTMLElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [invalid, setInvalid] = useState<Invalid>(NONE);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => () => clearTimeout(navTimer.current), []);

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

  const showError = (message: string, which: Partial<Invalid>) => {
    setError(message);
    setErrorKey((k) => k + 1); // re-triggers the shake
    setInvalid({ ...NONE, ...which });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Friendly inline validation instead of the browser's tooltip bubble
    const user = username.trim();
    if (!user) {
      showError("Choose a username.", { username: true });
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      showError("Choose a password.", { password: true });
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      showError("The passwords don't match. Type the same password in both fields.", { confirm: true });
      confirmRef.current?.focus();
      return;
    }

    setInvalid(NONE);
    setLoading(true);

    try {
      // Adjust the endpoint if your backend uses a different path
      await apiClient("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: user, password }),
      });

      // Success: show a short confirmation, then send them to log in
      setDone(true);
      router.prefetch(CONFIG.ROUTES.LOGIN);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      navTimer.current = setTimeout(() => router.push(CONFIG.ROUTES.LOGIN), reduced ? 600 : 1800);
    } catch (err: any) {
      showError(err.message || "We couldn't create your account. Try a different username.", { username: true });
      usernameRef.current?.focus();
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

  const clear = (k: keyof Invalid) => invalid[k] && setInvalid((v) => ({ ...v, [k]: false }));
  const describedBy = error ? "register-error" : undefined;

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
        @keyframes check-pop { from { transform: scale(0) rotate(-30deg); } 60% { transform: scale(1.2); } }
        .check-pop { animation: check-pop .5s cubic-bezier(.34, 1.56, .64, 1) both; }
        @keyframes tick { from { opacity: 0; transform: translateY(10px); } }
        .tick { animation: tick .35s ease-out .15s both; }
        @media (prefers-reduced-motion: reduce) {
          .bob, .pop, .rise, .shake, .check-pop, .tick { animation: none; }
          .bob { transform: rotate(var(--r)); }
        }
      `}</style>

      {/* Artwork panel (desktop only): the food is the hero, the form stays calm */}
      <aside
        ref={artRef}
        style={{ "--mx": 0, "--my": 0 } as React.CSSProperties}
        className="relative hidden flex-col justify-between overflow-hidden bg-[#F1E7DA] p-12 lg:flex"
        aria-hidden
      >
        <div className="pointer-events-none absolute -left-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-[#FFD9B3]/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[#D9C6AE]/70 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />

        <div className={`${display.className} relative flex w-fit items-center gap-2.5 rounded-full bg-white/70 py-2 pl-3 pr-5 text-lg font-extrabold tracking-tight shadow-[0_8px_24px_-12px_rgba(60,40,20,0.3)] ring-1 ring-white`}>
          <DonutIcon size={28} />
          {BRAND}
        </div>

        <div className="relative mx-auto my-6 aspect-square w-full max-w-[32rem]">
          <div className="absolute -inset-[8%] rounded-full border border-[#8C6F4E]/15" />
          <div className="absolute -inset-[20%] rounded-full border border-[#8C6F4E]/10" />
          <div className="absolute inset-[4%] rounded-full bg-white/80 shadow-[0_40px_90px_-30px_rgba(60,40,20,0.45)] ring-1 ring-white" />
          <div className="absolute inset-[13%] rounded-full bg-[#FBF7F1] shadow-[inset_0_2px_10px_rgba(60,40,20,0.08)]" />
          <div className="absolute inset-[19%] rounded-full border border-dashed border-[#8C6F4E]/20" />

          <div className="absolute inset-[16%] rounded-full bg-[#FFE3C2]/70 blur-2xl" />
          {SCATTER.map(([left, top, w, h, color, rot], i) => (
            <span
              key={i}
              className="absolute rounded-full shadow-[0_2px_3px_rgba(60,40,20,0.25)]"
              style={{ left, top, width: w, height: h, backgroundColor: color, transform: `rotate(${rot}deg)` }}
            />
          ))}

          {/* A different table from the login page: ramen at the center */}
          <Float className="left-[24%] top-[20%] z-10 w-[52%]" k={18} rotate={4} dur={8} enter={0.15}>
            <RamenIcon className={ic} />
          </Float>
          <Float className="left-[2%] top-[48%] z-20 w-[30%]" k={-24} rotate={-12} dur={9} delay={-2} enter={0.3}>
            <IceCreamIcon className={ic} />
          </Float>
          <Float className="right-0 top-[48%] z-20 w-[34%]" k={24} rotate={10} dur={10} delay={-4} enter={0.45}>
            <PizzaIcon className={ic} />
          </Float>
          <Float className="left-[8%] top-[8%] w-[24%]" k={-14} rotate={-8} dur={8} delay={-3} enter={0.6}>
            <CoffeeIcon className={ic} />
          </Float>
          <Float className="right-[10%] top-[6%] w-[22%]" k={16} rotate={18} dur={7} delay={-1} enter={0.75}>
            <DonutIcon className={ic} />
          </Float>
          <Float className="bottom-0 left-[40%] z-20 w-[22%]" k={-12} rotate={-10} dur={9} delay={-5} enter={0.9}>
            <FriesIcon className={ic} />
          </Float>
        </div>

        <div className="relative max-w-md">
          <p className={`${display.className} text-balance text-4xl font-extrabold leading-[1.05] tracking-tight`}>
            Pull up a chair. Dinner starts here.
          </p>
          <p className="mt-3 text-base text-[#5F5850]">Create an account once, then order whenever you&rsquo;re hungry.</p>
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
          <RamenIcon className="pointer-events-none absolute -right-2 top-1 w-24 rotate-6 drop-shadow-[0_10px_14px_rgba(60,40,20,0.25)]" />
          <IceCreamIcon className="pointer-events-none absolute right-20 top-4 w-12 -rotate-12 drop-shadow-[0_8px_10px_rgba(60,40,20,0.25)]" />
        </header>

        <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="rise w-full max-w-[26rem] rounded-[28px] bg-white p-7 shadow-[0_40px_80px_-40px_rgba(60,40,20,0.35),0_2px_6px_rgba(60,40,20,0.04)] ring-1 ring-[#EFE6DA] sm:p-10">
            {done ? (
              /* Success: green is used only here, as the success signal */
              <div role="status" className="flex flex-col items-center py-6 text-center">
                <span className="check-pop grid h-16 w-16 place-items-center rounded-full bg-[#2E8B57] text-white shadow-[0_14px_28px_-10px_rgba(46,139,87,0.7)]">
                  <Check className="h-8 w-8" strokeWidth={3} />
                </span>
                <h1 className={`${display.className} tick mt-6 text-[2rem] font-extrabold leading-tight tracking-tight`}>
                  You&rsquo;re all set
                </h1>
                <p className="tick mt-2 text-base text-[#5F5850]">Your account is ready. Taking you to log in...</p>
                <Link
                  href={CONFIG.ROUTES.LOGIN}
                  className="tick mt-6 rounded font-semibold text-[#262626] underline underline-offset-4 hover:text-[#B54708] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                >
                  Log in now
                </Link>
              </div>
            ) : (
              <>
                <h1 className={`${display.className} text-[2.5rem] font-extrabold leading-none tracking-tight`}>Sign up</h1>
                <p className="mt-3 text-base text-[#5F5850]">Create an account to start ordering.</p>

                <form onSubmit={handleRegister} noValidate aria-busy={loading} className="mt-8 space-y-5">
                  {error && (
                    <div
                      key={errorKey}
                      id="register-error"
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
                          clear("username");
                        }}
                        disabled={loading}
                        aria-invalid={invalid.username}
                        aria-describedby={describedBy}
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
                        autoComplete="new-password"
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clear("password");
                        }}
                        onKeyDown={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                        onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                        onBlur={() => setCapsOn(false)}
                        disabled={loading}
                        aria-invalid={invalid.password}
                        aria-describedby={describedBy ?? (capsOn ? "caps-hint" : undefined)}
                        className={`${inputClass(invalid.password)} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide passwords" : "Show passwords"}
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

                  <div className="space-y-2">
                    <Label htmlFor="confirm" className="text-sm font-semibold text-[#262626]">
                      Confirm password
                    </Label>
                    <div className="relative">
                      <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#7A7167]" />
                      <Input
                        id="confirm"
                        ref={confirmRef}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Type it again"
                        value={confirm}
                        onChange={(e) => {
                          setConfirm(e.target.value);
                          clear("confirm");
                        }}
                        disabled={loading}
                        aria-invalid={invalid.confirm}
                        aria-describedby={describedBy}
                        className={inputClass(invalid.confirm)}
                      />
                    </div>
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
                          Creating account...
                        </>
                      ) : (
                        "Sign up"
                      )}
                    </span>
                  </Button>
                </form>

                <p className="mt-8 border-t border-[#EFE6DA] pt-6 text-center text-[15px] text-[#5F5850]">
                  Already have an account?{" "}
                  <Link
                    href={CONFIG.ROUTES.LOGIN}
                    className="rounded font-semibold text-[#262626] underline underline-offset-4 hover:text-[#B54708] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8590C]"
                  >
                    Log in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}