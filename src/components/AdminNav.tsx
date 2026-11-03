"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const NAV: [string, [string, string, string][]][] = [
  ["Overview", [["Command Center", "home", "/admin"], ["First In", "sparkle", "/admin/founding"], ["Coverage", "map", "/admin/coverage"], ["Service coverage", "chart", "/admin/service-coverage"]]],
  ["People", [["Students", "users", "/admin/students"], ["Schools", "school", "/admin/schools"], ["Professionals", "store", "/admin/professionals"], ["Verification Queue", "shield", "/admin/verification"], ["Enrollment holds", "flag", "/admin/enrollment-holds"], ["Launch campaign", "sparkle", "/admin/campaign"], ["Supporters", "users", "/admin/supporters"]]],
  ["Operations", [["Bookings", "cal", "/admin/bookings"], ["Incident Review", "flag", "/admin/incidents"], ["Enforcement", "gavel", "/admin/enforcement"], ["Appeals", "file", "/admin/appeals"], ["Problem reports", "flag", "/admin/reports"], ["Find by photo", "camera", "/admin/photo-match"]]],
  ["Professional Outreach", [["Outreach", "users", "/admin/outreach"], ["Outreach meetings", "cal", "/admin/meet"], ["Partner pages", "link", "/admin/partners"], ["Notifications", "bell", "/admin/notifications"]]],
  ["Business", [["Money", "wallet", "/admin/money"], ["Sales Track", "chart", "/admin/sales"], ["Marketing", "chart", "/admin/marketing"], ["Leaderboard", "star", "/admin/leaderboard"], ["Profile examples", "users", "/admin/examples"], ["Marketplace", "grid", "/admin/marketplace"], ["Pricing intelligence", "chart", "/admin/pricing"], ["Bundle Me", "grid", "/admin/bundles"], ["Nearest Cards", "wallet", "/admin/cards"], ["Insurance interest", "shield", "/admin/insurance"]]],
  ["Owner", [["Launch readiness", "check", "/admin/launch"], ["Rules & Settings", "gear", "/admin/settings"], ["Team & Activity Log", "log", "/admin/team"]]],
  ["Help", [["How it works", "file", "/admin/guide"]]],
];

export function AdminNav({ isMain = false }: { isMain?: boolean }) {
  const path = usePathname();
  // Sales Board is the main owner's alone (also enforced on the server).
  // Partner pages and Nearest Cards are the main owner's alone — hidden from every other admin.
  const MAIN_ONLY = ["/admin/partners", "/admin/cards"];
  const nav = isMain
    ? NAV.map(([h, items]) => [h, h === "Business" ? [...items, ["Sales Board", "users", "/admin/sales-board"]] : items] as (typeof NAV)[number])
    : NAV.map(([h, items]) => [h, (items as string[][]).filter((it) => !MAIN_ONLY.includes(it[2]))] as unknown as (typeof NAV)[number]);
  return (
    <>
      {nav.map(([head, items]) => (
        <div key={head}>
          <div className="navh">{head}</div>
          {items.map(([label, icon, href]) => {
            const on = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
                <Icon name={icon} />{label}
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
