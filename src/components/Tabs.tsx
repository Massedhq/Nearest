import Link from "next/link";
import { Icon } from "./Icon";

const STUDENT = [
  { label: "Explore", icon: "compass", href: "/home" },
  { label: "Bookings", icon: "cal", href: "/bookings" },
  { label: "Messages", icon: "msg", href: "/messages" },
  { label: "Credits", icon: "wallet", href: "/credits" },
  { label: "Account", icon: "user", href: "/account" },
];
const PRO = [
  { label: "Today", icon: "home", href: "/pro/home" },
  { label: "Calendar", icon: "cal", href: "/pro/calendar" },
  { label: "Messages", icon: "msg", href: "/pro/messages" },
  { label: "Earnings", icon: "wallet", href: "/pro/earnings" },
  { label: "Business", icon: "store", href: "/pro/business" },
];

export function Tabs({ kind, active }: { kind: "student" | "pro"; active: string }) {
  const items = kind === "student" ? STUDENT : PRO;
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`tab${t.label === active ? " on" : ""}`} aria-current={t.label === active ? "page" : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
