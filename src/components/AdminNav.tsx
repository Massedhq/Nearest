"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { ALL_MENU_ITEMS, SECTIONS } from "@/lib/owner-menu-items";

/**
 * The admin menu. The main owner sees everything; staff see everything but the main owner's pages; other owners
 * (Kisses, Lakeesha) see only `allowed` — their simple menu plus what the main owner added for them (2026-11-26).
 */
export function AdminNav({ isMain = false, allowed }: { isMain?: boolean; allowed?: string[] }) {
  const path = usePathname();
  const items = ALL_MENU_ITEMS.filter((it) => (isMain ? true : allowed ? allowed.includes(it.href) && !it.mainOnly : !it.mainOnly));
  const nav = SECTIONS.map((h) => [h, items.filter((it) => it.section === h).map((it) => [it.label, it.icon, it.href])] as const).filter(([, list]) => list.length > 0);
  return (
    <>
      {nav.map(([head, items]) => (
        <div key={head}>
          <div className="navh">{head}</div>
          {items.map(([label, icon, href]) => {
            const on = href === "/admin" ? path === "/admin" : path.startsWith(href) && !(href === "/admin/field" && (path.startsWith("/admin/field/orgs") || path.startsWith("/admin/field/org/")));
            return (
              <Link key={href} href={href} className={`nav${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
                <Icon name={icon as Parameters<typeof Icon>[0]["name"]} />{label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

export const SECTION_TITLES: Record<string, [string, string]> = {
};
