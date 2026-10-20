import type { Guide } from "./guides";

const D = "2026-10-20";

export const GUIDES_B: Guide[] = [
  {
    slug: "price-student-friendly-beauty-services",
    title: "How to Price Student-Friendly Beauty Services Profitably",
    h1: "How to price student-friendly beauty services profitably",
    description: "Work out your real cost per appointment, design a student menu that still pays you, and avoid discounts that cost you money.",
    intent: "Professional wants to serve students at accessible prices without losing money.",
    topic: "Pricing & operations", audience: "pro", published: D, updated: D,
    summary: "Know your real hourly profit first, then make student-friendly options by changing the service — shorter, simpler, off-peak — rather than cutting the price of your main work.",
    sections: [
      { id: "cost", h: "Step 1: Find your real cost per appointment", blocks: [
        { table: { head: ["Line", "Example: medium knotless braids"], rows: [
          ["Price", "$150"],
          ["Hair and products", "– $18"],
          ["Card processing and platform fees", "– $6 (check your platforms' actual rates)"],
          ["Share of fixed costs (tools, insurance, rent)", "– $10"],
          ["Profit", "$116"],
          ["Total time incl. setup and cleanup", "6.5 hours"],
          ["Profit per hour", "≈ $17.85"],
        ] } },
        "Run this for every service. The hourly number, not the price, tells you what to promote.",
      ] },
      { id: "menu", h: "Step 2: Design a student menu", blocks: [
        { ul: [
          "Shorter or simpler versions: shoulder-length instead of waist-length, a gel manicure instead of a full set.",
          "Off-peak times: weekday afternoons when your chair is empty anyway.",
          "Practice or model appointments with clear expectations, for techniques you're still building.",
          "Add-ons kept optional, so the base price stays accessible.",
        ] },
      ] },
      { id: "discounts", h: "Step 3: If you discount, set limits", blocks: [
        { ul: ["Limit it to specific services or times.", "Set an end date or a number of spots.", "Check the profit per hour after the discount — if it's below what you need, change the service instead."] },
      ] },
      { id: "raise", h: "When to raise prices", blocks: ["If you're booked out weeks ahead, or more than a third of your week is the same service, it's time to raise that price. Give regulars notice."] },
      { id: "nearest", h: "Pricing on Nearest", blocks: [
        "On Nearest, professionals set their own prices within a student price limit (see the FAQ for the current amount). Nearest's service fee is shown in the one total students see, and by default it's added on top of your price so you receive your full price; card processing comes out of payouts.",
      ] },
    ],
    related: ["student-clients-prom-homecoming-graduation", "more-lash-clients-without-discounting", "why-beauty-business-not-getting-bookings"],
  },
  {
    slug: "more-lash-clients-without-discounting",
    title: "How to Get More Lash Clients Without Discounting Every Service",
    h1: "How to get more lash clients without discounting every service",
    description: "Fill lash appointments with waitlists, refill rhythms, clear policies and content that sells healed results — without training clients to wait for sales.",
    intent: "Lash tech has empty slots and is tempted to discount; wants alternatives.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    summary: "Lash businesses grow on refills. Protect your prices, keep a waitlist, rebook every client and show results that have lasted — not just fresh sets.",
    sections: [
      { id: "refills", h: "Build the refill rhythm", blocks: [
        "Every full set should leave with a refill booked. Explain why timing matters for retention and comfort, and offer two dates.",
        { copy: "Your set looks amazing! For the best retention, refills work best around 2–3 weeks. I have the 12th at 4 PM or the 14th at 11 AM — which works?", label: "Rebooking script" },
      ] },
      { id: "waitlist", h: "Keep a waitlist", blocks: ["When someone cancels, message your waitlist first. A quick personal message fills more slots than a public sale post."] },
      { id: "content", h: "Show healed results", blocks: [
        { ul: ["Week-two photos of real sets show retention.", "Explain the difference between classic, hybrid and volume with photos.", "Share aftercare and why it protects natural lashes."] },
        { copy: "Classic set at 2 weeks — still full. This is what good prep and aftercare do.\nRefills open Tue/Thu after 3 PM · link in bio", label: "Caption" },
      ] },
      { id: "policy", h: "Protect your time", blocks: ["Require a deposit, state your refill window (for example, more than 40% fallout is booked as a full set), and enforce lateness and cancellation rules the same way for everyone."] },
      { id: "offers", h: "Offers that don't devalue you", blocks: [
        { ul: ["A free lash bath or tint with a referral.", "Priority booking for regulars before you post openings.", "A bundle of a full set plus first refill at a set price."] },
      ] },
    ],
    related: ["improve-beauty-profile-booking-conversion", "get-more-beauty-clients-without-ads", "price-student-friendly-beauty-services"],
  },
  {
    slug: "why-beauty-business-not-getting-bookings",
    title: "Why Your Beauty Business Isn't Getting Bookings: A Diagnostic Checklist",
    h1: "Why your beauty business isn't getting bookings — a diagnostic checklist",
    description: "Work through visibility, trust, clarity and friction to find the specific reason views aren't turning into bookings, with a fix for each.",
    intent: "Professional gets views or messages but few bookings; wants to diagnose the cause.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    summary: "No bookings usually comes down to one of four things: people aren't seeing you, don't trust you yet, can't tell what you offer, or find booking too hard. Find the stage where people drop off and fix that first.",
    sections: [
      { id: "visibility", h: "1. Visibility — are the right people seeing you?", blocks: [
        { ul: ["Is your Google Business Profile verified and complete?", "Do you post at least three times a week?", "Are your posts reaching people in your area?", "Have you asked past clients for referrals this month?"] },
        "Fix: claim and complete your listings, post consistently and ask for referrals.",
      ] },
      { id: "trust", h: "2. Trust — do they believe you'll do a good job?", blocks: [
        { ul: ["Do you have recent, clear photos of your own work?", "Do you have reviews?", "Is your training or license status stated honestly?", "Does your space look clean in photos?"] },
        "Fix: replace blurry or old photos, collect reviews, show your cleaning routine.",
      ] },
      { id: "clarity", h: "3. Clarity — can they tell what you offer and what it costs?", blocks: [
        { ul: ["Does every service have a price and a duration?", "Is your area clear?", "Do service names match how clients search?"] },
        "Fix: write your menu the way a client would describe it, with prices.",
      ] },
      { id: "friction", h: "4. Friction — is booking easy?", blocks: [
        { ul: ["Can someone book in under a minute from your bio?", "Do you have open times this week?", "Do you reply to messages within a few hours?", "Is your deposit and policy clear before they pay?"] },
        "Fix: one link, visible availability, fast replies.",
      ] },
      { id: "test", h: "Run a stranger test", blocks: ["Ask someone who's never booked you to find you, choose a service and book — while you watch silently. Every pause is a fix."] },
    ],
    related: ["improve-beauty-profile-booking-conversion", "get-beauty-business-found-on-google", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "improve-beauty-profile-booking-conversion",
    title: "How to Improve Your Beauty Business Profile and Booking Conversion",
    h1: "How to improve your beauty business profile and booking conversion",
    description: "A section-by-section checklist for your photo, bio, services, prices, portfolio and policies so more profile visitors become booked clients.",
    intent: "Professional wants more profile visitors to book.",
    topic: "Listings & visibility", audience: "pro", published: D, updated: D,
    summary: "A profile converts when a stranger can answer five questions in seconds: what you do, what it looks like, what it costs, when you're free and how to book.",
    sections: [
      { id: "photo", h: "Your photo and name", blocks: ["Use a clear, friendly photo of you, plus your business name and logo if you have one. Clients book people."] },
      { id: "bio", h: "Your bio", blocks: [
        "Two or three sentences: what you specialize in, who you love working with, one reassuring detail, and how to book.",
        { copy: "I'm Jas — I specialize in classic and hybrid lash sets for everyday wear. Appointments start on time, and I'll walk you through aftercare so your set lasts. Book below.", label: "Example" },
      ] },
      { id: "services", h: "Services and prices", blocks: [
        { ul: ["Name services the way clients search.", "Price and duration on every service.", "Say what's included and what changes the price.", "Keep optional extras as add-ons."] },
      ] },
      { id: "portfolio", h: "Portfolio", blocks: ["Show your best recent work first, in good light, cropped clean. Match photos to the services you want to sell most. Only post work you did."] },
      { id: "availability", h: "Availability and policies", blocks: ["Keep hours you'll honor every week. Show your deposit, lateness and cancellation policy in a sentence or two."] },
      { id: "checklist", h: "Copyable checklist", blocks: [
        { copy: "☐ Clear photo of me\n☐ Bio: specialty, ideal client, one trust detail, how to book\n☐ Every service: name, price, duration, what's included\n☐ 6+ recent photos of my own work\n☐ Hours I can keep\n☐ Deposit + cancellation policy in two lines\n☐ One booking link everywhere\n☐ Replies within a few hours", label: "Profile checklist" },
      ] },
      { id: "nearest", h: "On Nearest", blocks: ["Nearest shows students your name and photo separately from your business name and logo, your services and prices, portfolio, hours, languages and reviews. Professionals can edit every part anytime from Business."] },
    ],
    related: ["why-beauty-business-not-getting-bookings", "where-to-list-beauty-business-free", "first-10-clients-new-hairstylist"],
  },
  {
    slug: "repeat-clients-braiding-locs",
    title: "How to Build Repeat Clients for Braiding and Loc Services",
    h1: "How to build repeat clients for braiding and loc services",
    description: "Turn one-time braid and loc appointments into regular clients with maintenance schedules, honest timing, aftercare and simple rebooking.",
    intent: "Braider or loctician wants more returning clients.",
    topic: "Getting clients", audience: "pro", published: D, updated: D,
    summary: "Braids and locs have natural return cycles. Clients come back when you explain the cycle, book the next visit before they leave and protect their hair's health.",
    sections: [
      { id: "cycles", h: "Know and share the cycle", blocks: [
        { table: { head: ["Service", "Typical return", "What to book next"], rows: [
          ["Box or knotless braids", "Several weeks, depending on size and care", "Takedown + reinstall"],
          ["Cornrows / stitch braids", "A few weeks", "Fresh install"],
          ["Loc retwist", "Every few weeks", "Retwist"],
          ["Starter locs", "More frequent early on", "Maintenance visits"],
        ] } },
        "Give clients a realistic range based on their hair and lifestyle rather than one promise.",
      ] },
      { id: "honest-timing", h: "Be honest about time and price", blocks: ["Price by size and length, state whether hair is included, and give realistic durations. Clients return to professionals whose estimates hold."] },
      { id: "aftercare", h: "Protect their hair", blocks: [
        { ul: ["Avoid excessive tension at the hairline.", "Share scalp-care and night-time protection tips.", "Explain why leaving styles in too long can cause buildup and breakage."] },
      ] },
      { id: "rebook", h: "Book the next visit before they leave", blocks: [
        { copy: "Your braids should look great for about 6–8 weeks with good care. Want me to hold a takedown and reinstall for the week of the 20th?", label: "Rebooking script" },
      ] },
      { id: "loyalty", h: "Simple loyalty", blocks: ["Priority booking for regulars, a small free add-on every few visits, or a referral credit. Keep it easy to track."] },
    ],
    related: ["improve-beauty-profile-booking-conversion", "price-student-friendly-beauty-services", "get-more-beauty-clients-without-ads"],
  },
  {
    slug: "get-beauty-business-found-on-google",
    title: "How to Get Your Beauty Business Found on Google",
    h1: "How to get your beauty business found on Google",
    description: "Set up and maintain a Google Business Profile, choose categories, protect a home address, earn reviews and fix the most common visibility problems.",
    intent: "Professional wants to appear in Google local results.",
    topic: "Listings & visibility", audience: "pro", published: D, updated: D,
    summary: "For most local beauty businesses, a complete, verified, active Google Business Profile is the single most useful free visibility step. Nobody can guarantee rankings; you can give Google the clearest, most complete picture of your business.",
    sections: [
      { id: "claim", h: "1. Claim and verify your profile", blocks: ["Search for your business on Google Maps or go to Google Business Profile and follow the steps to add and verify it. Use your real business name — don't add keywords to it."] },
      { id: "category", h: "2. Choose accurate categories", blocks: ["Pick the most specific primary category (for example \"Nail salon\", \"Hair salon\", \"Barber shop\", \"Eyelash salon\"), then add secondary categories that truly apply."] },
      { id: "home", h: "3. Working from home or traveling? Use a service area", blocks: ["If clients don't visit a storefront, set a service area and hide your address. Share the exact address only with confirmed clients."] },
      { id: "complete", h: "4. Complete every section", blocks: [
        { ul: ["Services with prices or ranges.", "Hours you actually keep.", "Booking link.", "At least ten photos of your work and space.", "A description of what you specialize in."] },
      ] },
      { id: "reviews", h: "5. Earn reviews the right way", blocks: ["Ask every happy client, the same day, with a direct link. Respond to every review politely. Never buy, swap or fake reviews."] },
      { id: "active", h: "6. Stay active", blocks: ["Post an update or photo weekly, keep holiday hours current and answer questions. Keep your name, phone and area identical on every other listing."] },
      { id: "troubleshoot", h: "Not showing up?", blocks: [
        { ul: ["Check that the profile is verified and not suspended.", "Search from a location inside your service area.", "Confirm your category matches what people search.", "Give it time — changes can take weeks to appear."] },
      ] },
    ],
    related: ["where-to-list-beauty-business-free", "why-beauty-business-not-getting-bookings", "get-more-beauty-clients-without-ads"],
  },
];
