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
  phoneVerifiedAt: ts("phone_verified_at"),
  email: text("email"),
  emailVerifiedAt: ts("email_verified_at"),
  status: userStatus("status").notNull().default("active"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const counties = pgTable("counties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  market: text("market").notNull().default("DFW"),
});

export const cities = pgTable("cities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
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
  cityId: integer("city_id").notNull().references(() => cities.id),
  category: text("category").notNull(),
  cohort: cohort("cohort").notNull().default("FOUNDING"),
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
  cityId: integer("city_id").references(() => cities.id),
  zip: text("zip"),
  addressLine: text("address_line"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  serviceMode: serviceMode("service_mode"),
  travelRadiusMi: integer("travel_radius_mi"),
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
});

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
  featured: boolean("featured").notNull().default(false),
  sort: integer("sort").notNull().default(0),
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
  about: text("about"),
  status: modelCallStatus("status").notNull().default("open"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("model_calls_user_idx").on(t.userId), index("model_calls_starts_idx").on(t.startsAt)]);

export const adminMembers = pgTable("admin_members", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  role: adminRole("role").notNull(),
  partnerCode: text("partner_code"), // unique per partner; enforced in src/lib/partner.ts (no DB constraint so upgrades never prompt)
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
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
  serviceConfirmedAt: ts("service_confirmed_at"),
  photoUrl: text("photo_url"),
  photoForPortfolio: boolean("photo_for_portfolio"),
  noShowAt: ts("no_show_at"),
  // Phase 6: emails sent
  remind24At: ts("remind_24_at"),
  remind2At: ts("remind_2_at"),
  paidAt: ts("paid_at"),
  releasedAt: ts("released_at"),
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
