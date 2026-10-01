import {
  pgTable, pgEnum, uuid, text, date, timestamp, boolean, integer, jsonb, bigserial, primaryKey, index, uniqueIndex, doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const accountType = pgEnum("account_type", ["student", "professional", "staff"]);
export const userStatus = pgEnum("user_status", ["active", "paused", "suspended", "deactivated"]);
export const studentVerification = pgEnum("student_verification", ["unverified", "pending", "manual_review", "verified", "rejected"]);
export const identityStatus = pgEnum("identity_status", ["unverified", "pending", "verified", "rejected"]);
export const cohort = pgEnum("cohort", ["FOUNDING", "SECOND", "STANDARD"]);
export const inviteStatus = pgEnum("invite_status", ["invited", "registered", "expired", "declined", "revoked"]);
export const serviceMode = pgEnum("service_mode", ["come_to_me", "travel", "both"]);
export const aslLevel = pgEnum("asl_level", ["none", "basic", "conversational", "fluent"]);
export const reviewStatus = pgEnum("review_status", ["draft", "submitted", "approved", "rejected"]);
export const credentialStatus = pgEnum("credential_status", ["pending", "verified", "rejected"]);
export const hoursKind = pgEnum("hours_kind", ["regular", "after_school"]);
export const portfolioSource = pgEnum("portfolio_source", ["upload", "instagram", "tiktok", "nearest"]);
export const modelCallStatus = pgEnum("model_call_status", ["open", "full", "cancelled", "completed"]);
export const schoolType = pgEnum("school_type", ["high_school", "college", "trade"]);
export const schoolRequestStatus = pgEnum("school_request_status", ["pending", "added", "dismissed"]);
export const bookingStatus = pgEnum("booking_status", ["pending_payment", "confirmed", "completed", "cancelled_student", "cancelled_pro", "expired", "no_show"]);
export const incidentStatus = pgEnum("incident_status", ["open", "pro_fault", "not_substantiated"]);
export const fineStatus = pgEnum("fine_status", ["outstanding", "paid", "waived"]);
export const appealStatus = pgEnum("appeal_status", ["under_review", "upheld", "overturned"]);
export const payoutStatus = pgEnum("payout_status", ["approved", "paid"]);
export const adminRole = pgEnum("admin_role", ["OWNER", "ADMIN", "MARKETING_ADMIN", "OPERATIONS_ADMIN", "SUPPORT"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  accountType: accountType("account_type").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: date("date_of_birth"),
  phone: text("phone"),
  username: text("username"), // students: shown in Connections (e.g. mayaj27); unique via users_username_idx
  phoneVerifiedAt: ts("phone_verified_at"),
  email: text("email"),
  emailVerifiedAt: ts("email_verified_at"),
  status: userStatus("status").notNull().default("active"),
  repId: uuid("rep_id"), // sales rep whose link brought them (Sales Board) — never changes after sign-up
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_username_idx").on(t.username)]);

// County names repeat across states (Washington County…), so uniqueness is state + name — enforced in code
// (no DB constraint, so upgrades never prompt).
export const counties = pgTable("counties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  state: text("state").notNull().default("TX"),
  market: text("market").notNull().default("DFW"),
});

// City names repeat across states (Midland, TX / Midland, MI) — unique per state, enforced in code.
export const cities = pgTable("cities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  state: text("state").notNull().default("TX"),
  abbreviation: text("abbreviation").notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const cityCounties = pgTable("city_counties", {
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  countyId: integer("county_id").notNull().references(() => counties.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.cityId, t.countyId] })]);

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  verificationStatus: studentVerification("verification_status").notNull().default("unverified"),
  schoolId: integer("school_id"),
  graduationYear: integer("graduation_year"),
  prefersText: boolean("prefers_text").notNull().default(false),
  wantsAsl: boolean("wants_asl").notNull().default(false),
  // Sign-up steps 4–5 (optional)
  interests: text("interests").array(),
  showAccessibility: boolean("show_accessibility").notNull().default(false),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  noShowCount: integer("no_show_count").notNull().default(0),
  guardianEmail: text("guardian_email"),
  guardianConsentAt: ts("guardian_consent_at"), // required at sign-up for students 13–17
  bookingSuspendedUntil: ts("booking_suspended_until"),
  suspensionReason: text("suspension_reason"), // "no_shows" | "incomplete_completion" | "admin"
  // Phase 3A: manual verification
  idSubmittedAt: ts("id_submitted_at"),
  reviewNote: text("review_note"),
  verifiedAt: ts("verified_at"),
  reverifyBy: date("reverify_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const schools = pgTable("schools", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: schoolType("type").notNull(),
  cityId: integer("city_id").notNull().references(() => cities.id),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("schools_name_city").on(t.name, t.cityId)]);

export const schoolRequests = pgTable("school_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cityName: text("city_name").notNull(),
  type: schoolType("type").notNull(),
  status: schoolRequestStatus("status").notNull().default("pending"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// School ID + selfie for manual review. Private: only admins can open them (every view is logged),
// and both rows are deleted as soon as the student is approved or rejected.
export const studentIdDocs = pgTable("student_id_docs", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "school_id" | "selfie"
  mime: text("mime").notNull(),
  dataB64: text("data_b64").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.kind] })]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  cityId: integer("city_id").references(() => cities.id), // optional — invitations no longer ask for a city
  category: text("category").notNull(),
  cohort: cohort("cohort").notNull().default("FOUNDING"),
  // FIRST_IN (pays $11 at sign-up) | AMBASSADOR (free, main owner only) | BOOKING_PAID (membership collected from bookings, main owner only)
  kind: text("kind").notNull().default("FIRST_IN"),
  rateCents: integer("rate_cents"), // BOOKING_PAID monthly rate (starts at $15)
  status: inviteStatus("status").notNull().default("invited"),
  expiresAt: ts("expires_at").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  registeredUserId: uuid("registered_user_id").references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("invitations_status_idx").on(t.status)]);

export const professionalProfiles = pgTable("professional_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name"),
  cohort: cohort("cohort").notNull(),
  invitationId: uuid("invitation_id").references(() => invitations.id),
  identityStatus: identityStatus("identity_status").notNull().default("unverified"),
  searchable: boolean("searchable").notNull().default(false),
  slug: text("slug"), // public booking link: usenearest.com/pro-<slug>; unique via pro_slug_idx
  listingPausedAt: ts("listing_paused_at"), // set by Nearest admins (Pause listing); hides the pro from students
  membershipPausedAt: ts("membership_paused_at"), // billing paused (by Nearest); hidden from students while paused
  membershipEndsAt: ts("membership_ends_at"), // set when a membership is cancelled at the end of the paid period
  // Entry (what they paid to join). Locked to the account — changing Nearest's enrollment phase never changes it.
  entryType: text("entry_type"), // "FIRST_IN" | "PRO_STUDENT" | "GENERAL"
  monthlyRateCents: integer("monthly_rate_cents"), // 1100 | 1600 | 2100 for the first 12 months (earlier members may have 1000)
  entryPaidAt: ts("entry_paid_at"), // registration payment succeeded — counts toward First In's 750
  entryHoldUntil: ts("entry_hold_until"), // a First In spot held while they pay
  entryCheckoutId: text("entry_checkout_id"),
  // Phase 2: profile
  bio: text("bio"),
  yearsExperience: integer("years_experience"),
  photoUrl: text("photo_url"),
  instagram: text("instagram"),
  tiktok: text("tiktok"),
  website: text("website"),
  showInstagram: boolean("show_instagram").notNull().default(false),
  // Phase 2: location (street address is private; never sent to students before appointment day)
  countyId: integer("county_id").references(() => counties.id),
  // The city + main category this pro joined under (picked on Join, before paying). Counts toward the
  // per-city, per-category spots: First In for the first spots, next entry after that, then a waitlist.
  slotCityId: integer("slot_city_id"),
  slotCategoryId: integer("slot_category_id"),
  // Chose "skip the waitlist" for a full city + category: joins the next 750 and can go live there anyway.
  slotBypass: boolean("slot_bypass").notNull().default(false),
  cityId: integer("city_id").references(() => cities.id),
  zip: text("zip"),
  addressLine: text("address_line"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  serviceMode: serviceMode("service_mode"),
  travelRadiusMi: integer("travel_radius_mi"),
  addressUnit: text("address_unit"), // Apt / Suite / Unit (private, with the address)
  travelFeeCents: integer("travel_fee_cents"), // flat fee when they travel to the customer: $35–$55
  // Phase 2: communication
  languages: text("languages").array(),
  aslLevel: aslLevel("asl_level").notNull().default("none"),
  textCommunication: boolean("text_communication").notNull().default(false),
  // Phase 2: availability
  acceptsAfterSchool: boolean("accepts_after_school").notNull().default(false),
  vacationMode: boolean("vacation_mode").notNull().default(false),
  // Phase 3B: Stripe
  stripeAccountId: text("stripe_account_id"),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionId: text("subscription_id"),
  subscriptionStatus: text("subscription_status"), // trialing | active | past_due | canceled | ...
  trialEndsAt: ts("trial_ends_at"),
  currentPeriodEnd: ts("current_period_end"),
  identitySessionId: text("identity_session_id"),
  introEndsAt: ts("intro_ends_at"), // after this, Founding/early pricing steps up to standard
  priceSteppedAt: ts("price_stepped_at"),
  // Phase 5: enforcement + partner attribution
  suspendedUntil: ts("suspended_until"),
  suspensionReason: text("suspension_reason"),
  referredBy: uuid("referred_by"), // partner (admin user) who brought this pro in
  // Phase 2: review
  reviewStatus: reviewStatus("review_status").notNull().default("draft"),
  reviewNote: text("review_note"),
  submittedAt: ts("submitted_at"),
  approvedAt: ts("approved_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("pro_slug_idx").on(t.slug)]);

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  licenseRequired: boolean("license_required").notNull().default(false),
  licenseLabel: text("license_label"),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const catalogServices = pgTable("catalog_services", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
}, (t) => [uniqueIndex("catalog_services_cat_name").on(t.categoryId, t.name)]);

export const proServices = pgTable("pro_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  durationMin: integer("duration_min").notNull(),
  adultsOnly: boolean("adults_only").notNull().default(false), // "18+ only" — students under 18 can't book it
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("pro_services_user_idx").on(t.userId)]);

export const proHours = pgTable("pro_hours", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: hoursKind("kind").notNull(),
  weekday: integer("weekday").notNull(), // 0 = Sunday … 6 = Saturday
  startTime: text("start_time").notNull(), // "HH:MM" America/Chicago
  endTime: text("end_time").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.kind, t.weekday] })]);

export const proBlocks = pgTable("pro_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  reason: text("reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("pro_blocks_user_idx").on(t.userId)]);

// "Available Today" openings. One row per open start time on a given Chicago date.
export const proOpenings = pgTable("pro_openings", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  startTime: text("start_time").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.day, t.startTime] })]);

export const portfolioItems = pgTable("portfolio_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  source: portfolioSource("source").notNull().default("upload"),
  kind: text("kind").notNull().default("image"), // "image" | "video" (videos are 15 seconds max)
  durationSec: doublePrecision("duration_sec"), // videos only, read from the file itself
  featured: boolean("featured").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  // The service this photo shows — powers "Book this look" on the profile. Optional.
  serviceId: uuid("service_id").references(() => proServices.id, { onDelete: "set null" }),
  // Set when the pro chose to move a client's photo into their portfolio (client photos are never added automatically).
  fromBookingId: uuid("from_booking_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("portfolio_user_idx").on(t.userId)]);

export const proCredentials = pgTable("pro_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  licenseType: text("license_type").notNull(),
  licenseNumber: text("license_number").notNull(),
  issuingState: text("issuing_state").notNull().default("Texas"),
  expiresOn: date("expires_on"),
  status: credentialStatus("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("pro_credentials_user_cat").on(t.userId, t.categoryId)]);

export const modelCalls = pgTable("model_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id),
  serviceName: text("service_name").notNull(),
  startsAt: ts("starts_at").notNull(),
  durationMin: integer("duration_min").notNull(),
  priceCents: integer("price_cents").notNull(),
  spots: integer("spots").notNull().default(1),
  spotsTaken: integer("spots_taken").notNull().default(0),
  requirements: text("requirements").array(),
  about: text("about"), // "Additional information"
  flexible: boolean("flexible").notNull().default(false), // open time: each model picks a time from the pro's availability; startsAt = open-until
  photoUrl: text("photo_url"), // the look they're practicing
  status: modelCallStatus("status").notNull().default("open"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("model_calls_user_idx").on(t.userId), index("model_calls_starts_idx").on(t.startsAt)]);

export const adminMembers = pgTable("admin_members", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  role: adminRole("role").notNull(),
  partnerCode: text("partner_code"), // unique per partner; enforced in src/lib/partner.ts (no DB constraint so upgrades never prompt)
  // Where this partner wants Sales Track payouts sent (entered by the partner in My profile).
  payoutMethod: text("payout_method"), // "Zelle" | "Cash App" | "PayPal" | "Venmo" | "Bank transfer" | "Check" | "Other"
  payoutHandle: text("payout_handle"),
  payoutNote: text("payout_note"),
  // Stripe Connect payout account (bank account or debit card, entered in Stripe's secure form — never stored here)
  stripeAccountId: text("stripe_account_id"),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
  payoutDestination: text("payout_destination"), // display only, e.g. "Chase ••••4417" or "Visa debit ••••1234"
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// Insert-only. Never update or delete rows in this table.
export const activityLog = pgTable("activity_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("activity_log_created_idx").on(t.createdAt)]);

export const usersRelations = relations(users, ({ one }) => ({
  student: one(studentProfiles, { fields: [users.id], references: [studentProfiles.userId] }),
  professional: one(professionalProfiles, { fields: [users.id], references: [professionalProfiles.userId] }),
  admin: one(adminMembers, { fields: [users.id], references: [adminMembers.userId] }),
}));
export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
  user: one(users, { fields: [studentProfiles.userId], references: [users.id] }),
}));
export const professionalProfilesRelations = relations(professionalProfiles, ({ one }) => ({
  user: one(users, { fields: [professionalProfiles.userId], references: [users.id] }),
}));
export const adminMembersRelations = relations(adminMembers, ({ one }) => ({
  user: one(users, { fields: [adminMembers.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: bigserial("number", { mode: "number" }).notNull(), // shown as NEA-10001…
  studentId: uuid("student_id").notNull().references(() => users.id),
  proId: uuid("pro_id").notNull().references(() => users.id),
  serviceId: uuid("service_id"),
  modelCallId: uuid("model_call_id").references(() => modelCalls.id),
  serviceName: text("service_name").notNull(),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  priceCents: integer("price_cents").notNull(),
  travelFeeCents: integer("travel_fee_cents").notNull().default(0), // included in priceCents when the pro travels
  depositCents: integer("deposit_cents").notNull(),
  creditProCents: integer("credit_pro_cents").notNull().default(0),
  creditGeneralCents: integer("credit_general_cents").notNull().default(0),
  chargedCents: integer("charged_cents").notNull().default(0),
  status: bookingStatus("status").notNull().default("pending_payment"),
  holdExpiresAt: ts("hold_expires_at"),
  stripeCheckoutId: text("stripe_checkout_id"),
  stripeChargeId: text("stripe_charge_id"),
  stripeFeeCents: integer("stripe_fee_cents"),
  transferId: text("transfer_id"),
  // Phase 4: where it happens (snapshot at booking) and appointment-day events
  locationType: text("location_type").notNull().default("pro"), // "pro" | "student"
  locationAddress: text("location_address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  checkedInAt: ts("checked_in_at"),
  checkinDistanceFt: integer("checkin_distance_ft"),
  checkinAccuracyFt: integer("checkin_accuracy_ft"),
  checkinPhotoUrl: text("checkin_photo_url"), // required photo at check-in (before the service)
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
  serviceConfirmedAt: ts("service_confirmed_at"),
  photoUrl: text("photo_url"),
  photoForPortfolio: boolean("photo_for_portfolio"), // the client allowed the pro to share it (with the review or in the portfolio)
  // The pro's choice for this client photo. null = private (only the pro sees it); "shown" = with the review; "removed".
  photoStatus: text("photo_status"),
  noShowAt: ts("no_show_at"),
  // Phase 6: emails sent
  remind24At: ts("remind_24_at"),
  remind2At: ts("remind_2_at"),
  paidAt: ts("paid_at"),
  releasedAt: ts("released_at"),
  // Money owed to a pro who hadn't connected payouts yet — sent automatically once they do (payOwedToPro).
  payoutOwedCents: integer("payout_owed_cents").notNull().default(0),
  cancelledAt: ts("cancelled_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("bookings_pro_starts_idx").on(t.proId, t.startsAt), index("bookings_student_idx").on(t.studentId)]);

// Credit ledger. Balance = sum(amount). pro_id null = general Nearest credit usable with any professional.
export const credits = pgTable("credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => users.id),
  proId: uuid("pro_id").references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("credits_student_idx").on(t.studentId)]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("messages_booking_idx").on(t.bookingId, t.createdAt)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id),
  studentId: uuid("student_id").notNull().references(() => users.id),
  proId: uuid("pro_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  body: text("body"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("reviews_pro_idx").on(t.proId)]);

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  details: text("details"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracyFt: integer("accuracy_ft"),
  distanceFt: integer("distance_ft"),
  status: incidentStatus("status").notNull().default("open"),
  decisionNote: text("decision_note"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: ts("decided_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("incidents_status_idx").on(t.status)]);

export const fines = pgTable("fines", {
  id: uuid("id").primaryKey().defaultRandom(),
  proId: uuid("pro_id").notNull().references(() => users.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  incidentId: uuid("incident_id").references(() => incidents.id),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason").notNull(),
  status: fineStatus("status").notNull().default("outstanding"),
  dueAt: ts("due_at").notNull(),
  paidAt: ts("paid_at"),
  stripeCheckoutId: text("stripe_checkout_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("fines_pro_idx").on(t.proId)]);

export const appeals = pgTable("appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // "student_suspension" | "pro_fine" | "pro_suspension"
  targetId: text("target_id"),
  explanation: text("explanation").notNull(),
  status: appealStatus("status").notNull().default("under_review"),
  decisionNote: text("decision_note"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: ts("decided_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("appeals_status_idx").on(t.status)]);

// Membership payments pros actually made (from Stripe invoices). Drives MRR and partner earnings.
export const membershipPayments = pgTable("membership_payments", {
  stripeInvoiceId: text("stripe_invoice_id").primaryKey(),
  proId: uuid("pro_id").notNull().references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  paidAt: ts("paid_at").notNull(),
}, (t) => [index("membership_payments_paid_idx").on(t.paidAt)]);

export const partnerPayouts = pgTable("partner_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => users.id),
  month: text("month").notNull(), // "YYYY-MM"
  amountCents: integer("amount_cents").notNull(),
  status: payoutStatus("status").notNull().default("approved"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: ts("approved_at").notNull().defaultNow(),
  paidAt: ts("paid_at"),
  note: text("note"),
  transferId: text("transfer_id"),
}, (t) => [uniqueIndex("partner_payouts_partner_month").on(t.partnerId, t.month)]);

// What students searched for — powers Marketing's "searched but didn't find".
export const searchLog = pgTable("search_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  studentId: uuid("student_id").references(() => users.id, { onDelete: "set null" }),
  query: text("query"),
  filters: text("filters"),
  cityId: integer("city_id"),
  results: integer("results").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("search_log_created_idx").on(t.createdAt)]);

export const favorites = pgTable("favorites", {
  studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  proId: uuid("pro_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.studentId, t.proId] })]);

// In-app notifications inbox (the bell). Emails mirror the important ones.
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  refId: text("ref_id"),
  readAt: ts("read_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]);

// Atomic counters (First In seats held + paid). One row per counter.
export const entryCounters = pgTable("entry_counters", {
  key: text("key").primaryKey(),
  taken: integer("taken").notNull().default(0),
});

// $16 Professional + Student entry: the student the professional registered with their entry.
export const proStudentLinks = pgTable("pro_student_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  proId: uuid("pro_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  school: text("school"),
  status: text("status").notNull().default("pending"), // pending (not paid) | invited (paid, student emailed) | joined
  studentUserId: uuid("student_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("pro_student_links_pro_idx").on(t.proId), index("pro_student_links_email_idx").on(t.email)]);

// Automatic problem reports (error + screenshot), emailed to support@usenearest.com and kept here.
export const problemReports = pgTable("problem_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  ref: text("ref").notNull(), // short reference shown to the person, e.g. NR-7K2Q
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  accountType: text("account_type"), // student | professional | staff | signed out
  url: text("url").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  digest: text("digest"), // server error id (matches Vercel logs)
  userAgent: text("user_agent"),
  viewport: text("viewport"),
  note: text("note"),
  screenshotB64: text("screenshot_b64"),
  emailed: boolean("emailed").notNull().default(false),
  status: text("status").notNull().default("new"), // new | resolved
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("problem_reports_created_idx").on(t.createdAt)]);

// Connections between students (Connect → accepted). Only accepted connections can share professionals.
export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: uuid("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | accepted
  createdAt: ts("created_at").notNull().defaultNow(),
  respondedAt: ts("responded_at"),
}, (t) => [uniqueIndex("connections_pair_idx").on(t.requesterId, t.addresseeId), index("connections_addressee_idx").on(t.addresseeId)]);

// A professional sent from one student to a connection ("Share with a Connection").
export const proShares = pgTable("pro_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromId: uuid("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  proId: uuid("pro_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("pro_shares_to_idx").on(t.toId)]);

// Pay-from-bookings memberships: what Nearest kept from each released booking toward that month's rate.
// One row per booking (never collected twice); month is Chicago time, "YYYY-MM".
export const membershipDues = pgTable("membership_dues", {
  id: uuid("id").primaryKey().defaultRandom(),
  proId: uuid("pro_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("membership_dues_pro_month_idx").on(t.proId, t.month), uniqueIndex("membership_dues_booking_idx").on(t.bookingId)]);

// Sales Board (main owner only): sales reps who bring people to Nearest with their own link.
// Kept separate from partners (admin_members) and from pro invitations.
export const salesReps = pgTable("sales_reps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(), // lowercase — the rep's login must use this exact email
  code: text("code").notNull(), // their link code: usenearest.com/pro?rep=CODE
  token: text("token").notNull(), // invitation link token
  status: text("status").notNull().default("invited"), // invited | active | removed
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  inviteExpiresAt: ts("invite_expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  // Sales Ambassador Agreement — signed (checkbox + typed full name) before the account can be created.
  agreementVersion: text("agreement_version"),
  agreedAt: ts("agreed_at"),
  agreedName: text("agreed_name"),
  agreedIp: text("agreed_ip"),
  agreedUserAgent: text("agreed_user_agent"),
  // Identity check after the account is created: ID photo + live selfie, approved by the main owner.
  // not_started | pending | approved | rejected. Links only give credit, and payouts only open, once approved.
  verificationStatus: text("verification_status").notNull().default("not_started"),
  verifiedAt: ts("verified_at"),
  verificationNote: text("verification_note"), // reason shown to the rep if rejected
  // Payouts (Stripe connected account — bank or debit card). Nearest stores only a label like "Chase ••••4417".
  stripeAccountId: text("stripe_account_id"),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  payoutDestination: text("payout_destination"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("sales_reps_code_idx").on(t.code), uniqueIndex("sales_reps_token_idx").on(t.token), index("sales_reps_email_idx").on(t.email)]);

// Payments the main owner sent to sales reps through Stripe.
export const repPayouts = pgTable("rep_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  repId: uuid("rep_id").notNull().references(() => salesReps.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  note: text("note"),
  stripeTransferId: text("stripe_transfer_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("rep_payouts_rep_idx").on(t.repId)]);

// Professionals waiting for a spot when their city + category is full.
export const proWaitlist = pgTable("pro_waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cityId: integer("city_id").notNull(),
  categoryId: integer("category_id").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("pro_waitlist_unique_idx").on(t.userId, t.cityId, t.categoryId), index("pro_waitlist_slot_idx").on(t.cityId, t.categoryId)]);
