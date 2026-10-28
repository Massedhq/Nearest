// Rep Campaign Guide — one source for the rep dashboard (/rep) and the public rep dashboard demo (/reps/demo).
// Plain data (no server-only) so the client guide component can use it. Placeholders in scripts:
//   {LINK} = the rep's professional sign-up link, {NAME} = the rep's first name, {CITY} = the campaign's focus area,
//   {CATEGORY} = the campaign's service category.
// Copy rules (owner): always send pros to sign up through the rep's link; never tell pros to list anywhere else;
// never explain how Nearest makes money (it's a "booking fee"); never center one city or state; never say who owns
// Nearest; never promise clients, bookings or income (Sales Ambassador Agreement, section 5).

export const CAMPAIGN_CATEGORIES = ["Nail techs", "Lash artists", "Hairstylists", "Braiders", "Barbers", "Brow artists", "Makeup artists", "Estheticians", "Locticians", "Massage therapists"] as const;
export const CAMPAIGN_TIMEFRAMES = ["1 week", "2 weeks", "30 days", "60 days"] as const;

export const CORE_MESSAGE = "Nearest connects beauty professionals with students looking for affordable beauty services nearby — and joining is free.";

export type Script = { id: string; title: string; when: string; text: string };
export type GuideBlock = { id: string; title: string; intro?: string; points?: string[]; steps?: string[]; scripts?: Script[] };

export const CAMPAIGN_GUIDE: GuideBlock[] = [
  {
    id: "how",
    title: "How a campaign works",
    intro: "A campaign is a focused push: one area, a few service categories, a set amount of time, and your link in every conversation. Small and focused beats big and scattered.",
    steps: [
      "Pick your focus area — one city, a few neighborhoods, or the area around a beauty or trade school.",
      "Pick 1–3 service categories — for example nail techs and lash artists. Your dashboard's sign-ups by category show what's working.",
      "Set a timeframe — 2 weeks or 30 days is a good first campaign. Put a goal on it (for example 10 professionals started, 5 profiles complete).",
      "Make a list of where those professionals are (see Where to find professionals) and plan your week: visits, DMs, school contacts.",
      "Share your professional link in every message, card and post. Anyone who signs up within 30 days of tapping your link counts for you.",
      "Follow up — most professionals need a second nudge to finish their profile. Check your dashboard every few days.",
      "At the end, look at sign-ups by city and category, keep what worked, and start the next campaign.",
    ],
  },
  {
    id: "find",
    title: "Where to find professionals — online and in person",
    points: [
      "In person: salons, barbershops, nail salons, lash and brow studios, braiding shops, suite buildings (salon suites have many independent pros in one place), beauty supply stores (ask if there's a community board), and pop-up events.",
      "Instagram: search hashtags with your city — #[city]nails, #[city]lashtech, #[city]braider, #[city]barber, #[city]hairstylist — and check who's tagged at local salons and suites.",
      "TikTok: search \"[city] nail tech\", \"[city] lash tech\", \"[city] braids\" and look at local creators posting their work.",
      "Facebook: local beauty professional groups, salon suite groups, and community groups for your area (follow each group's rules about promotion).",
      "Booking-link bios: many pros have a link in their bio — that tells you they take clients on their own and would benefit from more.",
      "Beauty and barber schools: graduating students and recent grads building their book of clients (see Approaching schools).",
      "Professionals already on Nearest: ask the pros you signed up who else they know — friends from school, suite neighbors, the stylist next chair over.",
      "Local beauty events: hair shows, bridal expos, vendor markets, product launches and community events where pros set up booths.",
    ],
  },
  {
    id: "pros",
    title: "How to approach professionals",
    points: [
      "Lead with them, not Nearest: compliment real work you saw on their page or in the shop before you pitch.",
      "Keep it short: one sentence on what Nearest is, one on why it helps them, then your link. The core message: " + CORE_MESSAGE,
      "Respect their time: in person, never interrupt a client. Ask the front desk for a good time or leave a card with your link.",
      "Answer honestly: if you don't know something, say you'll find out — never guess about money, rules or how many clients they'll get.",
      "If they ask about cost: joining is free, there's no monthly fee, and each booking includes a small booking fee that's shown in the price clients see. Don't go into how Nearest makes money.",
      "Always end with your link: they sign up on Nearest through your link — never send them anywhere else to list.",
      "One person at a time: every DM, email and text is personal and one-to-one. No bulk, copy-blast or automated messages.",
    ],
  },
  {
    id: "schools",
    title: "Approaching beauty and trade schools",
    intro: "Cosmetology, esthetics, nail, barber and trade schools are full of new professionals who need clients. Work with the adults who run the programs — never with students under 18.",
    points: [
      "Who to talk to: the program director or school director, cosmetology/barbering/esthetics instructors, career services or job-placement coordinators, the admissions or alumni coordinator, and advisors of student or alumni groups.",
      "How to reach them: call the front desk and ask who handles career services or student opportunities; ask for 10 minutes in person; follow up by email with your link.",
      "What to offer: a free way for their graduates and licensed students to get clients and build their portfolio — including Model Calls, where pros offer discounted appointments to practice and grow their portfolio.",
      "Ask for: permission to leave cards or a flyer on the student board, a 5-minute visit at the end of a class, or a mention in their graduate or alumni newsletter.",
      "Timing: graduation months and licensing exam season are when new professionals are looking for clients.",
      "High schools: don't approach high schools, high school staff or high school students for this program. Many Nearest students are under 18, so Nearest handles school-district relationships directly.",
      "Never collect student information, and never ask anyone for their ID, passwords or school details.",
    ],
    scripts: [
      { id: "school-call", title: "Phone call to a beauty school", when: "Calling the front desk", text: "Hi! My name is {NAME} and I work with Nearest, a platform that connects beauty professionals with students looking for affordable services nearby. I'd love to share it with your graduates and licensed students as a free way to find clients and build their portfolio. Who's the best person to talk to about career resources for your students?" },
      { id: "school-email", title: "Email to a program director", when: "After you get the right name", text: "Subject: A free way for your graduates to find clients\n\nHi [Name],\n\nI'm {NAME}, and I work with Nearest — a platform that connects beauty professionals with students looking for affordable beauty services nearby. Joining is free for professionals, and they can post Model Calls to practice and build their portfolio.\n\nI'd love to share it with your graduates and licensed students. Would it be possible to leave a flyer on your student board or share it in your next alumni or graduate update?\n\nHere's where they can sign up: {LINK}\n\nThank you for your time,\n{NAME}" },
    ],
  },
  {
    id: "ideas",
    title: "Campaign ideas",
    points: [
      "Salon suite sweep: pick one suite building and visit every suite in a week. Leave a card with your link where nobody's in.",
      "Category week: one category, one area — for example \"lash artists in {CITY}\" — DMs Monday to Wednesday, visits Thursday to Saturday.",
      "Instagram and TikTok DMs: 10 personal DMs a day to pros whose work you looked at, plus a follow-up 3–4 days later.",
      "School network: one beauty or barber school per week — call, visit, and follow up with an email.",
      "Event table: at a local beauty event or vendor market, talk to the pros with booths and share your link with a QR code.",
      "Pro-to-pro referrals: ask every professional you sign up for two names. Message them and mention who sent you (with permission).",
      "Finish-your-profile day: once a week, follow up with everyone who started but hasn't finished.",
    ],
  },
  {
    id: "ads",
    title: "Running Meta and Google ads",
    intro: "Ads that use Nearest's name, logo or trademarks — including search ads — need Nearest's written approval first (Sales Ambassador Agreement, section 5). Email support@usenearest.com with your plan, the ad text and images, and your budget before you launch. You pay for your own ads.",
    steps: [
      "Meta (Facebook and Instagram): run ads from your own page — never a page that looks like Nearest's. In Ads Manager choose the Traffic or Leads objective.",
      "If Meta asks whether your ad is about employment or a special category, answer honestly. Recruiting professionals can fall under Meta's Employment category, which limits age and gender targeting and needs at least a 15-mile radius.",
      "Location: your focus area with a radius around it. Interests: cosmetology, nail technician, eyelash extensions, barbering, hairdressing, beauty school.",
      "Placements: Instagram Reels and Stories work well — show a short clip of a pro's booking flow or a simple card with the core message.",
      "Google: a Search campaign with phrases like \"get more nail clients\", \"free booking for lash techs\", \"new barber clients near me\". Don't bid on the word Nearest.",
      "Start small: a few dollars a day for one week, then keep the ad that brings the most sign-ups on your dashboard.",
      "Every ad links to your professional link — never to another site or listing.",
      "Never promise clients, bookings or income in an ad.",
    ],
  },
  {
    id: "scripts",
    title: "Ready-to-use messages",
    intro: "Copy, then make it personal — use their name and something real about their work. Your link is already filled in.",
    scripts: [
      { id: "dm", title: "Instagram or TikTok DM", when: "First message to a professional", text: "Hey [Name]! Your work is so clean — I love [something specific]. I work with Nearest, a platform that connects beauty pros with students looking for affordable services nearby. Joining is free, and you set your own prices and hours. If you want to check it out, here's my link: {LINK}" },
      { id: "email", title: "Email to a professional", when: "When they list an email on their page", text: "Subject: More clients nearby — free to join\n\nHi [Name],\n\nI came across your work and had to reach out — [something specific]. I'm {NAME}, and I work with Nearest. Nearest connects beauty professionals with students looking for affordable beauty services nearby.\n\nJoining is free. You build your profile, set your own services, prices and hours, and clients book and pay right in the app. You can also post Model Calls when you want to practice something new or grow your portfolio.\n\nYou can sign up here: {LINK}\n\nHappy to answer any questions.\n{NAME}" },
      { id: "pitch", title: "Short in-person pitch", when: "Visiting a salon, suite or shop", text: "Hi, I'm {NAME} — I work with Nearest. It's a platform that connects beauty professionals with students looking for affordable beauty services nearby. It's free to join, you set your own prices and hours, and clients book and pay in the app. Can I leave you my link? It takes a few minutes to sign up." },
      { id: "followup", title: "Follow-up message", when: "3–4 days later, or when they started but didn't finish", text: "Hey [Name], just checking in! If you started your Nearest profile, you're almost there — add your services, hours and a few photos of your work, then submit it. Once your profile is approved, students nearby can find and book you. Here's the link again if you need it: {LINK}" },
      { id: "text", title: "Text after meeting in person", when: "Only if they gave you their number and said it's okay", text: "Hi [Name], it's {NAME} from Nearest — great meeting you today! Here's the link to sign up: {LINK}. Text me if you have any questions." },
      { id: "cap1", title: "Social post caption", when: "Your own Instagram, TikTok or Facebook", text: "Beauty pros: students are looking for affordable nails, lashes, hair and braids near them — and Nearest connects you with them. Free to join, your prices, your hours. Sign up through the link in my bio: {LINK}" },
      { id: "cap2", title: "Social post caption — new grads", when: "Graduation and licensing season", text: "Just graduated from beauty or barber school? Build your book of clients and your portfolio with Nearest — it connects new professionals with students looking for affordable beauty services nearby. Free to join: {LINK}" },
      { id: "cap3", title: "Social post caption — Model Calls", when: "Pros who want to practice", text: "Want to practice a new technique and grow your portfolio? Post a Model Call on Nearest and connect with students nearby. Joining is free — sign up here: {LINK}" },
    ],
  },
  {
    id: "rules",
    title: "Brand rules — always",
    points: [
      "Send every professional to sign up on Nearest through your link. Never tell anyone to list on another app, website or directory.",
      "Don't explain how Nearest makes money. If asked about cost: free to join, no monthly fee, and a booking fee is included in the price clients see.",
      "Don't center Nearest on one city or state — talk about the area you're working in, not where Nearest is \"from\".",
      "Don't say who owns Nearest or who is behind it.",
      "Never promise clients, bookings, income or results. Describe only what Nearest has published.",
      "No bulk, automated or unsolicited messages — one personal message at a time.",
      "Never contact or collect information from anyone under 18, and never ask for IDs, passwords, school or payment details.",
      "No gifts or money for sign-ups, no signing people up yourself, and no pages, ads or accounts that look like Nearest's own without written approval.",
    ],
  },
  {
    id: "track",
    title: "Tracking and following up",
    points: [
      "Your dashboard counts link taps and every sign-up made within 30 days of someone tapping your link.",
      "Professionals by status: Started (account made, profile not finished), Profile complete (submitted for review), Live (approved and showing to students), First booking.",
      "Sign-ups by city and category show which part of your campaign is working — do more of that.",
      "Follow up with everyone in Started: send the follow-up message, offer to walk them through it in person, and remind them that photos of their work matter.",
      "Profile complete but not Live yet: Nearest is reviewing them — no action needed unless Nearest sends something back to them.",
      "Professionals are shown by business name; students are never named.",
    ],
  },
];

export const fillScript = (text: string, v: { link: string; name: string; city?: string; category?: string }) =>
  text.replaceAll("{LINK}", v.link).replaceAll("{NAME}", v.name).replaceAll("{CITY}", v.city || "your area").replaceAll("{CATEGORY}", (v.category || "beauty").toLowerCase().replace(/s$/, ""));
