/**
 * The narrated Nearest walkthrough shown on the supporter invitation page (above the feedback form).
 * Recorded from the real app with demonstration accounts and sample data — no real students, bookings or payments.
 * Captions are burned into the video; the transcript below matches the narration word for word.
 * It only appears on the invitation page after an owner publishes it in Admin → Supporters.
 */
export const WALKTHROUGH_SETTING = "supporters.walkthrough_published";
export const WALKTHROUGH = {
  src: "/walkthrough/nearest-walkthrough.mp4",
  poster: "/walkthrough/poster.jpg",
  length: "3:29",
  width: 720,
  height: 1280,
};

export const WALKTHROUGH_TRANSCRIPT: { title: string; text: string }[] = [
  { title: "Nearest — an off-campus resource for students", text: "Nearest is an off-campus resource that helps students find beauty and wellness services near school, from ID-checked professionals, at student prices. Here's a look at the real app, using demonstration accounts." },
  { title: "Register & verify enrollment", text: "Students start by creating an account. Then they choose their school and verify enrollment with a school ID and a selfie. If their school doesn't issue student IDs, they can upload proof of enrollment instead. A Nearest team member reviews it, and students under eighteen also need a parent or guardian to approve." },
  { title: "Find nearby professionals", text: "Once verified, students see professionals near their school. They can filter by service, by after-school hours, or by price, so the options fit their schedule and budget." },
  { title: "After-school hours", text: "Professionals choose regular hours, after-school hours, or both, so students can book around class, practice, and work." },
  { title: "Services, student prices, portfolio & hours", text: "Each profile shows the professional's portfolio, then the services they offer, with the full student price up front and how long each one takes. Students can also check weekly and after-school hours. That makes it easy for students and parents to plan the cost and the time before anything is booked." },
  { title: "Save favorites", text: "Students tap the heart to save a professional to Favorites, so they can find them again and rebook in a couple of taps." },
  { title: "Model Calls — the look for less", text: "Model Calls are posted when professionals are practicing a new technique or building their portfolio, often at a lower price. Students get the look for less, and the professional gets the practice." },
  { title: "Prom, homecoming & school pictures on a budget", text: "Getting ready for prom, homecoming, school pictures, or another school event? With Bundle my booking, a student picks everything they need, enters one total budget, and chooses the week. Nearest recommends nearby professionals whose prices fit what's left of that budget, so the whole look stays affordable." },
  { title: "Booking a service (preview)", text: "Booking opens on November nineteenth, so this part is a preview. A student picks a service, a day, and an open time. Every booking starts as a request, and nothing is charged when it's sent. When the professional accepts, the student pays to confirm. No real booking or payment is made in this demonstration." },
  { title: "Protected payments (preview, demo appointment)", text: "Once a booking is paid, Nearest holds the payment. The professional isn't paid when the student books. The money stays protected until the service is finished." },
  { title: "Check-in when you arrive (preview, demo appointment)", text: "On appointment day, the address unlocks, and check-in opens an hour before the start time. When the student arrives, they take a check-in photo and tap Check in, and Nearest confirms they're at the appointment location." },
  { title: "In-app messages (preview, demo appointment)", text: "Every appointment has its own chat, so students can message their professional in the app without sharing phone numbers." },
  { title: "Finish & release payment (preview, demo appointment)", text: "When the service is done, the student confirms it was completed, adds a photo of the finished look, and leaves a rating and review. Then they release the payment, and only then is the professional paid." },
  { title: "Report a problem (preview, demo appointment)", text: "If something goes wrong, the student taps Report a problem right from the appointment. Nearest reviews it, and the payment stays protected while it does." },
  { title: "Connections — share who did it", text: "When a friend asks who did their lashes, students don't have to guess. They add classmates as Connections, then share that professional right from a past appointment, a profile, or their Favorites." },
  { title: "Invite friends — $5 off for both", text: "Every verified student also has a personal invite link. When a friend joins with it and gets verified, they both get five dollars off. It waits in their account until they book a professional they haven't booked before, and every new friend who joins earns another five dollars." },
  { title: "Free service — launch campaign", text: "And through Nearest's launch campaign, verified students in Dallas Fort Worth who join and complete the seven-day profile picture promotion can earn a free service from a participating professional." },
  { title: "Closing", text: "Nearest. ID-checked professionals, student prices, protected payments, and plans families can see ahead of time. Thank you for taking a look." },
];

export async function walkthroughPublished() {
  const { eq } = await import("drizzle-orm");
  const { db, platformSettings } = await import("@/db");
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, WALKTHROUGH_SETTING) });
  return row?.value === true;
}
