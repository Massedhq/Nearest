import type { Guide } from "./guides";

const D = "2026-10-20";

// Professional growth guides (1–6). Each one: the reader's problem → practical advice → how Nearest helps
// (free listing for new professionals, no monthly fee, works alongside current booking tools, verified students in
// your city) → contextual calls to action. Never promise clients, bookings, income or rankings.
export const GUIDES_A: Guide[] = [
  {
    slug: "get-more-beauty-clients-without-ads",
    title: "How to Get More Beauty Clients Without Paying for Ads",
    h1: "How to get more beauty clients without paying for ads",
    description: "A step-by-step plan for nail techs, stylists, braiders, barbers and lash artists to fill their books using referrals, local search and content.",
    intent: "Independent beauty professional wants more clients but has little or no ad budget.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    pain: "Your work is good, but your book isn't full — and paying for ads every month isn't an option.",
    summary: "Clients for independent beauty professionals come from four free places: people who already know your work, referrals, people searching nearby, and platforms that put you in front of clients who are already looking. This plan works through all four in a month.",
    sections: [
      { id: "foundation", h: "Step 1: Make booking easy before you promote (days 1–3)", blocks: [
        "Every channel you use later sends people to one place, so that place has to answer their questions without a back-and-forth.",
        { ul: [
          "Prices on every service — \"DM for price\" loses people comparing options at 11 p.m.",
          "Duration and what's included: \"Knotless, mid-back, small — 6 hours, hair included.\"",
          "Your area, not your home address, until someone books.",
          "Three to six recent photos of your own work, in good light.",
          "Two lines of policy: deposit, lateness, cancellation.",
        ] },
        { note: "Test it: ask a friend to book you from your bio without help. Every question they ask is something to fix." },
      ] },
      { id: "students", h: "Step 2: Get in front of clients who are already looking", blocks: [
        "Ads cost money because they interrupt people who weren't searching. The cheaper route is to be listed where clients are already choosing a professional.",
        "Students are one of the most consistent groups booking beauty and grooming — haircuts every few weeks, braids and protective styles, nails and lashes before school events — and they're actively looking for prices that fit a student budget.",
        { cta: "pro", title: "Reach students who are booking near you — free", text: "On Nearest, verified high school, college, trade school and online students in your city find professionals and request appointments. New professionals list for free with no monthly fee, and you keep the booking tools you already use for everyone else." },
      ] },
      { id: "warm-network", h: "Step 3: Tell the people who already trust you (days 3–7)", blocks: [
        "Your first wave of bookings is usually warm: friends, family, coworkers, classmates and past clients. Make a specific offer instead of announcing that you're \"taking clients.\"",
        { copy: "Hi Maya! I'm opening my books for October — four spots for silk presses on Thursday and Saturday afternoons. $65, about 2 hours. If you or anyone you know wants one, here's my link: [link].", label: "Message you can adapt" },
        "Send it one person at a time. Personal messages get replies; mass broadcasts get scrolled past.",
      ] },
      { id: "referrals", h: "Step 4: Build a referral habit", blocks: [
        { ol: [
          "Ask when the client sees the result: \"If anyone asks who did this, I'd love for you to send them my way.\"",
          "Make it effortless — text them your booking link or hand them a card with a QR code.",
          "Thank referrers with a small credit or free add-on for new clients only, with an end date.",
        ] },
        "Student clients refer each other constantly — friends book together for events and compare who did their hair or nails. A good experience with one student often reaches their group.",
      ] },
      { id: "local-search", h: "Step 5: Show up when people search nearby (week 2)", blocks: [
        "Claim your Google Business Profile, choose the most specific category, set a service area if you work from home, add services with prices, and ask happy clients for reviews that name the service. It takes an afternoon and keeps working.",
        "Your Nearest profile works alongside it: one helps people searching Google find you, the other puts you in front of verified students choosing a professional in your city.",
      ] },
      { id: "content", h: "Step 6: Post results with a purpose (weeks 2–4)", blocks: [
        { table: { head: ["Post type", "What it shows", "Example"], rows: [
          ["Result", "The finished look, named how clients search", "\"Short almond, milky white with chrome — 90 min\""],
          ["Process", "One step that shows skill", "Your cuticle prep or parting"],
          ["Answer", "A question clients ask you", "\"How long do knotless braids last?\""],
          ["Opening", "A specific available time", "\"2 spots Thursday after 4 PM\""],
        ] } },
        "End each post with one next step. If you're on Nearest, your booking link (usenearest.com/pro-yourname) works in any bio.",
      ] },
      { id: "track", h: "Step 7: Track what brings bookings (end of month)", blocks: [
        "Ask every new client how they found you. After a month you'll know which channels bring paying clients — keep those, drop the rest. On Nearest, every request and completed appointment is in your app, so student bookings are easy to count.",
      ] },
    ],
    faq: [
      { q: "How long does it take to see results without ads?", a: "Warm-network and referral bookings can come within days. Search and content usually take several weeks of steady effort. A listing on Nearest can be live as soon as your profile and ID are approved, but no platform can promise how quickly bookings come." },
      { q: "Should I discount to get my first clients?", a: "A few limited intro or model appointments are fine — Nearest lets you post discounted Model Calls for exactly that. Avoid permanent discounts; they're hard to undo." },
    ],
    endCta: { title: "Add a free student client channel", text: "Join Nearest at no cost and with no monthly fee, keep your current booking tools, and let verified students in your city find you. Each city has a limited number of spots per service, so check whether yours is open." },
    related: ["first-10-clients-new-hairstylist", "where-to-list-beauty-business-free", "why-beauty-business-not-getting-bookings"],
  },
  {
    slug: "where-to-list-beauty-business-free",
    title: "Where to List Your Beauty Business for Free",
    h1: "Where to list your beauty business for free",
    description: "A fair comparison of free listing options for beauty and wellness professionals — what each is good for, what it costs later, and how to choose.",
    intent: "Professional wants free places to list services and understand trade-offs.",
    topic: "Listings & visibility", audience: "pro", published: D, updated: D,
    pain: "You want more people to find you, but you don't want to pay monthly fees just to be listed.",
    summary: "The best free listings are the ones where your clients are already choosing a professional. For most independent beauty professionals that means a student-focused listing on Nearest, a Google Business Profile, and one social profile you keep active — all pointing to the same booking information.",
    sections: [
      { id: "what-free-means", h: "What \"free\" should mean", blocks: [
        "A truly free listing costs nothing to create and nothing per month to keep. Read what happens when a client actually books: some services charge per booking, take a commission, or lock basic features behind a paid plan.",
        { ul: ["No sign-up fee or monthly fee to stay listed.", "Clear, upfront pricing on bookings.", "You can keep using your own tools.", "You control your prices, hours and photos."] },
      ] },
      { id: "nearest", h: "1. Nearest — a free listing built around student clients", blocks: [
        "Nearest is a student beauty, grooming, wellness and self-care booking platform. Verified students in your city browse professionals, see your prices and work, and request appointments.",
        { ul: [
          "Free for new professionals — no sign-up fee and no monthly membership fee.",
          "A $5 booking fee is added to each booking by default, so students see one total and you keep your full price. Card processing is deducted from your payout.",
          "Works alongside the booking tools you already use.",
          "Requests, payments, reminders, address sharing and appointment-day check-in are handled in the app.",
          "Spots are limited: each service category opens with five professionals per city.",
        ] },
        { cta: "pro", title: "Claim a free listing in your city", text: "If students are part of your clientele, list your services on Nearest. See whether your city and category are open, then build your profile — it's free, and you can save and finish later." },
      ] },
      { id: "google", h: "2. Google Business Profile — be found in local search", blocks: [
        "A verified profile helps people searching near you find your hours, photos and reviews. Choose an accurate category, set a service area if you work from home, and keep it updated. See the guide to getting found on Google for the full setup.",
      ] },
      { id: "social", h: "3. One social profile you actually keep up", blocks: [
        "Instagram or TikTok is where many clients check your work before booking. Pick one, post consistently, and put one booking link in your bio — your Nearest link (usenearest.com/pro-yourname) works for student clients.",
      ] },
      { id: "choose", h: "How to decide", blocks: [
        { table: { head: ["If your goal is…", "Start with"], rows: [
          ["Reaching students booking near you", "Nearest"],
          ["Being found when anyone searches \"near me\"", "Google Business Profile"],
          ["Showing your work and building a following", "One social profile"],
        ] } },
        { note: "Keep your business name, area and services identical everywhere. Two or three well-kept listings beat ten forgotten ones." },
      ] },
    ],
    faq: [{ q: "Is a free listing on Nearest really free?", a: "For new professionals, yes: no sign-up fee and no monthly fee. A $5 booking fee applies to each booking (added to the student's total by default), and card processing is deducted from your payout. Nearest doesn't promise bookings." }],
    endCta: { title: "Start your free Nearest listing", text: "No monthly fee, no card needed to join, and you keep your current tools. Check your city, then create your professional account." },
    related: ["get-beauty-business-found-on-google", "improve-beauty-profile-booking-conversion", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "nail-tech-30-day-content-calendar",
    title: "30-Day Social Media Content Calendar for Nail Techs",
    h1: "A 30-day social media content calendar for nail techs",
    description: "A ready-to-use 30-day posting plan for nail technicians, with daily ideas, caption starters and a weekly filming routine.",
    intent: "Nail tech wants a concrete posting plan instead of guessing what to post.",
    topic: "Marketing", audience: "pro", published: D, updated: D,
    pain: "You know you should post more, but you never know what to post — and likes aren't turning into appointments.",
    summary: "Post five days a week, rotate five content types, and film in one weekly batch. Every booking post points to one link — and if you're on Nearest, that link lets verified students book you directly.",
    sections: [
      { id: "system", h: "The system behind the calendar", blocks: [
        { ul: [
          "Results (R): finished sets, named by shape, length and style.",
          "Process (P): a 10–20 second clip of one step.",
          "Education (E): an answer to a question clients ask.",
          "Trust (T): your space, your cleaning routine, your reviews.",
          "Booking (B): openings, your price list, how to book.",
        ] },
        "Film on your slowest day: each set from three angles in natural light, plus one process clip per appointment.",
      ] },
      { id: "calendar", h: "The 30-day calendar", blocks: [
        { table: { head: ["Day", "Type", "Post idea", "Caption starter"], rows: [
          ["1", "B", "Price list carousel", "Everything I offer and what it costs — booking link in bio."],
          ["2", "R", "Best set from last week", "Short almond, milky pink, 75 minutes."],
          ["3", "P", "Cuticle prep clip", "Why prep takes the longest part of your appointment."],
          ["4", "E", "Gel vs. acrylic vs. gel-X", "Which is right for you? Quick breakdown."],
          ["5", "B", "Openings this week", "Two spots Saturday morning."],
          ["8", "R", "Before-and-after repair", "Lifting? Here's how I fix it."],
          ["9", "T", "Tool sanitizing routine", "What happens between every client."],
          ["10", "P", "Shaping clip", "Coffin, almond or square — watch me shape all three."],
          ["11", "E", "How long a set lasts", "Make your set last three weeks."],
          ["12", "B", "Student sets", "After-school appointments Tue–Thu — students, book through my Nearest link."],
          ["15", "R", "Seasonal design", "Fall chrome on a short square."],
          ["16", "T", "A client review", "A review, shared with permission."],
          ["17", "P", "Design close-up", "Freehand vs. stickers — how I do it."],
          ["18", "E", "Aftercare tips", "Five things that wreck a fresh set."],
          ["19", "B", "Referral offer", "Bring a friend, you both get a free add-on."],
          ["22", "R", "Most-requested style", "The set everyone asks for."],
          ["23", "T", "Workspace tour", "Where your appointment happens."],
          ["24", "P", "Timelapse full set", "75 minutes in 20 seconds."],
          ["25", "E", "Nail-health myths", "No, your nails don't need to breathe."],
          ["26", "B", "Event sets", "Homecoming and prom sets — book early, spots go fast."],
          ["29", "R", "Month recap", "Every set this month — which is your favorite?"],
          ["30", "B", "Pinned booking post", "How to book with me, step by step."],
        ], caption: "Days not listed are rest days (two per week)." } },
      ] },
      { id: "student-content", h: "Content that reaches student clients", blocks: [
        "Students book around school calendars: back-to-school, homecoming, holiday breaks, prom and graduation. Post event sets three to six weeks ahead, show shorter and lower-priced options alongside full sets, and mention after-school and weekend times.",
        { cta: "pro", title: "Turn student interest into requests", text: "When a student sees your work and wants to book, Nearest lets them request a time and pay in the app — no DMs, no chasing deposits. It's free for new professionals, with no monthly fee." },
      ] },
      { id: "captions", h: "Caption formula", blocks: [
        { copy: "[What it is] — [shape, length, style].\n[One detail that shows skill or care].\n[Who it's good for or how long it lasts].\nBook: [link] · Openings: [days]", label: "Copy and fill in" },
      ] },
      { id: "measure", h: "What to measure", blocks: ["Each Sunday, count the bookings that came from your posts and which post brought them. Double the content type that brings bookings, not just likes."] },
    ],
    endCta: { title: "Give your posts somewhere to send students", text: "List your nail services on Nearest for free and share your Nearest link in your bio. Verified students in your city can find you, see your prices and request a set." },
    related: ["beauty-business-flyer", "improve-beauty-profile-booking-conversion", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "first-10-clients-new-hairstylist",
    title: "How to Get Your First 10 Clients as a New Hairstylist",
    h1: "How to get your first 10 clients as a new hairstylist",
    description: "A practical, week-by-week plan for new hairstylists to land their first ten paying clients and turn them into regulars.",
    intent: "New stylist with no clientele wants a concrete path to first paying clients.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    pain: "You're licensed, enrolled or skilled — but your chair is empty and nobody knows your name yet.",
    summary: "Your first ten clients usually come from people who know you, models who help build your portfolio, and a place where new clients are already looking. Pick a signature service, make it easy to book, and ask every client for one introduction.",
    sections: [
      { id: "signature", h: "Week 1: Choose what you'll be known for", blocks: [
        "Pick one or two services you do well and enjoy — silk presses, knotless braids, curly cuts, fades. A clear specialty is easier to remember and recommend than a long menu.",
        { ul: ["Write a price and time for each.", "Photograph your best work, even on friends or family (with permission).", "Set your hours — and protect them."] },
      ] },
      { id: "models", h: "Week 2: Build your portfolio with model appointments", blocks: [
        "Offer a few reduced-price model appointments in exchange for photos and an honest review. Be clear about what's included and that results are portfolio work.",
        { copy: "Looking for 3 models for silk presses this Saturday. Reduced price: $40 (normally $65) in exchange for photos and a review. Natural hair, shoulder length or longer.", label: "Model call post" },
        { cta: "pro", title: "Post Model Calls where students will see them", text: "Nearest has Model Calls built in: list a discounted practice appointment, set the requirements, and verified students nearby can book a spot. It's free to list for new professionals." },
      ] },
      { id: "network", h: "Week 3: Personal outreach", blocks: ["Message twenty people you know with a specific offer and date. Ask them to share it if it's not for them."] },
      { id: "students", h: "Why students are a strong first clientele", blocks: [
        "New stylists often build fastest with students: they book regularly, they book for events, and they tell their friends. They also want prices that fit a student budget — which suits a stylist still building speed and a portfolio.",
        "On Nearest, students already verified as students browse professionals in their city. Your profile shows your photo, services, prices and portfolio; students request a time, and you accept or decline.",
      ] },
      { id: "referral-loop", h: "Week 4: Turn every client into an introduction", blocks: [
        { ol: [
          "Rebook before they leave: \"Your trim is due in about 8 weeks — want me to hold the 14th?\"",
          "Ask for one referral while they're happy with the result.",
          "Thank them with a small credit when a friend books.",
          "Ask for a review that mentions the service.",
        ] },
      ] },
      { id: "trust", h: "Build trust while you're new", blocks: ["Be honest about your training or license status, keep your station spotless, start on time and reply quickly. On Nearest you choose your professional status (licensed, license pending, currently enrolled or self-taught), and your identity is verified — clients see who they're booking."] },
    ],
    endCta: { title: "Start building your clientele on Nearest", text: "Create your free profile, add your signature services and a Model Call, and let verified students in your city find you. Spots are limited per category in each city." },
    related: ["get-more-beauty-clients-without-ads", "improve-beauty-profile-booking-conversion", "price-student-friendly-beauty-services"],
  },
  {
    slug: "beauty-business-flyer",
    title: "How to Make a Beauty Business Flyer That Converts",
    h1: "How to make a beauty business flyer that converts",
    description: "What to put on a beauty business flyer, sample copy for nails, hair and lashes, design rules and where to put it so it brings bookings.",
    intent: "Professional wants a flyer that actually brings bookings and sample copy to start from.",
    topic: "Marketing", audience: "pro", published: D, updated: D,
    pain: "You printed flyers before and nobody booked — they looked nice but didn't tell people what to do next.",
    summary: "A flyer that converts has one message, one photo, a few priced services and one easy way to book — usually a QR code to a booking page that answers every question.",
    sections: [
      { id: "anatomy", h: "What every flyer needs", blocks: [
        { ol: [
          "A headline that says what you do and for whom: \"Knotless braids — school and event styles.\"",
          "One photo of your best, most typical work.",
          "Two to four services with prices.",
          "Your area and booking hours.",
          "One booking method: a QR code, plus the short link written out.",
          "Optional: a limited new-client offer with an end date.",
        ] },
      ] },
      { id: "qr", h: "Where the QR code should go", blocks: [
        "The QR code is the whole point of the flyer, so it should open a page where someone can actually book — with prices, photos and times — not a page that asks them to message you.",
        { cta: "pro", title: "Use your Nearest link as your flyer's QR code", text: "Every Nearest professional gets a booking link (usenearest.com/pro-yourname). Students who scan it see your services, prices and portfolio and can request a time. Free to list for new professionals." },
      ] },
      { id: "copy", h: "Sample flyer copy", blocks: [
        { copy: "FRESH SETS NEAR YOU\nGel-X · Acrylic · Gel manicures\nShort gel-X set ......... $45\nAcrylic full set ........ $55\nGel manicure ............ $30\nWeekday evenings + Saturdays\nStudents: scan to book → [QR]   usenearest.com/pro-[name]", label: "Nail tech" },
        { copy: "BRAIDS THAT LAST\nKnotless · Boho · Kids' styles\nMedium knotless, mid-back ... from $150\nCornrows (2–6) ............... from $40\nHair included on knotless sets\nScan to see styles and book → [QR]", label: "Braider" },
        { copy: "LASH SETS & REFILLS\nClassic full set .......... $80\nHybrid full set ........... $95\n2-week refill ............. $45\nBook online → [QR]", label: "Lash tech" },
      ] },
      { id: "design", h: "Design rules", blocks: [
        { ul: ["Big headline readable from six feet away.", "No more than two fonts and three colors.", "White space around the QR code; test it before printing.", "Print one test copy and look at it from across the room."] },
      ] },
      { id: "where", h: "Where to put it", blocks: [
        "Places your clients already pass, with permission: coffee shops, gyms, laundromats, community boards and partner businesses near campuses. Don't post or hand out flyers on school property without the school's permission.",
      ] },
      { id: "track", h: "Track it", blocks: ["Use a link or QR code only the flyer uses, and ask new clients where they saw you."] },
    ],
    endCta: { title: "Make your flyer bookable", text: "Create a free Nearest profile and put your Nearest booking link on your flyer. Students who scan can see your prices and request a time — no monthly fee for new professionals." },
    related: ["nail-tech-30-day-content-calendar", "student-clients-prom-homecoming-graduation", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "student-clients-prom-homecoming-graduation",
    title: "How to Attract Student Clients for Prom, Homecoming, and Graduation",
    h1: "How to attract student clients for prom, homecoming and graduation",
    description: "A seasonal plan for beauty professionals to book student event appointments responsibly — timing, packages, communication and policies for minors.",
    intent: "Professional wants to book students for event seasons and handle it professionally.",
    topic: "Student seasons", audience: "pro", published: D, updated: D,
    pain: "Event season comes and goes — and the students book someone else because you started promoting too late.",
    summary: "Event seasons reward professionals who plan ahead: be where students are choosing professionals, announce four to eight weeks early, offer clear packages, and have policies ready for younger clients.",
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
      { id: "where-students-look", h: "Be where students are booking", blocks: [
        "Students compare professionals quickly, often with friends, and want to see prices and photos before they ask anything. A profile they can book from beats a DM thread.",
        { cta: "pro", title: "Be bookable before event season starts", text: "Nearest connects verified students with professionals in their city. Students see your prices and work and request a time; students 13–17 need a parent's approval to book. Free for new professionals, no monthly fee." },
      ] },
      { id: "packages", h: "Build packages students can say yes to", blocks: [
        { ul: [
          "A clear event package: service, timing, what's included, price.",
          "Group slots for friends getting ready together.",
          "A trial option for makeup or hair, booked ahead of the event.",
          "A simpler, lower-priced version for students on a tight budget.",
        ] },
        "On Nearest, add-ons let students build the package themselves — a base service plus optional extras — within the student price limit.",
      ] },
      { id: "minors", h: "Serving minors professionally", blocks: [
        "Many event clients are under 18. Know your state's licensing and parental-consent rules for each service, keep communication in your booking app, welcome a parent to attend, and decline services that require an adult client.",
        "On Nearest, you can mark a service 18+ only so students under 18 can't book it, and messages stay in the app — phone numbers and emails aren't shared.",
        { note: "This is general guidance, not legal advice. Check your state licensing board's rules for the services you offer." },
      ] },
      { id: "content", h: "What to post", blocks: [
        { ul: ["Looks for different dress colors and skin tones.", "A timeline: \"Book by March 15 for prom on April 18.\"", "How many spots are left — honest scarcity, not pressure.", "What to bring and how to prepare."] },
      ] },
    ],
    endCta: { title: "Get listed before the next event season", text: "Create your free Nearest profile now so students can find and request you when homecoming, prom and graduation come around. Check whether your city and category have spots open." },
    related: ["price-student-friendly-beauty-services", "beauty-business-flyer", "more-lash-clients-without-discounting"],
  },
];
