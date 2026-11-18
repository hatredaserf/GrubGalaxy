"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONFIG } from "@/lib/config";

const LINKS = [
  { href: CONFIG.ROUTES.DASHBOARD, label: "Positions" },
  { href: CONFIG.ROUTES.FOOD_ITEMS, label: "Food items" },
  { href: CONFIG.ROUTES.CATEGORIES, label: "Categories" },
  { href: CONFIG.ROUTES.RESTAURANTS, label: "Restaurants" },
  { href: CONFIG.ROUTES.ORDERS, label: "Orders" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}