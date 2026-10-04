import "server-only";
import { getSettings, type Settings } from "./settings";
import { money } from "./time";

// "How Nearest works" guides. Every number comes from the rules engine (platform_settings),
// so when an owner changes a rule in Admin → Rules & Settings, the guide changes with it.

export type GuideTopic = { q: string; a: string[]; steps?: string[]; link?: { label: string; href: string } };
export type GuideSection = { id: string; title: string; icon: string; topics: GuideTopic[] };
export type GuideAudience = "student" | "pro" | "admin";

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function rules(s: Settings) {
  const n = (k: string) => Number(s[k]);
  return {
    advance: n("booking.advance_hours"),
    cutoff: clock(String(s["booking.same_day_cutoff"])),
    sameDayNotice: n("booking.same_day_min_notice_hours"),
    grace: n("appt.grace_minutes"),
    radius: n("appt.checkin_radius_ft"),
    msgDays: n("appt.messaging_days"),
    deposit: money(n("appt.deposit_cents")),
    cancelHours: n("cancel.cutoff_hours"),
    noShowLimit: n("enforce.customer_noshow_limit"),
    studentSuspDays: n("enforce.customer_suspension_days"),
    completionHours: n("enforce.completion_hours"),
    fine: money(n("enforce.fine_cents")),
    fineDue: n("enforce.fine_due_days"),
    incidentLimit: n("enforce.pro_incident_limit"),
    proSuspDays: n("enforce.pro_suspension_days"),
    unpaidDays: n("enforce.unpaid_fine_termination_days"),
    firstIn: n("growth.founding_capacity"),
    perCity: n("growth.target_per_city"),
    perCategory: Math.max(n("growth.target_per_category") || 5, n("growth.cap_per_category") || 10),
    firstInPerCategory: n("growth.target_per_category") || 5,
    marketGoal: n("growth.market_goal") || 1500,
    subDays: n("sub.termination_days"),
  };
}

type R = ReturnType<typeof rules>;

const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

// ---------------------------------------------------------------- Students
function student(r: R): GuideSection[] {
  return [
    {
      id: "start", title: "Getting started", icon: "sparkle", topics: [
        { q: "What is Nearest?", a: ["Nearest connects verified students with verified beauty professionals near them — hair, braids, locs, lashes, brows, nails, makeup, barbers and more. You find a pro, pick a time, pay, and finish the whole appointment in the app."] },
        { q: "How do I get verified?", a: ["Only verified students can book. It takes a couple of minutes, and a Nearest team member reviews it — usually within a day."], steps: ["Choose your school. Can't find it? Tap \"Can't find my school?\" and tell us — we'll add it while we review you.", "Take a photo of your current school ID and a selfie.", "Optionally pick what you might book and how you like to communicate.", "Wait for approval. You'll get a notification when you're verified."], link: { label: "Verification status", href: "/verify/status" } },
        { q: "Can I browse before I'm verified?", a: ["Yes. As soon as your account is created you can browse professionals, view their work and save favorites. Booking opens once your student account is verified (and, if you're under 18, once your parent approves). Explore shows a \"Finish verifying to book\" bar until then."] },
        { q: "I don't have my school ID with me.", a: ["Tap \"I don't have my school ID with me\" (right under the school ID photo) and just take your selfie — your account is created. Then finish one of two ways: take or upload a photo of your school ID (your selfie is already saved), or verify with your school email. No email or ID right now? Tap \"I'll finish verifying later\" to keep setting up your account — we'll remind you to come back. We send a 6-digit code to your school email; enter it and you get temporary access right away while Nearest finishes reviewing. Personal emails (Gmail, Yahoo, AOL, Hotmail, Zoho and so on) can't be used."] },
        { q: "What happens to my school ID photo?", a: ["It's only used to confirm you're a student at your school. It's viewed by the Nearest team only, and it's deleted as soon as we make a decision."] },
        { q: "I'm under 18. Can I use Nearest?", a: ["Yes, if you're 13 to 17 and your parent or legal guardian approves. When you sign up, Nearest emails them a link — they review the Terms, check the approval box and type their name. You can finish your student verification while you wait, but you can't book until they approve. Wrong email? You can resend it or change it from the waiting screen.", "Some services are marked 18+ only. You won't be able to book those, and a professional may ask for a parent's permission before serving a minor."], link: { label: "Read the Terms", href: "/terms" } },
        { q: "What happens when I graduate?", a: ["Nothing changes — you keep your account, credits, favorites and bookings. Once you're verified, you're verified for good; there's no yearly re-check. After your graduation year, your badge changes from Verified Student to Nearest Alumni."] },
      ],
    },
    {
      id: "find", title: "Finding a professional", icon: "compass", topics: [
        { q: "How do I search?", a: ["Everything is in the Find a professional box on Explore. Two ways to search: type a service or a pro's name and tap the Search button in that box, or choose from the dropdowns — Where, a category, then the service you want (or \"All\") — and tap Search under them. Your results show right below.", "If nobody matches, Nearest tells you what isn't available yet (for example, \"No lash artists in your area yet\") and shows the closest professionals it has."] },
        { q: "What do Available Today, After School and Under $25 do?", a: ["Available Today shows pros who posted openings for today. After School shows pros with openings after class. Under $25 shows services that cost $25 or less. You can turn on more than one — tap \"Clear all\" to reset."] },
        { q: "What is Near Me?", a: ["Tap Near Me and allow location to sort pros by distance from where you are. Your location is only used to sort — it isn't shown to anyone."] },
        { q: "Can I find professionals who communicate in ASL?", a: ["Yes. Turn on the ASL option (set it in Communication preferences on your Account) and Explore shows only pros who communicate in ASL. Tap the banner to show everyone again."], link: { label: "Communication preferences", href: "/verify/access" } },
        { q: "How much do services cost?", a: ["Every price is shown upfront — no \"DM for price.\" No service on Nearest costs more than $150 for students. If a pro travels to you, their flat travel fee is shown before you pay."] },
        { q: "What's on a pro's profile?", a: ["Their services and prices, how far away they are, their portfolio, verified reviews from real appointments, their Instagram or TikTok, and whether they come to you, you go to them, or both.", "Tap any portfolio photo or video to see it full screen (videos play right there, up to 15 seconds). If it's tagged with a service, tap \"Book this look\" to book exactly that."] },
        { q: "Why can't I book a professional yet?", a: ["Nearest opens booking city by city. If a Book button is greyed out, we're still filling that market — tap it and you'll see \"We're currently filling this market.\" You'll be notified as soon as booking opens there. If you're not verified yet, tapping Book shows how to finish."] },
        { q: "Why am I seeing professionals farther away?", a: ["If there's nobody in your area yet, Explore says \"This market is currently being filled\" and shows professionals within 50 miles, closest first."] },
        { q: "How do I save a pro?", a: ["Tap the heart on their card or profile. Everyone you've hearted is in Favorites, so you can rebook in a couple of taps."], link: { label: "My favorites", href: "/favorites" } },
      ],
    },
    {
      id: "book", title: "Booking & paying", icon: "cal", topics: [
        { q: "How do I book?", a: ["Pick a service, choose a day and time, choose where (at the pro's place or yours, if they travel), agree to the booking terms, and pay. You'll see \"You're Booked\" when it's done."], steps: ["Open a pro and tap a service.", "Pick a day and a time — only times they're really free show up.", "Choose where the appointment happens.", "Check the total, agree to the terms, and pay."] },
        { q: "How far ahead do I have to book?", a: [`Normal bookings need at least ${r.advance} hours' notice. For same-day, book from a pro's Available Today openings before ${r.cutoff}, at least ${r.sameDayNotice} hours before the start time.`] },
        { q: "When do I pay, and where does my money go?", a: ["You pay in full when you book. Nearest holds it safely until your appointment is finished and you release it. If you don't finish paying, your time is held for a few minutes and then it's given back."] },
        { q: "What's a travel fee?", a: ["Pros who come to you can charge a flat travel fee. It's only added when you choose to have them come to you, and you'll see it before you pay."] },
        { q: "How do I get $5 off by inviting friends?", a: ["Once you're verified, your Account page has an Invite friends card with your own link. When a friend signs up with it and gets verified, you both get a $5 invite reward — for every friend who joins.", "Each reward takes $5 off one booking, used automatically on your first booking with a professional. Only one per booking (they can't be combined), and they don't apply to Model Calls. If the booking is cancelled or never paid, the $5 comes back."], link: { label: "Invite friends", href: "/account#invite" } },
        { q: "What are credits?", a: ["Credits are money on your Nearest account from a cancellation. They're applied automatically at checkout. Some credits work with any pro; some only with the pro they came from. Credits never expire, but they can't be transferred or withdrawn as cash."], link: { label: "My credits", href: "/credits" } },
        { q: "What does 18+ only mean?", a: ["Some services can only be booked by adults. They're tagged 18+ on the profile, and Nearest uses your verified birthday to check."] },
      ],
    },
    {
      id: "bundle", title: "Bundle my booking", icon: "grid", topics: [
        { q: "What is Bundle my booking?", a: ["Need several things done the same week — like hair, lashes, nails and makeup for an event? Bundle my booking finds professionals near you with openings that week whose prices fit your total budget."], link: { label: "Bundle my booking", href: "/bundle" } },
        { q: "How do I build a bundle?", a: [], steps: ["Tap Bundle my booking on Explore and pick at least two categories.", "Enter your total budget and the week you need it done (7 days starting the day you pick).", "For each category, Nearest shows one recommended professional at a time — tap View their work, then Save to bundle or Next person.", "Saved someone you changed your mind about? Remove them and pick another.", "When every category is saved, tap Book it and book each professional on a day during your week."] },
        { q: "How does the budget work?", a: ["Nearest only recommends professionals whose price fits what's left of your budget — and it keeps enough room for the categories you haven't filled yet, so your first pick can't use up everything."] },
        { q: "Can I finish later?", a: ["Yes. Your bundle is saved for 2 weeks. If it isn't booked by then, it's cleared automatically and you can start a new one anytime."] },
        { q: "Can I use credits on a bundle?", a: ["No. Credits and invite rewards only work on single bookings, so they stay in your account for those."] },
      ],
    },
    {
      id: "modelcalls", title: "Model Calls", icon: "sparkle", topics: [
        { q: "What is a Model Call?", a: ["Pros post Model Calls when they're practicing a new technique or building their portfolio — often at a lower price. You get the look, they get the practice."], link: { label: "Model Calls near me", href: "/model-calls" } },
        { q: "How do I sign up for one?", a: ["Open the Model Call, read the requirements and extra information, and book. Some have a set date and time. \"Open time\" calls let you pick a day and time that works for you until the call closes."] },
      ],
    },
    {
      id: "day", title: "Appointment day", icon: "pin", topics: [
        { q: "When do I get the address?", a: ["The exact address unlocks at 12:00 AM on your appointment day, and only you can see it. Before that you'll see the area and distance. Tap \"Get directions\" once it's unlocked."] },
        { q: "Will I get reminders?", a: ["Yes — about 24 hours and about 2 hours before your appointment, by email and in your notifications."], link: { label: "Notifications", href: "/notifications" } },
        { q: "How do I check in?", a: [`Check-in opens 60 minutes before your start time. When you arrive, open the appointment, take your check-in photo and tap Check in. You need to be within about ${r.radius} ft of the location, so turn on Location Services.`] },
        { q: "What if I'm running late?", a: [`Message your pro right away from the appointment. There's a ${r.grace}-minute grace period. After that, if you haven't checked in, the pro can mark you as a no-show.`] },
        { q: "How do I message my pro?", a: [`Every appointment has its own chat. Messaging stays open for ${r.msgDays} days after the appointment. Phone numbers and emails are never shared — keep everything in the app.`], link: { label: "Messages", href: "/messages" } },
        { q: "How do I finish my appointment?", a: ["When your pro taps Finish (or the scheduled end time passes), you'll get four quick steps. Please do all four before you leave."], steps: ["Confirm your service was completed — or tap \"No — report an issue.\"", "Take a photo of your finished look. You choose whether your pro may share it — even if you say yes, it stays private until they choose to show it with your review or in their portfolio.", "Rate your experience and add a review if you want.", "Release payment. This tells Nearest the appointment is done and pays your pro."] },
        { q: "What if I leave without finishing?", a: [`If your pro finished the service and you don't complete the steps within ${r.completionHours} hours, Nearest completes it for you, pays the pro, and pauses your booking access. Finish before you leave to avoid that.`] },
        { q: "Something went wrong at my appointment.", a: ["Open the appointment and tap Report a problem while you're still there — Nearest re-checks your location when you submit. A report doesn't automatically mean the pro is at fault; Nearest reviews it, and your payment stays protected meanwhile."] },
      ],
    },
    {
      id: "cancel", title: "Cancelling, no-shows & suspensions", icon: "alert", topics: [
        { q: "How do I cancel?", a: [`Open the appointment and tap Cancel appointment. If you cancel ${r.cancelHours}+ hours ahead, you get everything back as credit. Inside ${r.cancelHours} hours, the ${r.deposit} deposit goes to the pro and the rest comes back as credit. Nearest doesn't give cash refunds.`] },
        { q: "What if the pro cancels?", a: ["You get the full amount back as Nearest credit you can use with any pro."] },
        { q: "What happens if I'm a no-show?", a: [`The ${r.deposit} deposit goes to the pro, and the rest becomes credit you can use with that pro. After ${r.noShowLimit} no-shows, your next one pauses booking for ${r.studentSuspDays} days.`] },
        { q: "My booking is suspended. What now?", a: ["Explore shows why and the date booking comes back. You can still view your account and bookings, read messages, and keep your credits. If you think it's a mistake, request a review."], link: { label: "Request review", href: "/appeal" } },
      ],
    },
    {
      id: "social", title: "Connections & sharing", icon: "users", topics: [
        { q: "What are Connections?", a: ["Connections are classmates and friends you add on Nearest so you can send each other pros. Search by name or by username, tap Connect, and once they accept you're connected."], link: { label: "Connections", href: "/connections" } },
        { q: "Who can find me?", a: ["Anyone who knows your exact username can find you. If you're under 18, only students from your own school can find you by name."] },
        { q: "How do I share a pro?", a: ["On any pro's profile, favorite or booking, tap Share. Send it to a Connection inside the app, copy their link, or share it anywhere. Only accepted Connections can send you pros."] },
      ],
    },
    {
      id: "account", title: "Your account & safety", icon: "shield", topics: [
        { q: "How is Nearest kept safe?", a: ["Students verify with their school ID and a selfie. Pros are reviewed, ID-checked, and license-checked before they go live. Addresses stay private until the appointment day, check-in confirms location, payments are held until the service is done, and phone numbers and emails are never shared."] },
        { q: "Something on the site isn't working.", a: ["If something breaks, Nearest can send a problem report with a screenshot in one tap. You can also email support@usenearest.com anytime."] },
        { q: "How do I delete my account?", a: ["Go to Account → Delete my account. You can't delete while you have an upcoming appointment — finish or cancel it first."], link: { label: "Account", href: "/account" } },
      ],
    },
    {
      id: "parents", title: "For parents & guardians", icon: "user", topics: [
        { q: "How does Nearest protect my student?", a: ["Every student and every professional is verified. Addresses unlock only on the appointment day, check-in confirms your student is at the right place, payment is held until the service is done, and all messages stay in the app — phone numbers and emails are never shared."] },
        { q: "What do I agree to?", a: ["Students 13 to 17 need your permission. When your student signs up, Nearest emails you a link to review and approve (or decline). By approving, you agree to the Terms on their behalf and are responsible for their account and payments. Professionals are independent adults, and some may ask for your permission before serving a minor."], link: { label: "Terms of Service", href: "/terms" } },
        { q: "Can my student book adult services?", a: ["No. Services marked 18+ only can't be booked by anyone under 18 — Nearest checks their verified birthday."] },
        { q: "Who do I contact with questions?", a: ["Email support@usenearest.com."] },
      ],
    },
  ];
}

// ---------------------------------------------------------------- Professionals
function pro(r: R): GuideSection[] {
  return [
    {
      id: "join", title: "Joining Nearest", icon: "sparkle", topics: [
        { q: "What does it cost?", a: [`In DFW, First In is $11/month for your first 12 months and is limited to ${r.firstIn} pros; after that, DFW membership is $17/month. Houston and other markets are $20/month. After your first 12 months, memberships move to $30/month.`, "Your rate is locked to your account. Nearest takes no commission on your bookings — card-processing fees come out of each payment.", `Spots are limited in each city, for each category: the first ${r.firstInPerCategory} professionals get First In, the next ones (up to ${r.perCategory}) join at the next entry rate, and after that new professionals can join a free waitlist — or skip it by joining the next 750 at the next entry rate and going live right away. On the Join page, enter your ZIP code and main category to see your spot.`, "Joined with a special invitation? Ambassador accounts are free. Pay-from-bookings accounts have nothing to pay up front — each month Nearest keeps your monthly rate from your booking earnings, then the rest is yours. Business → Subscription shows how much is collected this month."], link: { label: "Subscription", href: "/pro/payments" } },
        { q: "When am I charged?", a: ["If bookings aren't open in your city yet, you save a card to claim your spot — nothing is charged. You build your profile while Nearest fills your city, and your membership (and your 12-month rate lock) starts the day bookings open there. If your profile isn't submitted by then, your spot is released and you're not charged. If bookings are already open in your city, your first month is charged when you join."] },
        { q: "How do I go live?", a: ["Use the Go live card on Today (also in Business). It lists anything still left; once everything's done, tap Go live and you show up in search, Near Me and All professionals. Tap Go offline anytime to hide.", "Payouts are never required to go live — anything you earn is held for you and sent once you connect your bank."], steps: ["Finish your profile setup and submit it.", "Nearest approves your profile.", "Your ID check is approved.", "Your membership is active (owners skip this)."], link: { label: "Today", href: "/pro/home" } },
        { q: "What if Nearest sends something back?", a: ["If Nearest can't approve your profile, ID check or license, you'll get an email and a notification with the exact reason and a button straight to the screen where you fix it. Your Today screen also lists it until it's fixed. Everything else you've done stays saved."] },
        { q: "What if my city is full?", a: ["Each city has a limited number of spots per category. If yours is full when you join, you can join the free waitlist (we'll tell you when a spot opens), or in DFW skip the waitlist by joining the next 750 at the $17 rate."] },
        { q: "What is the ID check?", a: ["Upload a photo of your driver's license or state ID and take a live selfie. A Nearest team member reviews it, usually within a day. If something's unclear, you'll be asked to send new photos."], link: { label: "ID & payments", href: "/pro/payments" } },
        { q: "Do I need a license?", a: ["For licensed services, yes. Add your license during setup and Nearest checks it before you go live.", "Just finished your program and waiting on your license? Choose \"Graduated — license pending\" and add your school, graduation date, and a photo or number of your diploma or certificate. Nearest reviews it, and your profile shows \"Recent graduate — license pending\" for those services. Only offer services your state allows before you're licensed, and add your license number as soon as you have it."], link: { label: "Licenses", href: "/pro/setup/credentials?edit=1" } },
      ],
    },
    {
      id: "setup", title: "Your profile", icon: "user", topics: [
        { q: "What are the setup steps?", a: ["Everything is under Business, and you can edit any of it later."], steps: ["Profile & photo — business name, bio, photo, Instagram/TikTok links, and your booking link name.", "Services & prices — up to $150 per service; mark any 18+ only.", "Location & travel — your address, whether you travel, how far, and your travel fee.", "Hours — weekly hours and after-school hours.", "Communication & accessibility — languages, ASL, how clients should reach you.", "Portfolio — up to 10 photos and 5 videos (15 seconds max), each tagged with a service.", "Licenses — then preview and submit."], link: { label: "My business", href: "/pro/business" } },
        { q: "Do I have to finish setup in one sitting?", a: ["No. Every step has Save & finish later — it saves what you've done and takes you to Today, where Continue setup picks up right where you left off. On Services, even half-finished services are kept as a draft. If you're away a while, we'll send a reminder."] },
        { q: "Is my address private?", a: ["Yes. Students only see how far away you are. A booked student sees your address at 12:00 AM on the appointment day, and only they see it."] },
        { q: "I'm moving to a different city. Can I transfer?", a: ["Yes. Update your address in Location & travel. If your new city has room in your category, you move right away. If it's full, saving sends Nearest a transfer request (add a note like \"I moved and work from home now\"). You stay listed in your current city until it's approved, and your membership and rate stay the same. You'll get an email and a notification either way."], link: { label: "Location & travel", href: "/pro/setup/location?edit=1" } },
        { q: "How does the travel fee work?", a: ["If you travel to clients, set a flat fee from $35 to $55 in Location & travel. It's only added when the student chooses to have you come to them. The $150 limit applies to the service, not the travel fee."], link: { label: "Location & travel", href: "/pro/setup/location?edit=1" } },
        { q: "What does 18+ only do?", a: ["Tick 18+ only under a service and Nearest blocks anyone under 18 from booking it, using their verified birthday. You still follow your own licensing rules."] },
        { q: "How do I make my portfolio book for me?", a: ["Show up to 10 photos and 5 videos (15 seconds max each — MP4, or straight from your phone's camera). Tag each one with the service it shows, and students can tap \"Book this look\" to book that exact service. Star your best work so it shows first."], link: { label: "Portfolio & social", href: "/pro/setup/portfolio?edit=1" } },
        { q: "What's my booking link?", a: ["Every pro gets a link like usenearest.com/pro-yourname. Put it in your Instagram and TikTok bio or send it in DMs — it opens your profile so students can book. You can change the name in Profile & photo."], link: { label: "Today", href: "/pro/home" } },
      ],
    },
    {
      id: "calendar", title: "Hours, calendar & openings", icon: "cal", topics: [
        { q: "How do students see my availability?", a: [`Students can only book times inside your weekly or after-school hours that aren't already booked or blocked. Normal bookings need ${r.advance} hours' notice, so you won't get surprise bookings.`], link: { label: "Calendar", href: "/pro/calendar" } },
        { q: "How do I block time or take a vacation?", a: ["In Calendar, use Block time for appointments outside Nearest, breaks or errands — the note is only for you. Turn on Vacation mode to hide all openings and Model Calls from new bookings."] },
        { q: "What is Available Today?", a: [`It's how you fill same-day gaps. Pick the times you're free today and publish — students see an Available Today badge on your profile. Same-day booking closes at ${r.cutoff}, and students need to book at least ${r.sameDayNotice} hours ahead. Uncheck every time and publish to clear them.`], link: { label: "Available Today", href: "/pro/today" } },
      ],
    },
    {
      id: "modelcalls", title: "Model Calls", icon: "sparkle", topics: [
        { q: "What is a Model Call?", a: ["A discounted spot for practicing a new technique or building your portfolio. Students see it in Model Calls near me and on your profile."], link: { label: "Model calls", href: "/pro/model-calls" } },
        { q: "How do I post one?", a: [], steps: ["Choose the service, price, length and how many spots.", "Pick a set date and time — or Open time, so models choose a time from your hours until the call closes.", "Add requirements, a photo of the look and any extra information.", "Publish. When all spots are taken, it shows as full."] },
        { q: "Can I cancel or delete a Model Call?", a: ["Tap Cancel model call on an upcoming one. Past or cancelled calls can be deleted to tidy your list."] },
      ],
    },
    {
      id: "appts", title: "Appointments", icon: "clock", topics: [
        { q: "How does an appointment work?", a: ["Everything happens on the appointment's page."], steps: ["The student checks in when they arrive — you get \"Your client has checked in.\"", "Tap Start service. A timer runs while you work.", "Tap Finish service & send completion steps.", "The student confirms, adds a photo and review, and releases payment."], link: { label: "Appointments", href: "/pro/appointments" } },
        { q: "What if my client doesn't show?", a: [`If they haven't checked in after the ${r.grace}-minute grace period, you can mark a no-show. You keep the ${r.deposit} deposit, and the rest becomes credit the student can only use with you.`] },
        { q: "What if they leave without finishing?", a: [`Nearest applies the completion policy: if they don't finish within ${r.completionHours} hours of you tapping Finish, you're paid automatically.`] },
        { q: "What if I have to cancel?", a: ["The student gets the full amount back as Nearest credit, and it counts toward your cancellation rate. Cancel only when you truly have to."] },
        { q: "How do I message clients?", a: [`Each appointment has its own chat, open for ${r.msgDays} days after the appointment. Phone numbers and emails are never shared.`], link: { label: "Messages", href: "/pro/messages" } },
        { q: "What's a Bundle Me booking?", a: ["Students can bundle several services for the same week (for example hair, lashes, nails and makeup) within a budget. When one of those bookings is with you, you get a notification and the appointment is marked \"Part of a Bundle Me booking.\" It's a normal paid booking — the student pays your full price, and credits and invite rewards can't be used on it."] },
        { q: "What's the $5 student invite reward?", a: ["Students who invite friends to Nearest earn $5 off. When a student uses it on their first booking with you, they pay $5 less and your payout for that booking is $5 less. You agreed to this when you joined — it's how Nearest rewards students for sharing the platform, and it keeps you booked. It never applies twice for the same student with you, and never to Model Calls. You'll see it on the appointment."] },
        { q: "How do reviews work?", a: ["Only students who completed an appointment with you can review you, so every review is real. Ratings help you rank in search."] },
        { q: "Where do my clients' photos go?", a: ["Every client takes a photo of their finished look. It goes to your private Client photos — never straight into your portfolio. From there you choose: show it with that client's review, add it to your portfolio, download it to your phone, or remove it. Showing or adding only works if the client allowed sharing."], link: { label: "Client photos", href: "/pro/client-photos" } },
      ],
    },
    {
      id: "money", title: "Getting paid", icon: "wallet", topics: [
        { q: "When do I get paid?", a: ["The student pays in full when they book. Nearest holds it until they release it at the end of the appointment. Then it goes to your bank through Stripe, minus card-processing fees — no commission. Stripe sets the bank transfer timing."], link: { label: "Earnings", href: "/pro/earnings" } },
        { q: "How do I set up payouts?", a: ["Go to Payments and connect your bank through Stripe. You can be bookable before this — anything you earn is held for you and sent automatically once you connect."], link: { label: "Payments", href: "/pro/payments" } },
        { q: "What do Pending release and Released mean?", a: ["Pending release is money from appointments the student hasn't released yet. Released is money that's on its way to, or already in, your bank."] },
        { q: "Where's my subscription?", a: ["Business → Subscription shows your plan, rate, card, invoices, and what happens if a payment fails."], link: { label: "Subscription", href: "/pro/payments" } },
      ],
    },
    {
      id: "standing", title: "Rules, fines & account status", icon: "shield", topics: [
        { q: "What gets a pro fined?", a: [`When Nearest confirms an on-site problem was the pro's fault, there's a ${r.fine} fine due in ${r.fineDue} days, and the student gets a full credit. Every ${ordinal(r.incidentLimit)} confirmed incident also suspends your profile for ${r.proSuspDays} days.`] },
        { q: "What if a fine goes unpaid?", a: [`Your profile is hidden until it's paid. After ${r.unpaidDays} days unpaid, Nearest may review whether to remove your account.`] },
        { q: "Where do I see my standing?", a: ["Business → Account status shows your fines, suspensions, confirmed incidents and reviews. You can pay a fine there or request a review of a fine or suspension."], link: { label: "Account status", href: "/pro/account-status" } },
        { q: "How do I delete my account?", a: ["Business → Delete account (owners see Remove my professional business). You can't delete while you have upcoming appointments or unpaid fines."] },
        { q: "Something isn't working.", a: ["If something breaks, Nearest can send a problem report with a screenshot in one tap. Or email support@usenearest.com."] },
      ],
    },
  ];
}

// ---------------------------------------------------------------- Admin
function admin(r: R): GuideSection[] {
  return [
    {
      id: "overview", title: "Overview", icon: "home", topics: [
        { q: "Command Center", a: ["Today at a glance: professionals, bookings today, professional MRR, and everything that needs attention — invitations waiting and students, pros and licenses to verify."], link: { label: "Open", href: "/admin" } },
        { q: "First In", a: [`Paid First In pros against the ${r.firstIn}-seat limit, invitation codes, and the enrollment phase (First In open, First In closed, or next entry open with Professional + Student and General). Only owners can change the phase. You set each invitation's expiration date and time when you create it, and invitations don't need a city.`, "The main owner also sees Special invitation: Ambassador (a free account — they share the main owner's link, so pros they bring in are credited to the main owner) or Pay from bookings (starts at $15/month; each month Nearest keeps that amount from their released booking money, then the rest is theirs; a month with no bookings costs nothing). Only the main owner can create these, and they work even when First In is closed."], link: { label: "Open", href: "/admin/founding" } },
        { q: "Service coverage", a: [`Open booking city by city: tap a city, then Open booking (owners only). That starts every waiting professional's membership on their saved card, moves anyone who already paid to 30 days from that day, releases spots for profiles never submitted (no charge), and notifies verified students there. Until then, students see those pros but Book shows "We're currently filling this market." The recruiting map: For every city: how many professionals Nearest has in each category, how many are live, and how many more are needed to reach ${r.perCategory} per category. It also shows First In progress, progress toward the market goal of ${r.marketGoal.toLocaleString()} professionals, and a Recruit next list — the biggest gaps in the cities with the most verified students. Tap a city for its full breakdown.`], link: { label: "Open", href: "/admin/service-coverage" } },
        { q: "Coverage", a: [`Every market's counties and cities, which cities have a live pro, and verified students. The goal is ${r.perCity} pros per city. Add cities by State + ZIP.`], link: { label: "Open", href: "/admin/coverage" } },
      ],
    },
    {
      id: "people", title: "People", icon: "users", topics: [
        { q: "Students", a: ["Every student account, their school and verification status, suspensions, and account actions.", "Each student shows as Verified Student or Nearest Alumni (past their graduation year — same access), and students under 18 show whether their parent approved, is pending, or declined."], link: { label: "Open", href: "/admin/students" } },
        { q: "Schools", a: ["The school directory, plus schools students asked for. Private high schools aren't in the public directories — add them here."], link: { label: "Open", href: "/admin/schools" } },
        { q: "Professionals", a: ["Every pro with status, cancel rate, and membership controls. Review account shows exactly what's blocking a pro from going live (profile, ID, membership, payouts), their money and checks, setup, and activity.", "Transfer requests show at the top: active members moving to a city that\u2019s full in their category. Approve applies their new location (and tells anyone waiting in their old city that a spot opened); deny sends them your reason. \"Remind everyone who hasn\u2019t finished\" (and \"Send setup reminder\" on a Review account page) emails pros who paid but haven\u2019t submitted their profile — never more than once in 12 hours."], link: { label: "Open", href: "/admin/professionals" } },
        { q: "Verification Queue", a: ["Approve or reject student IDs, pro IDs (license/state ID + selfie) and pro profiles. Every view of an ID is logged, and student ID photos are deleted on every decision.", "Anything you send back (profile, ID or license) emails and notifies the pro with your reason and a link to fix it — so keep reasons short and specific. Students who verified by school email show a green \"School email verified\" note; recent graduates show their diploma instead of a license."], link: { label: "Open", href: "/admin/verification" } },
      ],
    },
    {
      id: "ops", title: "Operations", icon: "cal", topics: [
        { q: "Bookings", a: ["Every booking with status, times, amounts and check-in details."], link: { label: "Open", href: "/admin/bookings" } },
        { q: "Incident Review", a: [`On-site complaints with the timeline (check-in, complaint, service start) and the check-in photo. Confirming professional fault gives the student full general credit, fines the pro ${r.fine} due in ${r.fineDue} days, and every ${ordinal(r.incidentLimit)} confirmed incident suspends them for ${r.proSuspDays} days.`], link: { label: "Open", href: "/admin/incidents" } },
        { q: "Enforcement", a: [`Outstanding and past-due fines, suspended pros and students, and automatic checks. Students are suspended for ${r.studentSuspDays} days after passing ${r.noShowLimit} no-shows. Pros with fines unpaid ${r.unpaidDays}+ days are listed as eligible for removal — nothing happens automatically; decide case by case.`], link: { label: "Open", href: "/admin/enforcement" } },
        { q: "Appeals", a: ["Review requests from students (suspensions) and pros (fines and suspensions). Uphold or overturn with a decision reason — overturning reverses the action."], link: { label: "Open", href: "/admin/appeals" } },
        { q: "Problem reports", a: ["Automatic error reports from anyone on the site, with a screenshot of what they saw. Each is also emailed to support@usenearest.com."], link: { label: "Open", href: "/admin/reports" } },
      ],
    },
    {
      id: "business", title: "Business", icon: "chart", topics: [
        { q: "Professional Outreach", a: ["Each partner works their own recruiting here and sees their own results; the main owner can switch to Everyone. Your recruiter link is at the top of the Outreach dashboard — every professional who joins through it (from outreach, Facebook groups, QR codes, anywhere) is credited to you.", "Add prospect adds one professional; Bulk import reads Excel, CSV, Word or PDF lists (or a pasted list) and shows a review screen first — nothing is contacted until you approve. Nearest checks every partner's prospects, existing accounts and the do-not-contact list, so one professional is only ever worked once.", "When a prospect creates a Nearest account they're marked Registered automatically and never recruited again; submitting their profile marks them Profile complete. Markets shows how full each city's categories are — the same count the Join page enforces — so you know what to prospect next. ", "Templates is where you write exactly what goes out: the first email and two follow-ups, with fill-ins like {first_name}, {city}, {category} and {link} (their personal invite, good for 24 hours and credited to whoever owns the prospect). Preview them, email yourself a test, and add your mailing address (required by law — nothing sends without it).", "Queue is where emails start: create a batch from your Ready prospects (filter by city or category), start now or schedule a date, and pause, resume or cancel anytime. Emails go out every 15 minutes; follow-ups go 3 and 7 days later (change in Rules & Settings → Outreach) and stop automatically when someone joins, unsubscribes or you pause them. Owners also have Pause all outreach. Replies go to the outreach reply address — pause that prospect while you answer. You'll get a bell alert when your queue drops to 15 or fewer.", "The AI recruiter answers replies to the outreach reply address for you. It only uses the How Nearest works professional guide, live spots and prices for that prospect's city and category, your approved answers and your playbook — it never guesses. When someone's interested it sends their personal invite link. Anything it can't answer goes to Needs review (with a bell alert) after it sends your holding reply; answer it there and tick \"Save as an approved answer\" so it handles that question next time. \"Stop\" or \"unsubscribe\" replies are honored instantly.", "The AI answers normal questions on its own — what is this, how it works, cost, who it's for, how to sign up, is it in my area, is this legit, where did you find me — and only sends to Needs review when someone asks for a person, needs a decision or exception, or asks something it truly doesn't have. Every Needs review item says why it's there (for example \"AI key missing\" or \"the AI turned it over: asked about a refund\"). Use Answer with AI to have it reply once the reason is fixed, and Test the AI (on the AI recruiter page) to check it's connected without emailing anyone.", "AI recruiter (in Outreach) is where you edit its playbook, never-say rules, holding reply and approved answers, and see whether it's connected. Conversations shows every reply; on a prospect you can read the whole thread, reply yourself, or Take over so the AI stops answering them (Hand back to the AI anytime).", "Broadcasts (owners) send one email to a group: professionals (all, live, unfinished profiles, waiting for their city), prospects (active, emailed, no response, joined) or students, narrowed by city or category. You'll see the exact number of recipients and a preview before you tap Send; it goes out in batches every 15 minutes. Unsubscribed and do-not-contact emails are skipped, and a broadcast never changes anyone's recruiting status.", "Reports show the funnel — added, emailed, replied, links clicked, joined, profile complete — with rates, by recruiter, source, city and category, for today, this week, this month or all time. Use it to see which sources actually produce professionals."], link: { label: "Open", href: "/admin/outreach" } },
        { q: "Notifications (the bell)", a: ["The bell at the top right counts unread notifications: new professional registrations (with the recruiter), completed profiles, categories that are nearly full or full, and imports that need review. Opening Notifications marks them read; the history stays."], link: { label: "Open", href: "/admin/notifications" } },
        { q: "Money", a: ["Nearest's revenue (memberships) kept separate from professionals' money (card payments, released funds, and card-processing fees paid by pros)."], link: { label: "Open", href: "/admin/money" } },
        { q: "Sales Track", a: ["Partner progress, membership payments, what Nearest keeps, and the professionals each partner brought in. Partner links (?ref=CODE) are remembered for 30 days, so partners get credit even if the pro signs up later."], link: { label: "Open", href: "/admin/sales" } },
        { q: "Marketing", a: ["Where to push next: sign-ups by city, verified students, cities below target, and demand without supply (or supply without demand)."], link: { label: "Open", href: "/admin/marketing" } },
        { q: "Bundle Me", a: ["How students use Bundle my booking: bundles started, fully booked, in progress and expired; bundle bookings and what they paid; the most bundled categories; the students using it most; and every recent bundle."], link: { label: "Open", href: "/admin/bundles" } },
        { q: "Leaderboard", a: ["Top pros (overall score, bookings, highest rated, most reviewed, favorited, shared) and top students, for 30 days, 90 days or all time."], link: { label: "Open", href: "/admin/leaderboard" } },
        { q: "Profile examples", a: ["Sample pro and student profiles showing what a fully built-out account looks like. Sample data only — nobody real."], link: { label: "Open", href: "/admin/examples" } },
        { q: "Marketplace", a: ["Change the catalog without a developer: categories, suggested services, and whether a license is required."], link: { label: "Open", href: "/admin/marketplace" } },
      ],
    },
    {
      id: "owner", title: "Owner tools", icon: "gear", topics: [
        { q: "Launch readiness", a: ["Checks the live settings the site is running with — keys, email, Stripe, and test data. Use \"Clear test Stripe links\" after testing with test keys."], link: { label: "Open", href: "/admin/launch" } },
        { q: "Rules & Settings", a: ["Every number in the rules engine — booking notice, same-day cutoff, grace period, check-in distance, deposit, fines, suspensions, First In capacity and more — plus switches for registration and bookings. Changes are logged, and the guides update automatically."], link: { label: "Open", href: "/admin/settings" } },
        { q: "Team & Activity Log", a: ["Individual logins for owners and partners (never shared) and the permanent log of every admin action with before and after values."], link: { label: "Open", href: "/admin/team" } },
        { q: "My profile", a: ["Your name, your partner link code, and where your partner payouts go (through Stripe)."], link: { label: "Open", href: "/admin/profile" } },
        { q: "Browse & book as a customer", a: ["Owners can use Nearest like a student: Account → Switch workspace → Browse & book. Owners' own pro businesses are free — no entry fee or membership, just the ID check and payouts."], link: { label: "Switch workspace", href: "/workspace" } },
      ],
    },
  ];
}

export async function guideFor(audience: GuideAudience): Promise<GuideSection[]> {
  const r = rules(await getSettings());
  return audience === "student" ? student(r) : audience === "pro" ? pro(r) : admin(r);
}
