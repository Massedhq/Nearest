import type { Guide } from "./guides";

const D = "2026-10-20";

export const GUIDES_A: Guide[] = [
  {
    slug: "get-more-beauty-clients-without-ads",
    title: "How to Get More Beauty Clients Without Paying for Ads",
    h1: "How to get more beauty clients without paying for ads",
    description: "A step-by-step plan for nail techs, stylists, braiders, barbers and lash artists to fill their books using referrals, local search and content.",
    intent: "Independent beauty professional wants more clients but has little or no ad budget.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    summary: "Most new clients for independent beauty professionals come from three free sources: people who already know your work, people searching nearby, and people who see your results on social media. This plan works through all three in a month, in order of effort.",
    sections: [
      { id: "foundation", h: "Step 1: Fix the foundation (days 1–3)", blocks: [
        "Before you ask anyone to book, make booking easy. Every channel you'll use later sends people to one place, so that place has to answer their questions.",
        { ul: [
          "One booking link. Choose the tool you'll actually keep and put the same link in every bio.",
          "Prices on every service. \"DM for price\" loses people who are comparing options at 11 p.m.",
          "Durations and what's included. \"Knotless, mid-back, small — 6 hours, hair included\" beats \"Knotless braids.\"",
          "Your area, not your address. A neighborhood or service area is enough until someone books.",
          "Three to six of your best recent photos, cropped clean, in good light.",
          "Your policies in two lines: deposit, late arrival, cancellation.",
        ] },
        { note: "Test it: ask a friend to book you from your Instagram bio without help. Every question they ask is a fix to make." },
      ] },
      { id: "warm-network", h: "Step 2: Tell the people who already trust you (days 3–7)", blocks: [
        "Your first wave of bookings is almost always warm: friends, family, coworkers, classmates and past clients. Don't announce vaguely that you're \"taking clients\" — make a specific offer.",
        { copy: "Hi Maya! I'm opening my books for October — I have four spots for silk presses on Thursday and Saturday afternoons. $65, about 2 hours. If you or anyone you know wants one, here's my link: [link]. A share would mean a lot!", label: "Message you can adapt" },
        "Send it personally, not as a mass broadcast. Personal messages get replies; broadcasts get scrolled past.",
      ] },
      { id: "referrals", h: "Step 3: Build a referral habit (ongoing)", blocks: [
        "A referral from a happy client carries trust you can't buy. The trick is to ask at the right moment — right after the client sees the result — and to make sharing effortless.",
        { ol: [
          "When they love the result, say: \"I'm building my book — if anyone asks who did this, I'd love for you to send them my way.\"",
          "Hand them something to share: a card with a QR code, or text them your link.",
          "Reward it simply: a small credit or free add-on for both people, for new clients only, with an end date.",
          "Thank every referrer by name. People keep referring when they feel noticed.",
        ] },
      ] },
      { id: "local-search", h: "Step 4: Show up in local search (week 2)", blocks: [
        "People search \"lash extensions near me\" when they're ready to book. A complete Google Business Profile is the most valuable free listing for most beauty businesses.",
        { ul: [
          "Claim and verify your profile; choose the most specific category that fits.",
          "Set a service area if you work from home or travel, so your address stays private.",
          "Add each service with a price or range, your hours and your booking link.",
          "Post a photo or update every week.",
          "Ask every happy client for a review that mentions the service they got.",
        ] },
        { note: "Search visibility takes time and isn't guaranteed for anyone. A complete, active profile gives you the best chance." },
      ] },
      { id: "content", h: "Step 5: Post results with a purpose (weeks 2–4)", blocks: [
        "Post fewer, better things, each with a job to do. Rotate four types:",
        { table: { head: ["Type", "What it shows", "Example"], rows: [
          ["Result", "The finished look, named the way clients search", "\"Short almond, milky white with chrome — 90 min\""],
          ["Process", "One step that shows skill", "Clip of your cuticle prep or parting"],
          ["Answer", "A question clients ask you", "\"How long do knotless braids last?\""],
          ["Opening", "A specific available time", "\"2 spots Thursday after 4 PM\""],
        ] } },
        "End every post with one next step — usually your booking link.",
      ] },
      { id: "partners", h: "Step 6: Borrow an audience nearby (week 3)", blocks: [
        "Local businesses with the same clients but a different service make great partners: boutiques, photographers, dance studios, event planners, nearby barbers or stylists who don't do your service. Offer something useful — a joint giveaway, a referral swap, a stack of cards at their counter — and keep it simple.",
      ] },
      { id: "track", h: "Step 7: Track what works (end of month)", blocks: [
        "Ask every new client how they found you and write it down. After a month you'll know which two channels bring bookings. Do more of those and drop the rest.",
      ] },
      { id: "nearest", h: "Where Nearest fits", blocks: [
        "If your clients include students and you work in a city where Nearest is live, Nearest is one more free channel: verified students can find you, request a time and pay inside the app, and you keep your existing booking tools for everyone else. It's a discovery channel, not a guarantee of bookings.",
      ] },
    ],
    faq: [
      { q: "How long does it take to see results without ads?", a: "Warm-network and referral bookings can come within days. Local search and content usually take several weeks of consistent effort to build momentum." },
      { q: "Should I discount to get my first clients?", a: "A few limited intro or model appointments are fine. Avoid permanent discounts; they attract price shoppers and are hard to undo." },
    ],
    related: ["first-10-clients-new-hairstylist", "get-beauty-business-found-on-google", "why-beauty-business-not-getting-bookings"],
  },
  {
    slug: "where-to-list-beauty-business-free",
    title: "Where to List Your Beauty Business for Free",
    h1: "Where to list your beauty business for free",
    description: "A fair comparison of free listing options for beauty and wellness professionals — what each is good for, what it costs later, and how to choose.",
    intent: "Professional wants free places to list services and understand trade-offs.",
    topic: "Listings & visibility", audience: "pro", published: D, updated: D,
    summary: "The strongest free listings are the ones your clients already use to search: Google, Apple and Bing maps, your social profiles, and a booking or marketplace platform that fits your audience. Free to list rarely means free forever, so compare what each charges per booking.",
    sections: [
      { id: "types", h: "Three kinds of listings", blocks: [
        { ul: [
          "Map and search listings (Google Business Profile, Apple Business Connect, Bing Places): people find you when they search nearby. Free to create.",
          "Social profiles (Instagram, TikTok, Facebook): people see your work and follow you. Free; reach depends on what you post.",
          "Booking platforms and marketplaces: people can book and pay. Many are free to start and charge per booking, per payment or for premium features.",
        ] },
      ] },
      { id: "compare", h: "How the main options compare", blocks: [
        { table: { caption: "Typical trade-offs — check each provider's current pricing page before you sign up.", head: ["Option", "Best for", "Usual cost", "Watch out for"], rows: [
          ["Google Business Profile", "Being found in local search and maps", "Free", "Needs verification; keep hours and photos current"],
          ["Apple Business Connect / Bing Places", "iPhone Maps and Bing users", "Free", "Easy to forget — update them when anything changes"],
          ["Instagram / TikTok", "Showing your work, building trust", "Free (ads optional)", "Reach rises and falls; always link to booking"],
          ["General booking platforms", "Online booking, deposits, reminders", "Free tiers to monthly plans; card processing", "Who owns the client list; payout timing"],
          ["Nearest", "Reaching verified students in live cities", "Free to list for new professionals; per-booking service fee", "Only live in select cities; limited spots per category"],
        ] } },
      ] },
      { id: "choose", h: "How to choose", blocks: [
        { ol: [
          "Start with Google Business Profile — it helps almost every local business.",
          "Add one social platform you'll post on every week.",
          "Choose one main booking tool for your calendar and deposits.",
          "Add niche platforms only if they reach clients you can't reach otherwise.",
        ] },
        { note: "Keep your business name, phone and service area identical everywhere. Inconsistent details confuse clients and search engines." },
      ] },
      { id: "nearest-fit", h: "Where Nearest fits — and where it doesn't", blocks: [
        "Nearest is built for one audience: verified students. New professionals list free with no monthly membership fee; a flat service fee is included in each booking, and card processing comes out of payouts. It works alongside your current booking platform.",
        "It's a good fit if students are part of your clientele and you're in a city where Nearest is live. It's not a replacement for a general listing, and it isn't available everywhere — check the Locations page.",
      ] },
    ],
    faq: [{ q: "Is it worth being on many platforms?", a: "Only if you can keep each one accurate. Two or three well-kept listings usually beat ten stale ones." }],
    related: ["get-beauty-business-found-on-google", "improve-beauty-profile-booking-conversion", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "nail-tech-30-day-content-calendar",
    title: "30-Day Social Media Content Calendar for Nail Techs",
    h1: "A 30-day social media content calendar for nail techs",
    description: "A ready-to-use 30-day posting plan for nail technicians, with daily ideas, caption starters and a weekly filming routine.",
    intent: "Nail tech wants a concrete posting plan instead of guessing what to post.",
    topic: "Marketing", audience: "pro", published: D, updated: D,
    summary: "Post five days a week, rotate five content types, and film in one weekly batch. Below is a full month you can copy, with a caption starter for each day.",
    sections: [
      { id: "system", h: "The system behind the calendar", blocks: [
        { ul: [
          "Results (R): finished sets, named by shape, length and style.",
          "Process (P): a 10–20 second clip of one step.",
          "Education (E): an answer to a question clients ask.",
          "Trust (T): your space, your cleaning routine, your reviews.",
          "Booking (B): openings, your price list, how to book.",
        ] },
        "Film on your slowest day: record each client's set from three angles in natural light, and capture one process clip per appointment.",
      ] },
      { id: "calendar", h: "The 30-day calendar", blocks: [
        { table: { head: ["Day", "Type", "Post idea", "Caption starter"], rows: [
          ["1", "B", "Price list carousel", "Here's everything I offer and what it costs — booking link in bio."],
          ["2", "R", "Best set from last week", "Short almond, milky pink, 75 minutes."],
          ["3", "P", "Cuticle prep clip", "Why prep takes the longest part of your appointment."],
          ["4", "E", "Gel vs. acrylic vs. gel-X", "Which is right for you? Quick breakdown."],
          ["5", "B", "Openings this week", "Two spots Saturday morning."],
          ["6", "Rest", "—", "—"],
          ["7", "Rest", "—", "—"],
          ["8", "R", "Before-and-after repair", "Lifting? Here's how I fix it."],
          ["9", "T", "Tool sanitizing routine", "What happens between every client."],
          ["10", "P", "Shaping clip", "Coffin, almond or square — watch me shape all three."],
          ["11", "E", "How long a set lasts", "Make your set last 3 weeks."],
          ["12", "B", "Fill reminder", "Due for a fill? Here's when I'm free."],
          ["13–14", "Rest", "—", "—"],
          ["15", "R", "Seasonal design", "Fall chrome on a short square."],
          ["16", "T", "A client review", "Screenshot a review with permission."],
          ["17", "P", "Design detail close-up", "Freehand vs. stickers — how I do it."],
          ["18", "E", "Aftercare tips", "Five things that wreck a fresh set."],
          ["19", "B", "Referral offer", "Bring a friend, you both get a free add-on."],
          ["20–21", "Rest", "—", "—"],
          ["22", "R", "Most-requested style", "This is the set everyone asks for."],
          ["23", "T", "Your workspace tour", "Where your appointment happens."],
          ["24", "P", "Timelapse full set", "75 minutes in 20 seconds."],
          ["25", "E", "Myths about nail health", "No, your nails don't need to breathe."],
          ["26", "B", "Next month's availability", "Next month's books are open."],
          ["27–28", "Rest", "—", "—"],
          ["29", "R", "Month recap carousel", "Every set from this month — which is your favorite?"],
          ["30", "B", "Pinned booking post refresh", "How to book with me, step by step."],
        ] } },
      ] },
      { id: "captions", h: "Caption formula", blocks: [
        { copy: "[What it is] — [shape, length, style].\n[One detail that shows skill or care].\n[Who it's good for or how long it lasts].\nBook: [link] · Openings: [days]", label: "Copy and fill in" },
      ] },
      { id: "measure", h: "What to measure", blocks: [
        "Each Sunday, note how many bookings came from Instagram that week and which post brought them. After a month, double the content type that brings bookings, not just likes.",
      ] },
    ],
    related: ["beauty-business-flyer", "improve-beauty-profile-booking-conversion", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "first-10-clients-new-hairstylist",
    title: "How to Get Your First 10 Clients as a New Hairstylist",
    h1: "How to get your first 10 clients as a new hairstylist",
    description: "A practical, week-by-week plan for new hairstylists to land their first ten paying clients and turn them into regulars.",
    intent: "New stylist with no clientele wants a concrete path to first paying clients.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    summary: "Your first ten clients usually come from people who know you, models who help you build a portfolio, and referrals from both. Pick a signature service, make it easy to book, and ask every client for one introduction.",
    sections: [
      { id: "signature", h: "Week 1: Choose what you'll be known for", blocks: [
        "Pick one or two services you do well and enjoy — silk presses, knotless braids, curly cuts, fades. A clear specialty is easier to remember and recommend than a long menu.",
        { ul: ["Write a price and time for each.", "Photograph your best work, even on friends or family (ask permission).", "Set up one booking link with a deposit."] },
      ] },
      { id: "models", h: "Week 2: Book model appointments with clear terms", blocks: [
        "Offer three to five model appointments at a reduced price in exchange for photos and an honest review. Be clear: what's included, how long it takes, and that results are portfolio work.",
        { copy: "Looking for 3 models for silk presses this Saturday. Reduced price: $40 (normally $65) in exchange for photos and a review. Natural hair, shoulder length or longer. DM me to book.", label: "Model call post" },
      ] },
      { id: "network", h: "Week 3: Personal outreach", blocks: [
        "Send personal messages to twenty people you know with a specific offer and a date. Ask them to share if it's not for them.",
      ] },
      { id: "referral-loop", h: "Week 4: Turn every client into an introduction", blocks: [
        { ol: [
          "Rebook before they leave: \"Your trim is due in about 8 weeks — want me to hold the 14th?\"",
          "Ask for one referral while they're happy with the result.",
          "Thank them with a small credit when a friend books.",
          "Ask for a Google review that mentions the service.",
        ] },
      ] },
      { id: "trust", h: "Build trust while you're new", blocks: [
        "Be honest about your training or license status, keep your station spotless, start on time and reply quickly. Clients forgive inexperience far more easily than unreliability.",
      ] },
      { id: "nearest", h: "Where Nearest can help", blocks: [
        "If you serve students in a city where Nearest is live, Nearest can introduce your work to verified students. You can also post Model Calls — discounted practice appointments — on Nearest to build your portfolio.",
      ] },
    ],
    related: ["get-more-beauty-clients-without-ads", "improve-beauty-profile-booking-conversion", "price-student-friendly-beauty-services"],
  },
  {
    slug: "beauty-business-flyer",
    title: "How to Make a Beauty Business Flyer That Converts",
    h1: "How to make a beauty business flyer that converts",
    description: "What to put on a beauty business flyer, sample copy for nails, hair and lashes, design rules and where to put it so it brings bookings.",
    intent: "Professional wants a flyer that actually brings bookings and sample copy to start from.",
    topic: "Marketing", audience: "pro", published: D, updated: D,
    summary: "A flyer that converts has one message, one photo, a few priced services and one easy way to book — usually a QR code. Everything else is noise.",
    sections: [
      { id: "anatomy", h: "What every flyer needs", blocks: [
        { ol: [
          "A headline that says what you do and for whom: \"Knotless braids in Frisco — school and event styles.\"",
          "One photo of your best, most typical work.",
          "Two to four services with prices.",
          "Your area and booking hours.",
          "One booking method: a QR code to your link, plus the short link written out.",
          "Optional: a limited new-client offer with an end date.",
        ] },
      ] },
      { id: "copy", h: "Sample flyer copy", blocks: [
        { copy: "FRESH SETS IN [CITY]\nGel-X · Acrylic · Gel manicures\nShort gel-X set ......... $45\nAcrylic full set ........ $55\nGel manicure ............ $30\nWeekday evenings + Saturdays\nScan to book → [QR]   [short link]\nNew clients: free nail art on your first set through [date]", label: "Nail tech" },
        { copy: "BRAIDS THAT LAST\nKnotless · Boho · Kids' styles\nMedium knotless, mid-back ... from $150\nCornrows (2–6) ............... from $40\nHair included on knotless sets\nScan to see styles and book → [QR]", label: "Braider" },
        { copy: "LASH SETS & REFILLS — [AREA]\nClassic full set .......... $80\nHybrid full set ........... $95\n2-week refill ............. $45\nBook online → [QR]  ·  Refill reminders included", label: "Lash tech" },
      ] },
      { id: "design", h: "Design rules", blocks: [
        { ul: [
          "Big headline readable from six feet away.",
          "No more than two fonts and three colors.",
          "Leave white space around the QR code; test it before printing.",
          "Print a test copy and look at it from across the room.",
        ] },
      ] },
      { id: "where", h: "Where to put it", blocks: [
        "Places your clients already pass: coffee shops, gyms, laundromats, community boards, and partner businesses that agree to it. Ask permission first. Don't post flyers on school property or hand them out at schools without permission from the school.",
      ] },
      { id: "track", h: "Track it", blocks: ["Use a short link or a QR code that goes to a page only the flyer uses, so you can count scans."] },
    ],
    related: ["nail-tech-30-day-content-calendar", "student-clients-prom-homecoming-graduation", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "student-clients-prom-homecoming-graduation",
    title: "How to Attract Student Clients for Prom, Homecoming, and Graduation",
    h1: "How to attract student clients for prom, homecoming and graduation",
    description: "A seasonal plan for beauty professionals to book student event appointments responsibly — timing, packages, communication and policies for minors.",
    intent: "Professional wants to book students for event seasons and handle it professionally.",
    topic: "Student seasons", audience: "pro", published: D, updated: D,
    summary: "Event seasons reward professionals who plan ahead: announce four to eight weeks early, offer clear packages, and have policies ready for younger clients.",
    sections: [
      { id: "calendar", h: "When to promote", blocks: [
        { table: { head: ["Season", "Typical timing", "Start promoting"], rows: [
          ["Back to school", "Late summer", "2–3 weeks before classes"],
          ["Homecoming", "Fall", "4–6 weeks before local dates"],
          ["Holiday events", "December", "Early November"],
          ["Prom", "Spring", "6–8 weeks before local dates"],
          ["Graduation", "Late spring", "4–6 weeks before ceremonies"],
        ] } },
        "Local dates vary by school — check public school calendars and ask clients when theirs is.",
      ] },
      { id: "packages", h: "Build packages students can say yes to", blocks: [
        { ul: [
          "A clear event package: service, timing, what's included, price.",
          "Group slots for friends getting ready together.",
          "A trial option for makeup or hair, booked ahead of the event.",
          "A simpler, lower-priced version for students on a tight budget.",
        ] },
      ] },
      { id: "minors", h: "Serving minors professionally", blocks: [
        "Many event clients are under 18. Know your state's licensing and parental-consent rules for each service, keep all communication in your booking app, welcome a parent to attend, and decline services that require an adult client.",
        { note: "This is general guidance, not legal advice. Check your state licensing board's rules for the services you offer." },
      ] },
      { id: "content", h: "What to post", blocks: [
        { ul: ["Looks for different dress colors and skin tones.", "A timeline: \"Book by March 15 for prom on April 18.\"", "How many spots are left — honest scarcity, not pressure.", "What to bring and how to prepare."] },
      ] },
      { id: "nearest", h: "How Nearest fits", blocks: [
        "Nearest is built for verified students. In cities where it's live, students can find you, request a time and pay inside the app; students 13–17 need a parent or guardian's approval to book, and services marked 18+ only can't be booked by minors.",
      ] },
    ],
    related: ["price-student-friendly-beauty-services", "beauty-business-flyer", "more-lash-clients-without-discounting"],
  },
];
