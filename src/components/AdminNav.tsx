"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const NAV: [string, [string, string, string][]][] = [
  ["Overview", [["Command Center", "home", "/admin"], ["Founding 750", "sparkle", "/admin/founding"], ["DFW Coverage", "map", "/admin/coverage"]]],
  ["People", [["Students", "users", "/admin/students"], ["Schools", "school", "/admin/schools"], ["Professionals", "store", "/admin/professionals"], ["Verification Queue", "shield", "/admin/verification"]]],
  ["Operations", [["Bookings", "cal", "/admin/bookings"], ["Incident Review", "flag", "/admin/incidents"], ["Enforcement", "gavel", "/admin/enforcement"], ["Appeals", "file", "/admin/appeals"]]],
  ["Business", [["Money", "wallet", "/admin/money"], ["Sales Track", "chart", "/admin/sales"], ["Marketing", "chart", "/admin/marketing"], ["Marketplace", "grid", "/admin/marketplace"]]],
  ["Owner", [["Rules & Settings", "gear", "/admin/settings"], ["Team & Activity Log", "log", "/admin/team"]]],
];

export function AdminNav() {
  const path = usePathname();
  return (
    <>
      {NAV.map(([head, items]) => (
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
