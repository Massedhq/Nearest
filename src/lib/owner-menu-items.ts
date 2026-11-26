/**
 * Admin menu items (shared by AdminNav on the client and the server-side page guard). `mainOnly` items are the main
 * owner's alone and can never be added to another owner's menu.
 */
export type MenuItem = { section: string; label: string; icon: string; href: string; mainOnly?: boolean };

export const ALL_MENU_ITEMS: MenuItem[] = [
  { section: "Overview", label: "Command Center", icon: "home", href: "/admin" },
  { section: "Overview", label: "First In", icon: "sparkle", href: "/admin/founding" },
  { section: "Overview", label: "Coverage", icon: "map", href: "/admin/coverage" },
  { section: "Overview", label: "Service coverage", icon: "chart", href: "/admin/service-coverage" },
  { section: "Overview", label: "Student demand", icon: "users", href: "/admin/demand" },
  { section: "Overview", label: "Nearest LIVE & Digital Rewards", icon: "chart", href: "/admin/live", mainOnly: true },
  { section: "Overview", label: "Live vote map", icon: "map", href: "/live?back=/admin" },
  { section: "People", label: "Students", icon: "users", href: "/admin/students" },
  { section: "People", label: "Schools", icon: "school", href: "/admin/schools" },
  { section: "People", label: "Professionals", icon: "store", href: "/admin/professionals" },
  { section: "People", label: "Verification Queue", icon: "shield", href: "/admin/verification" },
  { section: "People", label: "Enrollment holds", icon: "flag", href: "/admin/enrollment-holds" },
  { section: "People", label: "Launch campaign", icon: "sparkle", href: "/admin/campaign" },
  { section: "People", label: "Supporters", icon: "users", href: "/admin/supporters" },
  { section: "Operations", label: "Bookings", icon: "cal", href: "/admin/bookings" },
  { section: "Operations", label: "Incident Review", icon: "flag", href: "/admin/incidents" },
  { section: "Operations", label: "Enforcement", icon: "gavel", href: "/admin/enforcement" },
  { section: "Operations", label: "Appeals", icon: "file", href: "/admin/appeals" },
  { section: "Operations", label: "Problem reports", icon: "flag", href: "/admin/reports" },
  { section: "Operations", label: "Find by photo", icon: "camera", href: "/admin/photo-match" },
  { section: "Professional Outreach", label: "Outreach", icon: "users", href: "/admin/outreach" },
  { section: "Professional Outreach", label: "Field team", icon: "pin", href: "/admin/field" },
  { section: "Professional Outreach", label: "Organizations & cards", icon: "pin", href: "/admin/field/orgs" },
  { section: "Professional Outreach", label: "Areas", icon: "map", href: "/admin/areas" },
  { section: "Professional Outreach", label: "Outreach meetings", icon: "cal", href: "/admin/meet" },
  { section: "Professional Outreach", label: "Partner pages", icon: "link", href: "/admin/partners", mainOnly: true },
  { section: "Professional Outreach", label: "Learn at Nearest", icon: "school", href: "/admin/learn" },
  { section: "Professional Outreach", label: "Notifications", icon: "bell", href: "/admin/notifications" },
  { section: "Business", label: "Money", icon: "wallet", href: "/admin/money", mainOnly: true },
  { section: "Business", label: "Sales Track", icon: "chart", href: "/admin/sales" },
  { section: "Business", label: "Marketing", icon: "chart", href: "/admin/marketing" },
  { section: "Business", label: "Leaderboard", icon: "star", href: "/admin/leaderboard" },
  { section: "Business", label: "Profile examples", icon: "users", href: "/admin/examples" },
  { section: "Business", label: "Marketplace", icon: "grid", href: "/admin/marketplace" },
  { section: "Business", label: "Pricing intelligence", icon: "chart", href: "/admin/pricing", mainOnly: true },
  { section: "Business", label: "Bundle Me", icon: "grid", href: "/admin/bundles" },
  { section: "Business", label: "My card report", icon: "chart", href: "/admin/my-vouchers" },
  { section: "Business", label: "Nearest Cards", icon: "wallet", href: "/admin/cards", mainOnly: true },
  { section: "Business", label: "Sales Board", icon: "users", href: "/admin/sales-board", mainOnly: true },
  { section: "Business", label: "Insurance interest", icon: "shield", href: "/admin/insurance" },
  { section: "Owner", label: "Launch readiness", icon: "check", href: "/admin/launch" },
  { section: "Owner", label: "Rules & Settings", icon: "gear", href: "/admin/settings" },
  { section: "Owner", label: "Team & Activity Log", icon: "log", href: "/admin/team" },
  { section: "Help", label: "How it works", icon: "file", href: "/admin/guide" },
];

export const SECTIONS = ["Overview", "People", "Operations", "Professional Outreach", "Business", "Owner", "Help"];

/** What Kisses and Lakeesha start with (owner's list, 2026-11-26). Learn at Nearest is view-only for them. */
export const SIMPLE_MENU = [
  "/admin", "/admin/founding", "/admin/coverage", "/admin/service-coverage", "/admin/demand", "/live?back=/admin",
  "/admin/outreach", "/admin/field/orgs", "/admin/areas", "/admin/learn",
  "/admin/sales", "/admin/examples", "/admin/marketplace", "/admin/my-vouchers", "/admin/insurance",
  "/admin/guide",
];
