const PATHS: Record<string, string> = {
  "pin": "<path d=\"M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z\"/><circle cx=\"12\" cy=\"9.5\" r=\"2.5\"/>",
  "bolt": "<path d=\"M13 2 4 14h7l-1 8 9-12h-7z\"/>",
  "school": "<path d=\"M3 9l9-5 9 5-9 5z\"/><path d=\"M7 11.2V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.8\"/><path d=\"M21 9v5\"/>",
  "dollar": "<path d=\"M12 3v18\"/><path d=\"M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3S9.5 10.5 12 11s4.5 1.3 4.5 3.2-2 3.3-4.5 3.3-4.5-1.3-4.5-3\"/>",
  "hand": "<path d=\"M8 13V5.5a1.5 1.5 0 0 1 3 0V11\"/><path d=\"M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5\"/><path d=\"M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.3a6 6 0 0 1-4.9-2.6L2.7 15a1.5 1.5 0 0 1 2.5-1.7L8 16\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/>",
  "heart": "<path d=\"M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z\"/>",
  "star": "<path d=\"m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z\"/>",
  "check": "<path d=\"m5 12.5 4.5 4.5L19 7.5\"/>",
  "shield": "<path d=\"M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z\"/><path d=\"m9 12 2.2 2.2L15.5 10\"/>",
  "back": "<path d=\"M15 5l-7 7 7 7\"/>",
  "right": "<path d=\"m9 5 7 7-7 7\"/>",
  "down": "<path d=\"m5 9 7 7 7-7\"/>",
  "cal": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2.5\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/>",
  "msg": "<path d=\"M4 5.5h16v10.5H9l-5 4z\"/>",
  "wallet": "<path d=\"M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3\"/><rect x=\"4\" y=\"8\" width=\"16.5\" height=\"11.5\" rx=\"2.5\"/><circle cx=\"16\" cy=\"13.8\" r=\"1.2\"/>",
  "user": "<circle cx=\"12\" cy=\"8.5\" r=\"4\"/><path d=\"M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5\"/>",
  "compass": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m15.5 8.5-2 5-5 2 2-5z\"/>",
  "camera": "<path d=\"M4 8h3.5l1.5-2.5h6L16.5 8H20v11.5H4z\"/><circle cx=\"12\" cy=\"13.3\" r=\"3.5\"/>",
  "bell": "<path d=\"M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z\"/><path d=\"M10 20.5h4\"/>",
  "filter": "<path d=\"M4 6h16M7 12h10M10 18h4\"/>",
  "x": "<path d=\"M6 6l12 12M18 6 6 18\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7.5V12l3 2\"/>",
  "upload": "<path d=\"M12 16V4M7 9l5-5 5 5\"/><path d=\"M4.5 15v4.5h15V15\"/>",
  "lock": "<rect x=\"5\" y=\"10.5\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 10.5V7.5a4 4 0 0 1 8 0v3\"/>",
  "alert": "<path d=\"M12 3.5 2.5 20h19z\"/><path d=\"M12 10v4.5M12 17.5v.01\"/>",
  "grid": "<rect x=\"4\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"4\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/>",
  "users": "<circle cx=\"9\" cy=\"8.5\" r=\"3.5\"/><path d=\"M2.5 19.5c.9-3.3 3.3-5 6.5-5s5.6 1.7 6.5 5\"/><path d=\"M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3 2.2 3.5 4.7\"/>",
  "chart": "<path d=\"M4 20V4M4 20h16\"/><path d=\"M8 16v-5M12 16V8M16 16v-3\"/>",
  "gear": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2\"/><circle cx=\"12\" cy=\"12\" r=\"6.5\"/>",
  "map": "<path d=\"M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z\"/><path d=\"M9 4.5v13M15 6.5v13\"/>",
  "flag": "<path d=\"M5 21V4M5 4.5h11l-2 4 2 4H5\"/>",
  "plus": "<path d=\"M12 5v14M5 12h14\"/>",
  "eye": "<path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "card": "<rect x=\"3\" y=\"5.5\" width=\"18\" height=\"13\" rx=\"2.5\"/><path d=\"M3 10h18M7 15h3\"/>",
  "file": "<path d=\"M6 3h8l4 4v14H6z\"/><path d=\"M14 3v4h4M9 12h6M9 16h6\"/>",
  "insta": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"4.5\"/><circle cx=\"12\" cy=\"12\" r=\"3.6\"/><path d=\"M16.8 7.2v.01\"/>",
  "video": "<rect x=\"3\" y=\"6\" width=\"13\" height=\"12\" rx=\"2\"/><path d=\"m16 10.5 5-3v9l-5-3z\"/>",
  "link": "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>",
  "home": "<path d=\"M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z\"/>",
  "switch": "<path d=\"M4 8h13l-3.5-3.5M20 16H7l3.5 3.5\"/>",
  "send": "<path d=\"M21 3 10 14M21 3l-6.5 18-4-7.5L3 9.5z\"/>",
  "phone": "<rect x=\"7\" y=\"2.5\" width=\"10\" height=\"19\" rx=\"2.5\"/><path d=\"M11 18.5h2\"/>",
  "mail": "<rect x=\"3\" y=\"5.5\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"m3.5 6.5 8.5 6.5 8.5-6.5\"/>",
  "id": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2.5\"/><circle cx=\"8.5\" cy=\"11\" r=\"2.2\"/><path d=\"M5.5 16.2c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14 10h4.5M14 13.5h3\"/>",
  "face": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9 10v.5M15 10v.5M8.8 15c.8 1 1.9 1.5 3.2 1.5s2.4-.5 3.2-1.5\"/>",
  "drag": "<path d=\"M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01\"/>",
  "trash": "<path d=\"M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13\"/>",
  "gavel": "<path d=\"m14 4 6 6M11.5 6.5l6 6M13 5l-5.5 5.5 6 6L19 11M9.5 12.5 3 19l2 2 6.5-6.5M3 21h9\"/>",
  "car": "<path d=\"M5 16.5V12l2-5h10l2 5v4.5M3.5 16.5h17v2.5H3.5z\"/><path d=\"M5 12h14M7.5 14.3h.01M16.5 14.3h.01\"/>",
  "store": "<path d=\"M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5\"/>",
  "text": "<path d=\"M5 6h14M12 6v13\"/>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z\"/>",
  "log": "<path d=\"M5 4h14v16H5zM8.5 8h7M8.5 12h7M8.5 16h4\"/>",
  "sparkle": "<path d=\"M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18\"/>",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = "m" }: { name: string; size?: "s" | "m" | "l" | "xl" }) {
  const px = { s: 15, m: 20, l: 28, xl: 44 }[size];
  return (
    <svg
      className={`i ${size === "m" ? "" : size}`}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? "" }}
    />
  );
}
