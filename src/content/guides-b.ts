import type { Guide } from "./guides";

const D = "2026-10-20";

// Professional growth guides (7–12). Same structure as guides-a.ts.
export const GUIDES_B: Guide[] = [
  {
    slug: "price-student-friendly-beauty-services",
    title: "How to Price Student-Friendly Beauty Services Profitably",
    h1: "How to price student-friendly beauty services profitably",
    description: "Work out your real cost per appointment, design a student menu that still pays you, and avoid discounts that cost you money.",
    intent: "Professional wants to serve students at accessible prices without losing money.",
    topic: "Pricing & operations", audience: "pro", published: D, updated: D,
    pain: "Students want your services, but every discount you try seems to eat your profit.",
    summary: "Know your real hourly profit first, then make student-friendly options by changing the service — shorter, simpler, off-peak — instead of cutting the price of your main work. Students fill those options reliably, which is what makes them profitable.",
    sections: [
      { id: "cost", h: "Step 1: Find your real profit per hour", blocks: [
        { table: { head: ["Line", "Example: medium knotless braids"], rows: [
          ["Your price", "$145"],
          ["Hair and products", "– $18"],
          ["Card processing (deducted from your payout)", "– about $4–5"],
          ["Share of fixed costs (tools, insurance, rent)", "– $10"],
          ["Profit", "≈ $112"],
          ["Total time incl. setup and cleanup", "6.5 hours"],
          ["Profit per hour", "≈ $17"],
        ], caption: "Example numbers — use your own. On Nearest, the $5 booking fee is added to the student's total by default, so it doesn't come out of your price." } },
        "Run this for every service. The hourly number, not the price, tells you what to promote.",
      ] },
      { id: "menu", h: "Step 2: Design a student menu", blocks: [
        { ul: [
          "Shorter or simpler versions: shoulder-length instead of waist-length, a gel manicure instead of a full set.",
          "Off-peak times: weekday afternoons when your chair is empty anyway.",
          "Practice or model appointments with clear expectations, for techniques you're still building.",
          "Optional add-ons, so the base price stays accessible and students choose extras.",
        ] },
        { cta: "pro", title: "Put your student menu where students are looking", text: "On Nearest, students compare professionals by service and price in their city. List your student-friendly options, add optional add-ons, and post Model Calls for practice work — all free for new professionals." },
      ] },
      { id: "cap", h: "Pricing within a student limit", blocks: [
        "Nearest caps every service at $150 for students, add-ons included, so you design within a clear ceiling. Most everyday services sit well below it; for long services, offer sizes or lengths that fit. A travel fee is added only when you go to the student.",
      ] },
      { id: "discounts", h: "Step 3: If you discount, set limits", blocks: [
        { ul: ["Limit it to specific services or times.", "Set an end date or a number of spots.", "Check the profit per hour after the discount — if it's too low, change the service instead."] },
      ] },
      { id: "raise", h: "When to raise prices", blocks: ["If you're booked out weeks ahead, or one service fills most of your week, raise that price and give regulars notice."] },
    ],
    endCta: { title: "List your student menu on Nearest", text: "Free for new professionals with no monthly fee. You set your prices, Nearest adds its $5 booking fee to the student's total by default, and you keep the tools you already use." },
    related: ["student-clients-prom-homecoming-graduation", "more-lash-clients-without-discounting", "why-beauty-business-not-getting-bookings"],
  },
  {
    slug: "more-lash-clients-without-discounting",
    title: "How to Get More Lash Clients Without Discounting Every Service",
    h1: "How to get more lash clients without discounting every service",
    description: "Fill lash appointments with waitlists, refill rhythms, clear policies and content that sells healed results — without training clients to wait for sales.",
    intent: "Lash tech has empty slots and is tempted to discount; wants alternatives.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    pain: "You have empty slots, and the only idea left is another sale — which brings bargain hunters who don't come back.",
    summary: "Lash businesses grow on refills and new clients who are already looking. Protect your prices, rebook every set, keep a waitlist, and add a steady source of new clients instead of a sale.",
    sections: [
      { id: "refills", h: "Build the refill rhythm", blocks: [
        "Every full set should leave with a refill booked. Explain why timing matters for retention and comfort, and offer two dates.",
        { copy: "Your set looks amazing! For the best retention, refills work best around 2–3 weeks. I have the 12th at 4 PM or the 14th at 11 AM — which works?", label: "Rebooking script" },
      ] },
      { id: "new-clients", h: "Add new clients without a sale", blocks: [
        "A discount is a way of buying attention. A steadier option is to be listed where clients are already choosing a lash tech. Students book lashes for school photos, events and everyday confidence, and they're comparing prices before they ask.",
        { cta: "pro", title: "Fill open lash slots with student requests", text: "On Nearest, verified students in your city can find your lash services and request a time. Listing is free for new professionals, there's no monthly fee, and you keep your current booking tools." },
      ] },
      { id: "waitlist", h: "Keep a waitlist", blocks: ["When someone cancels, message your waitlist first. A personal message fills more slots than a public sale post."] },
      { id: "content", h: "Show healed results", blocks: [
        { ul: ["Week-two photos of real sets show retention.", "Explain classic, hybrid and volume with photos.", "Share aftercare and why it protects natural lashes."] },
        { copy: "Classic set at 2 weeks — still full. That's what good prep and aftercare do.\nRefills open Tue/Thu after 3 PM · link in bio", label: "Caption" },
      ] },
      { id: "policy", h: "Protect your time", blocks: ["Require a deposit, state your refill window, and enforce lateness and cancellation rules the same way for everyone. On Nearest, every booking includes a protected deposit that's paid to you on a late cancellation or no-show."] },
      { id: "offers", h: "Offers that don't devalue you", blocks: [
        { ul: ["A free lash bath or tint with a referral.", "Priority booking for regulars.", "A set price for a full set plus first refill.", "On Nearest, optional add-ons (bottom lashes, color) let clients upgrade without you discounting the base set."] },
      ] },
    ],
    endCta: { title: "Get new lash clients without a sale", text: "Create your free Nearest profile, list your sets and refills at your real prices, and let verified students in your city request you. Check whether your city's Lashes spots are open." },
    related: ["improve-beauty-profile-booking-conversion", "get-more-beauty-clients-without-ads", "price-student-friendly-beauty-services"],
  },
  {
    slug: "why-beauty-business-not-getting-bookings",
    title: "Why Your Beauty Business Isn't Getting Bookings: A Diagnostic Checklist",
    h1: "Why your beauty business isn't getting bookings — a diagnostic checklist",
    description: "Work through visibility, trust, clarity and friction to find the specific reason views aren't turning into bookings, with a fix for each.",
    intent: "Professional gets views or messages but few bookings; wants to diagnose the cause.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    pain: "People look at your page, maybe even message you — and then they don't book.",
    summary: "No bookings usually comes down to one of four things: the right people aren't seeing you, they don't trust you yet, they can't tell what you offer, or booking is too hard. Find where people drop off and fix that first.",
    sections: [
      { id: "visibility", h: "1. Visibility — are the right people seeing you?", blocks: [
        { ul: ["Are you listed where clients choose a professional, not just on social media?", "Do you post at least three times a week?", "Are you reaching people in your area?", "Have you asked past clients for referrals this month?"] },
        "Fix: get listed where clients are already looking, post consistently and ask for referrals.",
        { cta: "pro", title: "Be seen by students choosing a professional", text: "Nearest shows your profile to verified students in your city who are browsing services and prices. It's free for new professionals and works alongside what you already use." },
      ] },
      { id: "trust", h: "2. Trust — do they believe you'll do a good job?", blocks: [
        { ul: ["Recent, clear photos of your own work?", "Reviews?", "Training or license status stated honestly?", "A clean space in your photos?"] },
        "Fix: replace old photos, collect reviews, show your cleaning routine. On Nearest, reviews come only from students who completed an appointment with you, and your identity is verified.",
      ] },
      { id: "clarity", h: "3. Clarity — can they tell what you offer and what it costs?", blocks: [
        { ul: ["Does every service have a price and a duration?", "Is your area clear?", "Do service names match how clients search?"] },
        "Fix: write your menu the way a client would describe it, with prices.",
      ] },
      { id: "friction", h: "4. Friction — is booking easy?", blocks: [
        { ul: ["Can someone book in under a minute?", "Do you have open times this week?", "Do you reply within a few hours?", "Is your deposit policy clear before they pay?"] },
        "Fix: one booking path, visible availability, fast replies. On Nearest, students request a time from your open hours, you get a notification, email and optional phone alert, and payment happens in the app once you accept.",
      ] },
      { id: "test", h: "Run a stranger test", blocks: ["Ask someone who's never booked you to find you, choose a service and book — while you watch silently. Every pause is a fix."] },
    ],
    endCta: { title: "Fix visibility and friction in one step", text: "A free Nearest profile puts your prices, photos and open times in front of verified students in your city, with booking and payment handled in the app. No monthly fee for new professionals." },
    related: ["improve-beauty-profile-booking-conversion", "get-beauty-business-found-on-google", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "improve-beauty-profile-booking-conversion",
    title: "How to Improve Your Beauty Business Profile and Booking Conversion",
    h1: "How to improve your beauty business profile and booking conversion",
    description: "A section-by-section checklist for your photo, bio, services, prices, portfolio and policies so more profile visitors become booked clients.",
    intent: "Professional wants more profile visitors to book.",
    topic: "Listings & visibility", audience: "pro", published: D, updated: D,
    pain: "Your profile gets views, but too few of them turn into appointments.",
    summary: "A profile converts when a stranger can answer five questions in seconds: what you do, what it looks like, what it costs, when you're free and how to book. This checklist works for any profile — and maps directly to a Nearest profile.",
    sections: [
      { id: "photo", h: "Your photo and name", blocks: ["Use a clear, friendly photo of you, plus your business name and logo. Clients book people. Nearest shows your own name and photo separately from your business name and logo, so students know exactly who they're booking."] },
      { id: "bio", h: "Your bio", blocks: [
        "Two or three sentences: what you specialize in, who you love working with, one reassuring detail, and how to book.",
        { copy: "I'm Jas — I specialize in classic and hybrid lash sets for everyday wear. Appointments start on time, and I'll walk you through aftercare so your set lasts.", label: "Example" },
      ] },
      { id: "services", h: "Services and prices", blocks: [
        { ul: ["Name services the way clients search.", "Price and duration on every service.", "Say what's included and what changes the price.", "Keep extras as optional add-ons."] },
        { cta: "pro", title: "Build a profile students can book from", text: "A Nearest profile has every piece of this checklist built in — photos, services with prices and durations, add-ons, portfolio, hours and reviews. It's free to create, and you can save and finish later." },
      ] },
      { id: "portfolio", h: "Portfolio", blocks: ["Show your best recent work first, in good light. Match photos to the services you want to sell most, and only post work you did. On Nearest you can tag portfolio photos to a service so students can book that exact look."] },
      { id: "availability", h: "Availability and policies", blocks: ["Keep hours you'll honor every week. Show your deposit, lateness and cancellation policy in a sentence or two. Nearest applies one clear policy to every booking, so you don't have to explain it each time."] },
      { id: "checklist", h: "Copyable checklist", blocks: [
        { copy: "☐ Clear photo of me\n☐ Bio: specialty, ideal client, one trust detail\n☐ Every service: name, price, duration, what's included\n☐ 6+ recent photos of my own work\n☐ Hours I can keep\n☐ Deposit + cancellation policy\n☐ One booking link everywhere\n☐ Replies within a few hours", label: "Profile checklist" },
      ] },
    ],
    endCta: { title: "Turn this checklist into a live profile", text: "Create your free Nearest profile and fill in each step. Verified students in your city can find you once you're approved and live. No monthly fee for new professionals." },
    related: ["why-beauty-business-not-getting-bookings", "where-to-list-beauty-business-free", "first-10-clients-new-hairstylist"],
  },
  {
    slug: "repeat-clients-braiding-locs",
    title: "How to Build Repeat Clients for Braiding and Loc Services",
    h1: "How to build repeat clients for braiding and loc services",
    description: "Turn one-time braid and loc appointments into regular clients with maintenance schedules, honest timing, aftercare and simple rebooking.",
    intent: "Braider or loctician wants more returning clients.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    pain: "Clients love their braids or retwist — then you don't hear from them again until they need someone urgently.",
    summary: "Braids and locs have natural return cycles. Clients come back when you explain the cycle, book the next visit before they leave and protect their hair's health — and a steady flow of new clients keeps the cycle full.",
    sections: [
      { id: "cycles", h: "Know and share the cycle", blocks: [
        { table: { head: ["Service", "Typical return", "What to book next"], rows: [
          ["Box or knotless braids", "Several weeks, depending on size and care", "Takedown + reinstall"],
          ["Cornrows / stitch braids", "A few weeks", "Fresh install"],
          ["Loc retwist", "Every few weeks", "Retwist"],
          ["Starter locs", "More often early on", "Maintenance visits"],
        ] } },
        "Give clients a realistic range based on their hair and lifestyle rather than one promise.",
      ] },
      { id: "students", h: "Why students make loyal braid and loc clients", blocks: [
        "Students wear protective styles through the school year and reinstall on a schedule — before school starts, before breaks, before events. A braider they trust gets booked again and recommended to friends.",
        { cta: "pro", title: "Reach students who rebook on a schedule", text: "On Nearest, verified students in your city can find your braid and loc services, see your sizes, lengths and prices, and request a time. Free for new professionals, with no monthly fee." },
      ] },
      { id: "honest-timing", h: "Be honest about time and price", blocks: ["Price by size and length, say whether hair is included, and give realistic durations. On Nearest, every service has a duration, so students see how long their appointment will take before they book."] },
      { id: "aftercare", h: "Protect their hair", blocks: [
        { ul: ["Avoid excessive tension at the hairline.", "Share scalp-care and night-time protection tips.", "Explain why leaving styles in too long can cause buildup and breakage."] },
      ] },
      { id: "rebook", h: "Book the next visit before they leave", blocks: [
        { copy: "Your braids should look great for about 6–8 weeks with good care. Want me to hold a takedown and reinstall for the week of the 20th?", label: "Rebooking script" },
      ] },
      { id: "loyalty", h: "Simple loyalty", blocks: ["Priority booking for regulars, a small free add-on every few visits, or a referral credit — easy to track."] },
    ],
    endCta: { title: "Keep your braid and loc chair full", text: "List your styles on Nearest for free and let verified students in your city request you. Check whether your city's Braids or Locs spots are open." },
    related: ["improve-beauty-profile-booking-conversion", "price-student-friendly-beauty-services", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "get-beauty-business-found-on-google",
    title: "How to Get Your Beauty Business Found on Google",
    h1: "How to get your beauty business found on Google",
    description: "Set up and maintain a Google Business Profile, choose categories, protect a home address, earn reviews and fix the most common visibility problems.",
    intent: "Professional wants to appear in Google local results.",
    topic: "Listings & visibility", audience: "pro", published: D, updated: D,
    pain: "You search for your own business and it doesn't show up — or it shows up below everyone else.",
    summary: "For most local beauty businesses, a complete, verified Google Business Profile is the most useful free search step, and a profile on a platform clients use to book gives you a second place to be found. Nobody can guarantee rankings; you can give Google and clients the clearest picture of your business.",
    sections: [
      { id: "claim", h: "1. Claim and verify your profile", blocks: ["Search for your business on Google Maps or go to Google Business Profile and follow the steps to add and verify it. Use your real business name — don't stuff keywords into it."] },
      { id: "category", h: "2. Choose accurate categories", blocks: ["Pick the most specific primary category (for example \"Nail salon\", \"Hair salon\", \"Barber shop\", \"Eyelash salon\"), then add secondary categories that truly apply."] },
      { id: "home", h: "3. Working from home or traveling? Use a service area", blocks: ["If clients don't visit a storefront, set a service area and hide your address. Nearest works the same way: your street address stays private and is shared only with a booked client on the appointment day."] },
      { id: "complete", h: "4. Complete every section", blocks: [
        { ul: ["Services with prices or ranges.", "Hours you actually keep.", "A booking link — your Nearest link (usenearest.com/pro-yourname) works here.", "At least ten photos of your work and space.", "A description of what you specialize in."] },
        { cta: "pro", title: "Give Google — and students — a place to book you", text: "A free Nearest profile gives you a public booking link with your services, prices and portfolio, and puts you in front of verified students in your city. No monthly fee for new professionals." },
      ] },
      { id: "reviews", h: "5. Earn reviews the right way", blocks: ["Ask every happy client, the same day, with a direct link. Respond politely to every review. Never buy, swap or fake reviews."] },
      { id: "active", h: "6. Stay active and consistent", blocks: ["Post an update or photo weekly, keep holiday hours current, and keep your business name, phone and area identical everywhere you're listed."] },
      { id: "troubleshoot", h: "Not showing up?", blocks: [
        { ul: ["Check that the profile is verified and not suspended.", "Search from a location inside your service area.", "Confirm your category matches what people search.", "Give it time — changes can take weeks to appear."] },
      ] },
    ],
    endCta: { title: "Add a second way to be found", text: "Search takes time to build. A free Nearest profile puts you in front of verified students in your city as soon as you're approved and live — and gives you a booking link for your Google profile." },
    related: ["where-to-list-beauty-business-free", "why-beauty-business-not-getting-bookings", "get-more-beauty-clients-without-ads"],
  },
];
