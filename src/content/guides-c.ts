import type { Guide } from "./guides";

const D = "2026-10-20";

// Guides for students and parents — real money and safety questions, not promotion.
export const GUIDES_C: Guide[] = [
  {
    slug: "save-on-beauty-and-grooming-as-a-student",
    title: "How Students Can Save on Beauty, Grooming and Self-Care",
    h1: "How students can save on beauty, grooming and self-care — without cutting corners",
    description: "Practical ways for high school, college, trade school and online students to spend less on hair, nails, lashes, barbers and skincare while staying safe.",
    intent: "Student wants affordable beauty and grooming services and doesn't know where savings actually come from.",
    topic: "For students & parents", audience: "student", published: D, updated: D,
    summary: "The biggest savings come from choosing the right version of a service, booking at the right time and making results last — not from the cheapest price you can find. Here's how to spend less without risking a bad result.",
    sections: [
      { id: "budget", h: "Start with a yearly self-care budget", blocks: [
        "Most of what students spend on beauty and grooming is predictable: haircuts every few weeks, braids or a protective style a few times a year, nails before events. Writing it down shows where money actually goes.",
        { table: { head: ["Service", "How often", "Per visit", "Per year"], rows: [
          ["Haircut / lineup", "Every 3–4 weeks", "$__", "$__"],
          ["Braids / protective style", "Every 6–8 weeks", "$__", "$__"],
          ["Nails", "Before events", "$__", "$__"],
          ["Lashes / brows", "Every 2–4 weeks", "$__", "$__"],
          ["Events (prom, homecoming, graduation)", "1–3 a year", "$__", "$__"],
        ], caption: "Fill in your own prices — the totals tell you where a change saves the most." } },
      ] },
      { id: "version", h: "Choose the version of the service that fits your budget", blocks: [
        { ul: [
          "Length and size change the price most: shoulder-length braids or a shorter nail set can cost far less than the longest options.",
          "Simpler designs: solid colors or one accent nail instead of full art; classic lashes instead of volume.",
          "Maintenance instead of a full redo: a refill, retwist or lineup between full services.",
          "Ask what's included — hair, removal, design — so there are no surprises.",
        ] },
      ] },
      { id: "timing", h: "Book at the right time", blocks: [
        { ul: [
          "Weekday and after-school times are often easier to get and sometimes priced lower.",
          "Event weeks fill fast — booking early avoids rush fees or settling for whoever's left.",
          "Practice or model appointments can cost less; expect a longer appointment and portfolio photos, and read the requirements.",
        ] },
      ] },
      { id: "last", h: "Make results last longer", blocks: [
        { ul: ["Sleep on a satin pillowcase or wear a bonnet or durag to protect styles.", "Follow aftercare for lashes (no oil-based products near them for the first day) and nails (gloves for cleaning).", "Ask your professional how long the service should last and how to stretch it."] },
        "A style that lasts two extra weeks can save more than any discount.",
      ] },
      { id: "safe", h: "Saving money safely", blocks: [
        { ul: [
          "Look at recent photos of the professional's own work, not just the price.",
          "Keep messages and payments in a booking platform rather than cash apps with strangers.",
          "Mention allergies or sensitivities before the appointment and ask for a patch test if unsure.",
          "If something feels wrong, you can leave — no deal is worth feeling unsafe.",
        ] },
      ] },
      { id: "nearest", h: "How Nearest helps", blocks: [
        "Nearest is built so self-care can be student-priced: no service costs more than $150, add-ons included, the price you see already includes Nearest's $5 booking fee, and you request, pay and check in inside the app with verified professionals.",
        { cta: "student", title: "Find student-friendly professionals near you", text: "Create a free student account, verify you're a student, and compare haircuts, braids, nails, lashes and more by price in your city." },
      ] },
    ],
    faq: [{ q: "Is it OK to ask a professional for a cheaper option?", a: "Yes — ask what changes the price (length, size, design) and whether there's a simpler version. Most professionals would rather adjust the service than lose a client." }],
    endCta: { title: "Make self-care student-priced", text: "Sign up free, verify you're a student, and book with professionals near you. If Nearest isn't open in your city yet, check your city and ask to be told when it is." },
    related: ["student-grooming-on-a-budget", "prom-homecoming-beauty-budget", "parents-guide-teen-beauty-appointments"],
  },
  {
    slug: "student-grooming-on-a-budget",
    title: "Student Grooming on a Budget: Haircuts, Fades, Lineups and Beard Care",
    h1: "Student grooming on a budget: haircuts, fades, lineups and beard care",
    description: "How students can keep a fresh cut for less — choosing a barber, timing cuts, maintaining between visits and what to look for in a safe, clean shop.",
    intent: "Student wants to stay fresh without spending a lot on haircuts.",
    topic: "For students & parents", audience: "student", published: D, updated: D,
    summary: "Staying fresh is mostly about rhythm: the right cut for how fast your hair grows, a lineup between full cuts, and a barber you trust who runs on time.",
    sections: [
      { id: "rhythm", h: "Find your haircut rhythm", blocks: [
        { table: { head: ["Style", "Looks fresh for", "Between cuts"], rows: [
          ["Skin or low fade", "About 1–2 weeks", "Lineup to stretch it"],
          ["Taper", "About 2–3 weeks", "Lineup or neck cleanup"],
          ["Longer top / scissor cut", "About 4–6 weeks", "Usually nothing needed"],
          ["Beard shaping", "About 1–2 weeks", "Trim at home with a guard"],
        ], caption: "Hair grows at different speeds — use this as a starting point and adjust." } },
        "If money is tight, choose a style that grows out gracefully (a taper instead of a skin fade) and you'll need fewer visits.",
      ] },
      { id: "choose", h: "Choosing a barber or stylist", blocks: [
        { ul: ["Recent photos of cuts like the one you want, on hair like yours.", "Clear prices — and what costs extra (beard, design, enhancements).", "Clean tools and a clean station; ask how they sanitize.", "On-time starts — a barber who respects your schedule is worth it."] },
      ] },
      { id: "between", h: "Maintain between visits", blocks: [
        { ul: ["Moisturize and brush daily for waves or curls.", "Keep a beard oil and a soft brush; trim stray hairs only.", "Don't try to line yourself up the day before an event — book a quick lineup instead."] },
      ] },
      { id: "save", h: "Ways to spend less", blocks: [
        { ul: ["Book a standing appointment so you're not paying for rush slots.", "Ask about a lineup-only price between full cuts.", "Try a newer barber's practice or model appointment with clear expectations."] },
      ] },
      { id: "nearest", h: "Book barbers and stylists on Nearest", blocks: [
        "The Barber and Hair categories show professionals near you with prices up front, their recent cuts, open times and reviews from students who completed an appointment. You request a time, they accept, and you pay in the app.",
        { cta: "student", title: "Find a barber near you", text: "Create a free student account to see barbers and stylists in your city and book a fresh cut at a student-friendly price." },
      ] },
    ],
    endCta: { title: "Stay fresh for less", text: "Sign up free as a student and book cuts, lineups and beard trims near you. Check your city to see what's available." },
    related: ["save-on-beauty-and-grooming-as-a-student", "prom-homecoming-beauty-budget", "parents-guide-teen-beauty-appointments"],
  },
  {
    slug: "prom-homecoming-beauty-budget",
    title: "Prom and Homecoming Beauty Budget Planner for Students and Parents",
    h1: "Prom and homecoming beauty budget planner for students and parents",
    description: "Plan hair, makeup, nails, lashes and grooming for prom or homecoming: a timeline, a budget worksheet, questions to ask and ways to save.",
    intent: "Student or parent planning event beauty costs and timing.",
    topic: "For students & parents", audience: "student", published: D, updated: D,
    summary: "Event beauty gets expensive when it's booked late and piece by piece. Decide what matters most, set a budget, and book four to six weeks ahead.",
    sections: [
      { id: "priorities", h: "Decide what matters most", blocks: ["Pick one or two services to invest in (for many students, hair or makeup) and keep the rest simple. Photos remember the overall look, not every detail."] },
      { id: "worksheet", h: "Budget worksheet", blocks: [
        { copy: "Total event beauty budget: $____\n  Hair / braids / cut ........ $____\n  Makeup (and trial?) ......... $____\n  Nails ....................... $____\n  Lashes / brows .............. $____\n  Grooming (cut, lineup, beard) $____\n  Travel / extra time fees .... $____\n  Tip (if you tip) ............ $____\nLeft for the outfit, tickets, photos: $____", label: "Copy and fill in" },
      ] },
      { id: "timeline", h: "Timeline", blocks: [
        { table: { head: ["When", "What to do"], rows: [
          ["6–8 weeks before", "Set the budget; save photos of looks you like"],
          ["4–6 weeks before", "Book hair, makeup and nails; ask about trials"],
          ["2–3 weeks before", "Makeup or hair trial; braids if they need time to settle"],
          ["1 week before", "Lashes, brows, haircut; confirm every time and address"],
          ["1–2 days before", "Nails, lineup; lay out what to bring"],
          ["Day of", "Leave buffer time — appointments can run long"],
        ] } },
      ] },
      { id: "ask", h: "Questions to ask before booking", blocks: [
        { ul: ["How long will it take on the day?", "What's included, and what costs extra?", "Do you offer a trial?", "What's your cancellation policy?", "For students under 18: do you need a parent's consent, and can a parent come?"] },
      ] },
      { id: "save", h: "Ways to save", blocks: [
        { ul: ["Get ready with friends — some professionals offer group times.", "Choose a style that lasts (braids can carry from homecoming week through the dance).", "Skip extras you won't notice in photos.", "Book early to avoid last-minute premiums."] },
      ] },
      { id: "nearest", h: "Booking event appointments on Nearest", blocks: [
        "Verified students can compare event services by price, see each professional's work, add optional extras and request a time; payment happens in the app after the professional accepts. Students 13–17 need a parent or guardian's approval to book.",
        { cta: "student", title: "Book your event look early", text: "Create a free student account now so you can request hair, makeup, nails or lashes as soon as you know your event date." },
      ] },
    ],
    endCta: { title: "Plan your event look on Nearest", text: "Sign up free, verify you're a student, and request event appointments with prices shown up front. Parents approve accounts for students 13–17." },
    related: ["save-on-beauty-and-grooming-as-a-student", "parents-guide-teen-beauty-appointments", "student-grooming-on-a-budget"],
  },
  {
    slug: "parents-guide-teen-beauty-appointments",
    title: "A Parent's Guide to Teen Beauty and Grooming Appointments",
    h1: "A parent's guide to teen beauty and grooming appointments",
    description: "What parents and guardians should check before a teen books hair, nails, lashes or grooming: safety, consent, payment, communication and red flags.",
    intent: "Parent wants to know how to keep a teen's beauty appointments safe.",
    topic: "For students & parents", audience: "student", published: D, updated: D,
    summary: "Most teen beauty appointments are routine. A few checks before booking — who the professional is, where it happens, how you'll pay and communicate — make them safer and less stressful.",
    sections: [
      { id: "before", h: "Before booking", blocks: [
        { ul: [
          "Look at the professional's recent work and reviews together.",
          "Know where the appointment happens and how your teen gets there and back.",
          "Check whether the service needs a parent's consent under your state's rules or the professional's policy — some services aren't allowed for minors at all.",
          "Agree on a budget and who pays.",
        ] },
      ] },
      { id: "during", h: "During the appointment", blocks: [
        { ul: ["You're usually welcome to come — ask ahead.", "Your teen should mention allergies or sensitivities (adhesives, dyes, acrylics).", "Keep communication in the Nearest app rather than personal numbers or social media.", "Your teen can stop an appointment if something feels wrong."] },
      ] },
      { id: "red-flags", h: "Red flags", blocks: [
        { ul: ["Asking to move the conversation to private messages or a personal number.", "Pressure to pay outside Nearest.", "Changing the location at the last minute.", "No photos of their own work, or reluctance to answer basic questions."] },
      ] },
      { id: "payment", h: "Payment and cancellations", blocks: ["Book through Nearest, where payment is held until the appointment is done, and read the cancellation rules before booking so a missed appointment doesn't cost more than it should."] },
      { id: "nearest", h: "How Nearest handles teens", blocks: [
        { ul: [
          "Students 13–17 can't book until a parent or guardian approves from an email Nearest sends them.",
          "Professionals' identities are checked by Nearest (this isn't a background check).",
          "Phone numbers and emails aren't shared between students and professionals; messages stay in the app.",
          "Services marked 18+ only can't be booked by students under 18.",
          "The appointment address is shared only on the appointment day.",
          "Nearest isn't affiliated with any school or school district.",
        ] },
      ] },
    ],
    endCta: { title: "A safer way for your teen to book", text: "Nearest verifies students, checks professionals' identities, keeps messages in the app and asks parents to approve accounts for students 13–17. Your teen can create a free student account; you'll get an approval email." },
    faq: [{ q: "Can I book for my teen?", a: "On Nearest, students book from their own verified account; a parent or guardian approves accounts for students 13–17 and is responsible for payments on a minor's account." }],
    related: ["prom-homecoming-beauty-budget", "save-on-beauty-and-grooming-as-a-student", "student-grooming-on-a-budget"],
  },
];
