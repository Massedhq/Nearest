/** Sample partner used by both demos. Prices are what clients pay (the $5 booking fee is already included). */
export type DemoService = { id: string; cat: string; name: string; price: number; mins: number; img: string; adds: [string, string, number][]; request?: boolean; adult?: boolean };

export const DEMO = {
  name: "Ava Monroe",
  business: "Ava Monroe Beauty Studio",
  headline: "Beauty educator · Brows, lashes & glam",
  city: "Corona, CA",
  slug: "avamonroe",
  travelFee: 45,
  travelMiles: 15,
  bundlePct: 10,
};

export const SERVICES: DemoService[] = [
  { id: "brow", cat: "Brows", name: "Brow lamination + tint", price: 85, mins: 60, img: "v-brows", adds: [["tint", "Brow tint", 15], ["lip", "Lip wax", 10]] },
  { id: "wax", cat: "Brows", name: "Brow shape + wax", price: 40, mins: 30, img: "p-eyesq", adds: [] },
  { id: "lift", cat: "Lashes", name: "Lash lift + tint", price: 75, mins: 45, img: "p-eyesq", adds: [] },
  { id: "classic", cat: "Lashes", name: "Classic lash full set", price: 120, mins: 120, img: "p-face", adds: [["btm", "Bottom lashes", 20]], request: true },
  { id: "glam", cat: "Makeup", name: "Soft glam makeup", price: 110, mins: 60, img: "p-lips", adds: [["strip", "Lash strip", 10]] },
  { id: "gelx", cat: "Nails", name: "Gel-X full set", price: 65, mins: 90, img: "p-chrome", adds: [["chrome", "Chrome", 10], ["art", "Hand-painted art", 15]] },
  { id: "pedi", cat: "Nails", name: "Pedicure", price: 45, mins: 45, img: "p-pedi", adds: [], adult: false },
];

export const PORTFOLIO = [
  { img: "p-eyesq", svc: "lift" }, { img: "p-face", svc: "glam" }, { img: "v-brows", svc: "brow", video: true },
  { img: "p-chrome", svc: "gelx" }, { img: "p-lips", svc: "glam" }, { img: "p-french", svc: "gelx" },
  { img: "p-floral", svc: "gelx" }, { img: "p-pedi", svc: "pedi" }, { img: "v-glam", svc: "glam", video: true },
] as { img: string; svc: string; video?: boolean }[];

export const VIDEOS = [
  { img: "v-booked", title: "How to get fully booked in 2027", len: "4:12" },
  { img: "v-brows", title: "Fuller brows in 60 seconds", len: "0:58" },
  { img: "v-glam", title: "My 3-step soft glam lip", len: "2:30" },
];

export const LINKS = [
  { img: "v-french", title: "Shop my brow stain line", note: "Black · Medium Brown · Light Brown", url: "avamonroebeauty.com/shop" },
  { img: "v-nails", title: "Amazon must-haves", note: "The tools I use every day", url: "amazon.com/shop/avamonroe" },
  { img: "v-booked", title: "Get Booked Academy", note: "My course for beauty pros", url: "getbookedacademy.com" },
];

export const MODEL_CALLS = [
  { id: "lam", name: "Brow lamination model", price: 40, was: 85, img: "v-brows", about: "Filming a new lamination technique for my class. Bare brows preferred.", date: "Thu, Nov 5", left: "3 spots left", times: ["11:00 AM", "1:00 PM", "3:00 PM"] },
  { id: "glam", name: "Soft glam model", price: 55, was: 110, img: "v-glam", about: "Photo shoot for my portfolio — you keep the look for the day.", date: "Sat, Nov 7", left: "2 spots left", times: ["10:00 AM", "12:30 PM"] },
];

export const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
