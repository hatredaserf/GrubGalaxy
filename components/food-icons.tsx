"use client";

import { useId } from "react";
import type { ComponentType, ReactNode } from "react";

type IconProps = { size?: number; className?: string };

/* ---------- Helpers for the soft-3D look ----------
   Every shape gets: a gradient lit from the top-left (light > mid > shade),
   a blurred ambient shadow where it meets other shapes, and small specular highlights. */

const useUid = () => useId().replace(/:/g, "");
const f = (u: string, k: string) => `url(#${u}${k})`;

function Svg({ size = 64, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      {children}
    </svg>
  );
}

// g = radial gradients (light from the top-left), l = horizontal gradients for cylinders.
// Filters: b = soft ground shadow, h = soft shade/highlight, s = tight sparkle.
function Defs({ u, g = {}, l = {} }: { u: string; g?: Record<string, string[]>; l?: Record<string, string[]> }) {
  const stops = (c: string[]) => c.map((x, i) => <stop key={i} offset={i / (c.length - 1)} stopColor={x} />);
  return (
    <defs>
      {Object.entries(g).map(([k, c]) => (
        <radialGradient key={k} id={`${u}${k}`} cx=".3" cy=".25" r=".95">
          {stops(c)}
        </radialGradient>
      ))}
      {Object.entries(l).map(([k, c]) => (
        <linearGradient key={k} id={`${u}${k}`} x1="0" y1="0" x2="1" y2="0">
          {stops(c)}
        </linearGradient>
      ))}
      <filter id={`${u}b`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
      <filter id={`${u}h`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.9" />
      </filter>
      <filter id={`${u}s`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.35" />
      </filter>
    </defs>
  );
}

function Shadow({ u, cx = 32, cy = 60, rx = 18, ry = 3.2 }: { u: string; cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity=".4" filter={f(u, "b")} />;
}

function Shine({ u, cx, cy, rx, ry, r = 0, o = 0.5 }: { u: string; cx: number; cy: number; rx: number; ry: number; r?: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={o} filter={f(u, "h")} transform={`rotate(${r} ${cx} ${cy})`} />;
}

// Ambient occlusion: a dark blurred patch where one layer sits on another
function Shade({ u, cx, cy, rx, ry, r = 0, o = 0.25, c = "#2A1000" }: { u: string; cx: number; cy: number; rx: number; ry: number; r?: number; o?: number; c?: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c} opacity={o} filter={f(u, "h")} transform={`rotate(${r} ${cx} ${cy})`} />;
}

// A tiny glossy glint
function Spec({ u, x, y, r = 0.9, o = 0.85 }: { u: string; x: number; y: number; r?: number; o?: number }) {
  return <circle cx={x} cy={y} r={r} fill="#fff" opacity={o} filter={f(u, "s")} />;
}

/* ---------- Icons ---------- */

export function PizzaIcon(p: IconProps) {
  const u = useUid();
  return (
    <Svg {...p}>
      <Defs
        u={u}
        g={{
          ch: ["#FFF2A8", "#F8C041", "#E0961A"],
          cr: ["#FADFA2", "#DB9843", "#A45C1A"],
          pe: ["#FA7C64", "#C5321B", "#7A1608"],
        }}
      />
      <Shadow u={u} cy={61} rx={12} />
      {/* crust underside, then the sauce that peeks out around the cheese */}
      <path d="M10 19H54L32 61Z" fill="#B27119" />
      <rect x="8" y="12" width="48" height="10" rx="5" fill="#9C6224" />
      <path d="M10 16H54L32 58Z" fill="#C8341D" />
      <path d="M12 17.5H52L32 56Z" fill={f(u, "ch")} />
      <Shade u={u} cx={32} cy={17.5} rx={20} ry={2.4} o={0.3} />
      {/* bubbled, browned cheese */}
      {[[18, 23, 2.2], [46, 23, 2], [30, 32, 1.8], [25, 40, 1.6], [37, 45, 1.4], [35, 22, 1.3]].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill="#FFF7BC" opacity=".8" />
          <circle cx={Number(x) + 0.7} cy={Number(y) + 0.8} r={Number(r) * 0.5} fill="#C2761A" opacity=".45" />
        </g>
      ))}
      {/* pepperoni with grease shine */}
      {[[24, 27, 5], [39, 28, 4.6], [31, 41, 4]].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={Number(y) + 1.4} r={r} fill="#7A1608" />
          <circle cx={x} cy={y} r={r} fill={f(u, "pe")} />
          <circle cx={Number(x) + 1.2} cy={Number(y) + 0.8} r={0.7} fill="#FFD0A8" opacity=".6" />
          <circle cx={Number(x) - 1.6} cy={Number(y) + 1.6} r={0.6} fill="#FFD0A8" opacity=".5" />
          <circle cx={Number(x) - 1.7} cy={Number(y) - 1.7} r={Number(r) / 3} fill="#fff" opacity=".4" />
        </g>
      ))}
      {/* basil */}
      {[[34, 34, 30], [20, 31, -40]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0 0C2-3.2 6-3.2 7.4 0C6 3.2 2 3.2 0 0Z" fill="#4E9B34" />
          <path d="M.6 0H6.4" stroke="#A8E27C" strokeWidth=".6" strokeLinecap="round" />
        </g>
      ))}
      <ellipse cx="32" cy="56" rx="2.2" ry="3" fill={f(u, "ch")} />
      {/* crust: char spots, glow, rim light */}
      <rect x="8" y="9" width="48" height="10" rx="5" fill={f(u, "cr")} />
      {[[14, 14], [24, 11.5], [37, 15], [48, 12.5], [30, 16.5]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.5" ry=".8" fill="#6B3A0C" opacity=".4" />
      ))}
      <Shade u={u} cx={32} cy={18.5} rx={22} ry={1.4} o={0.28} />
      <Shine u={u} cx={22} cy={12} rx={11} ry={1.6} o={0.6} />
    </Svg>
  );
}

export function BurgerIcon(p: IconProps) {
  const u = useUid();
  return (
    <Svg {...p}>
      <Defs
        u={u}
        g={{
          bun: ["#FFE29C", "#EBA43E", "#B4601A"],
          bb: ["#F4C070", "#C98128", "#8A4A12"],
          lt: ["#C8F28E", "#6DBB45", "#38852C"],
          ch: ["#FFF2A6", "#F6B62B", "#D88410"],
          pa: ["#A97248", "#5A3015", "#2A1309"],
          tm: ["#FF8E74", "#D8341C", "#8A190A"],
        }}
      />
      <Shadow u={u} cy={59} rx={23} />
      {/* bottom bun */}
      <path d="M8 48H56V51Q56 57 50 57H14Q8 57 8 51Z" fill={f(u, "bb")} />
      <Shade u={u} cx={32} cy={56.5} rx={20} ry={1.6} o={0.3} />
      <Shine u={u} cx={16} cy={50.5} rx={5} ry={1} o={0.35} />
      {/* patty with grill marks */}
      <rect x="8" y="40" width="48" height="8.6" rx="4.3" fill={f(u, "pa")} />
      {[15, 24, 33, 42].map((x) => (
        <path key={x} d={`M${x} 42.6l4 4`} stroke="#150803" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
      ))}
      <Shine u={u} cx={20} cy={41.8} rx={9} ry={1} o={0.3} />
      {/* cheese melting over the patty */}
      <rect x="7" y="36.5" width="50" height="4.4" rx="1.5" fill={f(u, "ch")} />
      <path d="M17 40v5.5a2.8 2.8 0 0 0 5.6 0V40ZM42 40v3.6a2.3 2.3 0 0 0 4.6 0V40Z" fill={f(u, "ch")} />
      <rect x="9" y="37" width="30" height="1" rx=".5" fill="#fff" opacity=".5" />
      {/* tomato */}
      <rect x="8" y="31" width="48" height="5.6" rx="2.8" fill={f(u, "tm")} />
      <Shine u={u} cx={22} cy={33} rx={7} ry={0.8} o={0.45} />
      {/* ruffled lettuce */}
      <path d="M6 27H58V31.5Q54 36 50 31.5T42 31.5T34 31.5T26 31.5T18 31.5T10 31.5Q8 33.5 6 31.5Z" fill={f(u, "lt")} />
      <path d="M12 29.5Q20 31 28 29.5M34 30Q42 31.5 52 29.5" fill="none" stroke="#E4FFC0" strokeOpacity=".55" strokeWidth=".9" strokeLinecap="round" />
      {/* domed top bun with seeds */}
      <path d="M8 28C8 12 56 12 56 28Z" fill={f(u, "bun")} />
      <Shade u={u} cx={32} cy={26.5} rx={22} ry={2.2} o={0.28} />
      <Shine u={u} cx={21} cy={19.5} rx={9} ry={2.4} r={-22} o={0.6} />
      {[[22, 21, -30], [31, 18.5, 10], [41, 21, 35], [27, 24.5, -15], [37, 25, 20], [46, 25, 40], [17, 25.5, -40]].map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x} ${y})`}>
          <ellipse cx={x} cy={Number(y) + 0.8} rx="2.6" ry="1.3" fill="#8A4A10" opacity=".45" />
          <ellipse cx={x} cy={y} rx="2.5" ry="1.3" fill="#FFF3D2" />
          <ellipse cx={Number(x) - 0.7} cy={Number(y) - 0.4} rx=".9" ry=".4" fill="#fff" />
        </g>
      ))}
    </Svg>
  );
}

export function CoffeeIcon(p: IconProps) {
  const u = useUid();
  return (
    <Svg {...p}>
      <Defs
        u={u}
        g={{ sau: ["#FFF6E2", "#E5D3AE", "#B9A47C"], cof: ["#B57842", "#6A3A18", "#3E1D08"] }}
        l={{ cup: ["#E8DAC0", "#FFFFFF", "#FFFFFF", "#DCC9A4", "#B9A47C"], han: ["#FFFFFF", "#CDB88F"] }}
      />
      <Shadow u={u} cy={58} rx={24} />
      {/* steam */}
      <path d="M22 19c-4-4 4-6 0-12M32 17c-4-4 4-6 0-12M42 19c-4-4 4-6 0-12" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2.6" strokeLinecap="round" filter={f(u, "s")} />
      {/* saucer */}
      <ellipse cx="29" cy="55" rx="22" ry="5" fill={f(u, "sau")} />
      <ellipse cx="29" cy="54" rx="14" ry="2.6" fill="#B9A47C" opacity=".35" filter={f(u, "h")} />
      {/* handle and cup */}
      <path d="M46 30H50Q57 30 57 37Q57 44 50 44H45" fill="none" stroke={f(u, "han")} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M12 27H46V39Q46 53 29 53Q12 53 12 39Z" fill={f(u, "cup")} />
      <Shade u={u} cx={29} cy={52} rx={14} ry={1.4} o={0.2} c="#6B5530" />
      {/* coffee with a latte-art heart */}
      <ellipse cx="29" cy="27" rx="17" ry="5" fill="#FFF8E8" />
      <ellipse cx="29" cy="27.5" rx="15" ry="3.9" fill={f(u, "cof")} />
      <ellipse cx="29" cy="27.5" rx="15" ry="3.9" fill="none" stroke="#D9A36B" strokeOpacity=".6" strokeWidth=".9" />
      <path d="M29 29.4c-3.2-1.5-4.4-3.4-3.2-4.4 1-.8 2.5-.4 3.2.7.7-1.1 2.2-1.5 3.2-.7 1.2 1 0 2.9-3.2 4.4Z" fill="#F5DFC0" opacity=".92" />
      <Shine u={u} cx={18} cy={40} rx={1.8} ry={8} r={6} o={0.75} />
      <Shine u={u} cx={42} cy={35} rx={0.9} ry={4} o={0.25} />
    </Svg>
  );
}

export function RamenIcon(p: IconProps) {
  const u = useUid();
  return (
    <Svg {...p}>
      <Defs
        u={u}
        g={{
          bowl: ["#FF9376", "#C93A20", "#861C0C"],
          rim: ["#FFFFFF", "#E7D8BA"],
          noo: ["#FFEBA6", "#F0B23A", "#C98418"],
          egg: ["#FFFFFF", "#EFE4CE"],
          yolk: ["#FFD65E", "#F29A1A", "#D9700A"],
          lf: ["#B7ED84", "#4A9A38"],
          nori: ["#3F5C44", "#16261B"],
        }}
      />
      <Shadow u={u} cy={59} rx={22} />
      {/* chopsticks */}
      <line x1="40" y1="3" x2="25" y2="22" stroke="#E9C685" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="46" y1="6" x2="31" y2="24" stroke="#D9B06A" strokeWidth="2.8" strokeLinecap="round" />
      {/* noodle nest */}
      <path d="M10 31C14 16 26 12 32 12S50 16 54 31Z" fill={f(u, "noo")} />
      <path d="M13 28Q21 17 30 21M28 16Q40 14 49 24M17 30Q30 22 44 28M24 14q6 3 10 0" fill="none" stroke="#FFF3BE" strokeOpacity=".7" strokeWidth="1.3" strokeLinecap="round" />
      {/* toppings: nori, fish cake, soft-boiled egg, scallions */}
      <rect x="44" y="12" width="8" height="13" rx="1" fill={f(u, "nori")} transform="rotate(14 48 18)" />
      <path d="M46 15l2.2 8" stroke="#6C8F6F" strokeOpacity=".5" strokeWidth=".7" />
      <circle cx="23" cy="23" r="5.6" fill={f(u, "egg")} />
      <path d="M19.4 22.4q3-4.2 6.4-.4M20.4 25.6q2.6 1.8 5 -.2" fill="none" stroke="#F28B7B" strokeWidth="1.3" strokeLinecap="round" />
      <ellipse cx="41" cy="24" rx="7" ry="6" fill={f(u, "egg")} />
      <circle cx="41" cy="24.4" r="3.2" fill={f(u, "yolk")} />
      <Spec u={u} x={39.8} y={23.2} r={0.9} />
      {[[30, 19], [35, 26], [16, 28], [48, 29]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="none" stroke="#6FBF45" strokeWidth="1" />
      ))}
      <path d="M13 28c3-5 8-6 11-3-3 4-8 6-11 3Z" fill={f(u, "lf")} />
      {/* bowl with a printed band */}
      <path d="M6 32H58C58 48 46 58 32 58S6 48 6 32Z" fill={f(u, "bowl")} />
      <path d="M10 39.5Q32 46.5 54 39.5" fill="none" stroke="#FFE7C2" strokeOpacity=".85" strokeWidth="1.8" strokeDasharray="2 3" strokeLinecap="round" />
      <Shade u={u} cx={32} cy={56} rx={14} ry={1.6} o={0.3} c="#4A0E04" />
      <Shine u={u} cx={17} cy={44} rx={2.6} ry={8} r={20} o={0.5} />
      <rect x="4" y="29" width="56" height="6" rx="3" fill={f(u, "rim")} />
      <Shine u={u} cx={18} cy={31} rx={9} ry={0.8} o={0.7} />
    </Svg>
  );
}

export function DonutIcon(p: IconProps) {
  const u = useUid();
  const bumps = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [32 + 21.2 * Math.cos(a), 31 + 15.8 * Math.sin(a)] as const;
  });
  return (
    <Svg {...p}>
      <Defs u={u} g={{ dough: ["#F6C070", "#D08A32", "#9C5A1A"], ice: ["#FFC2D8", "#F077A6", "#D04880"] }} />
      <Shadow u={u} cy={58} rx={23} />
      <ellipse cx="32" cy="38" rx="26" ry="20" fill="#8A5018" />
      <ellipse cx="32" cy="36" rx="8" ry="6" fill="#6E3F12" />
      <path
        fillRule="evenodd"
        d="M6 32a26 20 0 0 1 52 0a26 20 0 0 1 -52 0Z M24 32a8 6 0 0 1 16 0a8 6 0 0 1 -16 0Z"
        fill={f(u, "dough")}
      />
      {/* icing: scalloped drips around the edge */}
      {bumps.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.7" fill="#EE6B9D" />
      ))}
      <path
        fillRule="evenodd"
        d="M10 31a22 16.5 0 0 1 44 0a22 16.5 0 0 1 -44 0Z M22 31a10 7.2 0 0 1 20 0a10 7.2 0 0 1 -20 0Z"
        fill={f(u, "ice")}
      />
      <ellipse cx="32" cy="31" rx="10.8" ry="7.8" fill="none" stroke="#B83A6E" strokeOpacity=".35" strokeWidth="1.6" filter={f(u, "s")} />
      {/* sprinkles */}
      {[[22, 22, "#FFF3DC", 30], [42, 21, "#7CC25B", -25], [49, 32, "#4CC9C0", 70], [15, 33, "#F2B63D", -60], [24, 41, "#FFF3DC", 20], [42, 41, "#F2B63D", -40], [32, 19.5, "#4CC9C0", 5], [47, 26, "#F2B63D", 50]].map(
        ([x, y, c, r], i) => (
          <g key={i} transform={`rotate(${r} ${x} ${y})`}>
            <rect x={Number(x) - 3.4} y={Number(y) - 0.9} width="7" height="2.6" rx="1.3" fill="#000" opacity=".18" />
            <rect x={Number(x) - 3.5} y={Number(y) - 1.4} width="7" height="2.6" rx="1.3" fill={String(c)} />
            <rect x={Number(x) - 2.6} y={Number(y) - 1} width="3" height=".7" rx=".35" fill="#fff" opacity=".6" />
          </g>
        ),
      )}
      <Shine u={u} cx={22} cy={20} rx={8} ry={2} r={-20} o={0.7} />
      <Shine u={u} cx={46} cy={36} rx={3} ry={1} r={30} o={0.3} />
    </Svg>
  );
}

export function TacoIcon(p: IconProps) {
  const u = useUid();
  return (
    <Svg {...p}>
      <Defs
        u={u}
        g={{
          shell: ["#FFDC7A", "#E0A02A", "#B26E12"],
          lt: ["#C8F28E", "#6DBB45", "#38852C"],
          tom: ["#FF8A70", "#D2321A", "#8A190A"],
          meat: ["#A9714A", "#5C3217"],
        }}
      />
      <Shadow u={u} cy={56} rx={25} />
      {/* fillings spilling out the top */}
      <path d="M13 26Q14 18 21 21T33 17T45 19T51 26Q40 22 32 24Q22 22 13 26Z" fill={f(u, "lt")} />
      <path d="M17 23q4-2 8 0M34 20q5-2 9 0" fill="none" stroke="#E4FFC0" strokeOpacity=".6" strokeWidth=".9" strokeLinecap="round" />
      <path d="M14 27Q22 22 32 25T50 27V30H14Z" fill={f(u, "meat")} />
      {[[20, 28], [27, 27], [36, 28], [44, 27]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.3" fill="#3A1B09" opacity=".5" />
      ))}
      {[[26, 24], [39, 23], [33, 27]].map(([x, y], i) => (
        <g key={i}>
          <rect x={Number(x) - 2.4} y={Number(y) - 2.4} width="4.8" height="4.8" rx="1.2" fill={f(u, "tom")} transform={`rotate(${i * 20} ${x} ${y})`} />
          <Spec u={u} x={Number(x) - 0.8} y={Number(y) - 0.9} r={0.6} o={0.7} />
        </g>
      ))}
      {[[19, 22, 8], [42, 21, -10], [30, 21, 4]].map(([x, y, r], i) => (
        <path key={i} d={`M${x} ${y}l6 2.4`} stroke="#FFC93D" strokeWidth="1.2" strokeLinecap="round" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {/* folded crisp shell */}
      <path d="M6 55A26 26 0 0 1 58 55Z" fill="#9A5A0C" />
      <path d="M6 52A26 26 0 0 1 58 52Z" fill={f(u, "shell")} />
      <path d="M9 50.5A23 23 0 0 1 55 50.5" fill="none" stroke="#B8761A" strokeOpacity=".5" strokeWidth="1.2" />
      <path d="M13 52A19 19 0 0 1 51 52" fill="none" stroke="#FFEAB0" strokeWidth="3" strokeLinecap="round" strokeOpacity=".8" />
      {[[16, 44], [24, 38], [38, 36], [47, 43], [32, 45]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r=".7" fill="#8A4F0C" opacity=".55" />
      ))}
      <Shine u={u} cx={18} cy={36} rx={7} ry={2} r={-40} o={0.6} />
    </Svg>
  );
}

export function FriesIcon(p: IconProps) {
  const u = useUid();
  return (
    <Svg {...p}>
      <Defs
        u={u}
        g={{ fry: ["#FFF0A2", "#F2B52A", "#C98216"], box: ["#FF8A72", "#D03A22", "#8E1E0E"], side: ["#C94026", "#7A1B0B"], lab: ["#FFFFFF", "#E8DCC0"] }}
      />
      <Shadow u={u} cy={60} rx={22} />
      {/* fries, each with a browned tip and salt */}
      {[
        [11, 10, 28, -10, 14],
        [18, 6, 32, 0, 21],
        [26, 8, 30, 4, 29],
        [33, 5, 33, 8, 36],
        [39, 11, 27, 14, 42],
      ].map(([x, y, h, r, cx], i) => (
        <g key={i} transform={`rotate(${r} ${cx} 24)`}>
          <rect x={x} y={y} width="6" height={h} rx="2" fill={f(u, "fry")} />
          <rect x={Number(x) + 0.8} y={y} width="1.2" height={Number(h) - 4} rx=".6" fill="#fff" opacity=".35" />
          <rect x={x} y={y} width="6" height="3" rx="1.5" fill="#B5700F" opacity=".45" />
          <rect x={Number(x) + 3.4} y={Number(y) + 9 + i} width="1.1" height="1.1" fill="#fff" opacity=".9" />
        </g>
      ))}
      {/* carton */}
      <path d="M42 35L54 31L50 55L38 59Z" fill={f(u, "side")} />
      <path d="M10 35H42L38 59H14Z" fill={f(u, "box")} />
      <path d="M10 35l2 2.4 3-2.4 3 2.4 3-2.4 3 2.4 3-2.4 3 2.4 3-2.4 2.6 2" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
      <Shade u={u} cx={26} cy={36} rx={14} ry={1.8} o={0.35} c="#5A1006" />
      <circle cx="26" cy="47" r="6" fill={f(u, "lab")} />
      <circle cx="26" cy="47" r="2.4" fill="#E8604C" />
      <Shine u={u} cx={15} cy={46} rx={1.6} ry={8} r={6} o={0.55} />
    </Svg>
  );
}

export function IceCreamIcon(p: IconProps) {
  const u = useUid();
  return (
    <Svg {...p}>
      <Defs
        u={u}
        g={{ cone: ["#FFD184", "#D8933A", "#9A5A14"], sc: ["#FFD0E0", "#F27AA8", "#CF4A80"], ch: ["#FF8A70", "#C5281A", "#7A1006"] }}
      />
      <Shadow u={u} cy={62} rx={7} ry={1.8} />
      {/* waffle cone */}
      <path d="M19 33H45L32 62Z" fill={f(u, "cone")} />
      <path d="M24 33l10 22M32 33l-8 18M40 33l-10 24M21 40h22M24 47h16" fill="none" stroke="#8A4E0E" strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M21 34l9 23" stroke="#FFE7B0" strokeOpacity=".4" strokeWidth="1.2" strokeLinecap="round" />
      <Shade u={u} cx={32} cy={34.5} rx={13} ry={2} o={0.4} c="#4A2000" />
      {/* scoop with a ruffled skirt, drizzle and sprinkles */}
      <circle cx="32" cy="24" r="15" fill={f(u, "sc")} />
      <path d="M17 26H47Q47 36 43 34Q40 41 36 34Q32 39 28 34Q24 41 21 34Q17 36 17 26Z" fill="#E8689C" />
      <path d="M19 27q3 3 6 0t6 0t6 0t6 0" fill="none" stroke="#FFC4D8" strokeOpacity=".6" strokeWidth="1" strokeLinecap="round" />
      <path d="M20 19q4-3 6 0t6-1t6 1" fill="none" stroke="#6B3410" strokeWidth="2.2" strokeLinecap="round" />
      {[[24, 24, "#FFF3DC", 20], [36, 22, "#FFE066", -30], [30, 28, "#7CC25B", 60], [40, 27, "#FFF3DC", -10]].map(([x, y, c, r], i) => (
        <rect key={i} x={Number(x) - 2} y={Number(y) - 0.7} width="4" height="1.5" rx=".75" fill={String(c)} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <Shine u={u} cx={25} cy={17} rx={5} ry={3} r={-30} o={0.7} />
      {/* cherry */}
      <circle cx="32" cy="8.6" r="4.4" fill={f(u, "ch")} />
      <Spec u={u} x={30.6} y={7.2} r={1.1} o={0.8} />
      <path d="M32 4.6q3.6-3 7-1.8" fill="none" stroke="#5E9E3A" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export const FOOD_ICONS = {
  pizza: PizzaIcon,
  burger: BurgerIcon,
  coffee: CoffeeIcon,
  ramen: RamenIcon,
  donut: DonutIcon,
  taco: TacoIcon,
  fries: FriesIcon,
  iceCream: IceCreamIcon,
};

/* ---------- Floating 3D backdrop ---------- */

type Item = {
  Icon: ComponentType<IconProps>;
  left: string;
  top: string;
  size: number;
  rotate: number;
  k: number; // parallax strength in px (negative = opposite direction)
  blur: number; // depth of field
  opacity: number;
  dur: number; // bob duration in seconds
  delay: number;
};

// Near icons are big and sharp, far icons are small, faint and blurred.
const ITEMS: Item[] = [
  { Icon: PizzaIcon, left: "6%", top: "12%", size: 104, rotate: -14, k: -26, blur: 0, opacity: 1, dur: 7, delay: 0 },
  { Icon: CoffeeIcon, left: "82%", top: "9%", size: 86, rotate: 10, k: 20, blur: 0, opacity: 1, dur: 8, delay: -2 },
  { Icon: BurgerIcon, left: "86%", top: "56%", size: 124, rotate: 12, k: -34, blur: 1.5, opacity: 0.95, dur: 9, delay: -4 },
  { Icon: RamenIcon, left: "3%", top: "60%", size: 130, rotate: -8, k: 30, blur: 1.5, opacity: 0.95, dur: 8.5, delay: -1 },
  { Icon: DonutIcon, left: "70%", top: "84%", size: 78, rotate: 20, k: -18, blur: 0, opacity: 1, dur: 6.5, delay: -3 },
  { Icon: TacoIcon, left: "20%", top: "84%", size: 82, rotate: -18, k: 16, blur: 0, opacity: 1, dur: 7.5, delay: -5 },
  { Icon: FriesIcon, left: "44%", top: "3%", size: 64, rotate: 8, k: -12, blur: 2.5, opacity: 0.5, dur: 10, delay: -6 },
  { Icon: IceCreamIcon, left: "56%", top: "90%", size: 62, rotate: -10, k: 12, blur: 2.5, opacity: 0.5, dur: 9.5, delay: -2 },
  { Icon: DonutIcon, left: "18%", top: "36%", size: 46, rotate: 30, k: -8, blur: 3, opacity: 0.4, dur: 11, delay: -7 },
  { Icon: CoffeeIcon, left: "76%", top: "34%", size: 48, rotate: -16, k: 8, blur: 3, opacity: 0.4, dur: 12, delay: -3 },
  { Icon: TacoIcon, left: "92%", top: "30%", size: 54, rotate: 14, k: -10, blur: 2.5, opacity: 0.45, dur: 10.5, delay: -8 },
  { Icon: PizzaIcon, left: "30%", top: "92%", size: 50, rotate: 24, k: 10, blur: 3, opacity: 0.4, dur: 11.5, delay: -1 },
];

/**
 * Floating food icons. Place it inside a positioned parent.
 * If the parent sets CSS variables --mx and --my (-1 to 1), the icons shift
 * and turn toward the cursor at different depths; otherwise they just bob and sway.
 */
export function FloatingFoods() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes food-bob {
          0%, 100% { transform: translateY(0) rotate(var(--r)) perspective(600px) rotateY(-14deg); }
          50%      { transform: translateY(-14px) rotate(calc(var(--r) + 4deg)) perspective(600px) rotateY(14deg); }
        }
        .food-bob { animation: food-bob var(--dur) ease-in-out infinite; animation-delay: var(--delay); }
        @media (prefers-reduced-motion: reduce) {
          .food-bob { animation: none; transform: rotate(var(--r)); }
        }
      `}</style>
      {ITEMS.map(({ Icon, left, top, size, rotate, k, blur, opacity, dur, delay }, i) => (
        <div
          key={i}
          className="absolute transition-transform duration-300 ease-out"
          style={{
            left,
            top,
            transform: `translate3d(calc(var(--mx, 0) * ${k}px), calc(var(--my, 0) * ${k}px), 0)`,
          }}
        >
          <div
            className="food-bob"
            style={
              {
                "--r": `${rotate}deg`,
                "--dur": `${dur}s`,
                "--delay": `${delay}s`,
                opacity,
                filter: blur ? `blur(${blur}px)` : undefined,
              } as React.CSSProperties
            }
          >
            <div
              className="transition-transform duration-300 ease-out"
              style={{
                transform:
                  "perspective(600px) rotateY(calc(var(--mx, 0) * 24deg)) rotateX(calc(var(--my, 0) * -24deg))",
              }}
            >
              <Icon size={size} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}