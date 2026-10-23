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
// "requested" = every booking starts here; nothing is charged. The pro accepts → "pending_payment" (student pays to confirm) → "confirmed"
// until the pro accepts (activating their membership first), declines, or the request expires.
export const bookingStatus = pgEnum("booking_status", ["pending_payment", "confirmed", "completed", "cancelled_student", "cancelled_pro", "expired", "no_show", "requested"]);
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
  inviteCode: text("invite_code"), // students: their "Invite friends" link code (usenearest.com/?friend=CODE)
  invitedBy: uuid("invited_by"), // students: the student whose invite link they signed up through
  smsOptInAt: ts("sms_opt_in_at"), // agreed at sign-up to receive text updates (texting isn't on yet — saved for later)
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_username_idx").on(t.username), uniqueIndex("users_invite_code_idx").on(t.inviteCode)]);

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
  // When the owner opened booking in this city. Until then pros can join (card saved, no charge) and build
  // their profiles; their membership starts the day the city opens.
  bookingOpenAt: timestamp("booking_open_at", { withTimezone: true }),
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
  guardianConsentAt: ts("guardian_consent_at"), // required at sign-up for students 13–17 (the student's checkbox)
  // The parent or guardian's own approval, by email link. Students 13–17 can't book until it's "approved".
  guardianStatus: text("guardian_status"), // null | "pending" | "approved" | "declined"
  guardianToken: text("guardian_token"),
  guardianEmailSentAt: ts("guardian_email_sent_at"),
  guardianApprovedAt: ts("guardian_approved_at"),
  guardianName: text("guardian_name"), // the name the parent typed to sign
  guardianIp: text("guardian_ip"),
  // "I don't have my school ID with me": selfie now, then finish with the school ID or a school email code.
  selfieOnlyAt: ts("selfie_only_at"),
  verifyLaterAt: ts("verify_later_at"), // chose "finish verifying later"
  verifyReminders: integer("verify_reminders").notNull().default(0), // reminders sent to come back and finish (max 3)
  verifyRemindedAt: ts("verify_reminded_at"),
  schoolEmail: text("school_email"),
  schoolEmailVerifiedAt: ts("school_email_verified_at"), // code confirmed → temporary access until the owner approves
  schoolEmailCodeHash: text("school_email_code_hash"),
  schoolEmailCodeExpires: ts("school_email_code_expires"),
  schoolEmailCodeTries: integer("school_email_code_tries").notNull().default(0),
  bookingSuspendedUntil: ts("booking_suspended_until"),
  suspensionReason: text("suspension_reason"), // "no_shows" | "incomplete_completion" | "admin"
  // Phase 3A: manual verification
  idSubmittedAt: ts("id_submitted_at"),
  reviewNote: text("review_note"),
  // "My school does not issue student IDs": proof of current enrollment instead of a school ID.
  proofType: text("proof_type"), // null/"school_id" | "enrollment"
  enrollmentDocKind: text("enrollment_doc_kind"), // enrollment_confirmation | class_schedule | student_portal | tuition_receipt
  clearerProofRequestedAt: ts("clearer_proof_requested_at"), // admin asked for a clearer document (selfie kept)
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
  kind: text("kind").notNull(), // "school_id" | "selfie" | "enrollment_proof" (image or PDF) | "gov_id" | …
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
  facebook: text("facebook"), // username, or "id:<number>" for profile.php?id= links
  pinterest: text("pinterest"), // username
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
  // Joined before their city opened: card saved, no charge yet. Membership starts when the city opens.
  cardSavedAt: ts("card_saved_at"),
  identityNote: text("identity_note"), // why the ID check was sent back (shown on their Subscription screen)
  // Professional Terms (incl. the membership disclosure) — proof of exactly which version they accepted.
  // Who students are booking: the professional's own name + photo (photoUrl), separate from the business name + logo.
  displayName: text("display_name"), // e.g. "Jasmine C." — falls back to first name + last initial
  // Self-reported professional status, asked ONCE for the whole account (internal analytics — never verified or shown):
  // licensed | license_pending | currently_enrolled | self_taught
  professionalStatus: text("professional_status"),
  logoUrl: text("logo_url"),
  proTermsVersion: text("pro_terms_version"),
  proTermsAcceptedAt: ts("pro_terms_accepted_at"),
  proTermsIp: text("pro_terms_ip"),
  // Launch campaign free service: "agreed" (new pros tick it at submit; earlier pros opt in from their home card) or "declined".
  campaignChoice: text("campaign_choice"),
  campaignChoiceAt: ts("campaign_choice_at"),
  // Professional Protection (self-reported only — no insurer, policy number, dates or documents are ever collected):
  // has | interested | not_now, and when interested: per_booking | annual | more_info. Null = not answered yet.
  insuranceChoice: text("insurance_choice"),
  insuranceInterest: text("insurance_interest"),
  insuranceChoiceAt: ts("insurance_choice_at"),
  // Membership activates when they accept their first booking request (not at sign-up).
  membershipActivatedAt: ts("membership_activated_at"),
  firstRequestAt: ts("first_request_at"),
  // Spot given up (profile not submitted when the city opened, or card failed for 7 days). Not counted, not shown.
  placementReleasedAt: ts("placement_released_at"),
  // 30-day spot rule (no membership): the clock starts at joining (or at reclaiming a released spot); a warning goes
  // out a week before a not-live profile's spot is released.
  spotClockAt: ts("spot_clock_at"),
  spotWarnedAt: ts("spot_warned_at"),
  // Built by Nearest: an owner/partner set this profile up for the professional (with their permission). Until they
  // claim it (set a password from the emailed link) the account has no sign-in of its own. claimTokenHash = sha256
  // of the one-time link; cleared once used.
  builtBy: uuid("built_by"),
  builtAt: ts("built_at"),
  claimTokenHash: text("claim_token_hash"),
  claimSentAt: ts("claim_sent_at"),
  claimExpiresAt: ts("claim_expires_at"),
  claimedAt: ts("claimed_at"),
  // Setup "save & finish later": half-finished services are kept as a draft; reminders after 1/3/7 days.
  servicesDraft: jsonb("services_draft"),
  setupReminders: integer("setup_reminders").notNull().default(0),
  setupRemindedAt: ts("setup_reminded_at"),
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
  photoUrl: text("photo_url"), // optional photo of this service (their own work)
  // Nearest service fee. priceCents = what students see and pay. proPriceCents = what the pro entered (null = saved
  // before the fee existed: no fee on those until the pro edits them). feeAdded = fee added on top (else the pro absorbs it).
  proPriceCents: integer("pro_price_cents"),
  serviceFeeCents: integer("service_fee_cents").notNull().default(0),
  feeAdded: boolean("fee_added").notNull().default(true),
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  durationMin: integer("duration_min").notNull(),
  adultsOnly: boolean("adults_only").notNull().default(false), // "18+ only" — students under 18 can't book it
  // Optional extras on this service (e.g. "Rhinestones +$10, +15 min"): [{ id, name, priceCents, extraMin }]. The student
  // picks any when booking; the $150 student cap applies to the service + chosen add-ons together. No service fee on add-ons.
  addons: jsonb("addons").$type<{ id: string; name: string; priceCents: number; extraMin: number }[]>().notNull().default([]),
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
  licenseNumber: text("license_number").notNull(), // for "diploma": the diploma / certificate number (may be empty if a photo was sent)
  issuingState: text("issuing_state").notNull().default("Texas"),
  // "license" = state license. "diploma" = recent graduate, license pending (school + completion date + diploma photo or number).
  kind: text("kind").notNull().default("license"),
  schoolName: text("school_name"),
  completedOn: date("completed_on"),
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
  priceCents: integer("price_cents").notNull(), // what students pay (the pro's price + Nearest's service fee)
  proPriceCents: integer("pro_price_cents"), // what the pro entered (null = published before Model Calls had the fee)
  serviceFeeCents: integer("service_fee_cents").notNull().default(0), // kept by Nearest when the booking completes
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
  // Add-ons the student chose (snapshot at booking): included in priceCents, and their time is included in endsAt.
  addons: jsonb("addons").$type<{ id: string; name: string; priceCents: number; extraMin: number }[]>(),
  addonsCents: integer("addons_cents").notNull().default(0),
  depositCents: integer("deposit_cents").notNull(),
  creditProCents: integer("credit_pro_cents").notNull().default(0),
  creditGeneralCents: integer("credit_general_cents").notNull().default(0),
  // Student invite reward used on this booking: $5 off, funded by the professional (first booking with them only).
  inviteDiscountCents: integer("invite_discount_cents").notNull().default(0),
  serviceFeeCents: integer("service_fee_cents").notNull().default(0), // Nearest's service fee in this price — kept when the booking completes
  // Launch campaign reward booking: the student pays $0; Nearest pays the pro campaign_payout_cents when it completes.
  campaignEntryId: uuid("campaign_entry_id"),
  campaignOfferId: uuid("campaign_offer_id"),
  campaignPayoutCents: integer("campaign_payout_cents").notNull().default(0),
  campaignSlotReleased: boolean("campaign_slot_released").notNull().default(false),
  inviteRewardId: uuid("invite_reward_id"),
  bundleId: uuid("bundle_id"), // booked through Bundle Me (no credits or invite rewards)
  // Booking request (pro without an active membership): card authorized at checkout, captured only on acceptance.
  isRequest: boolean("is_request").notNull().default(false),
  requestExpiresAt: ts("request_expires_at"),
  paymentIntentId: text("payment_intent_id"),
  respondedAt: ts("responded_at"),
  requestRemindedAt: ts("request_reminded_at"), // "still waiting" reminder sent to the pro (once per request)
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

// Public city checker (/locations): people who asked to hear when Nearest opens (or opens for professionals) in their
// city. Opt-in only (consent text stored). Never used for automatic marketing; owners follow up by hand.
export const locationInterest = pgTable("location_interest", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: text("role").notNull(), // professional | student | parent
  name: text("name"),
  email: text("email").notNull(),
  emailNorm: text("email_norm").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip"),
  cityId: integer("city_id"), // when the city is already in Nearest
  categoryId: integer("category_id"), // professionals: their main service
  status: text("status").notNull(), // what the checker showed: live | enrolling | closed | not_open
  consent: text("consent").notNull(),
  source: text("source"), // landing page / ?ref code, when known
  contactedAt: ts("contacted_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("location_interest_unique_idx").on(t.emailNorm, t.role, t.city, t.state), index("location_interest_place_idx").on(t.state, t.city)]);

// Enrollment capacity: each city + category opens with 5 spots (growth.target_per_category). When they're taken,
// enrollment closes there. An owner may authorize ONE more opening of 5 for that city + category (row here) —
// never automatic, and never more than 10 in total.
export const slotOpenings = pgTable("slot_openings", {
  id: uuid("id").primaryKey().defaultRandom(),
  cityId: integer("city_id").notNull(),
  categoryId: integer("category_id").notNull(),
  authorizedBy: uuid("authorized_by").references(() => users.id, { onDelete: "set null" }),
  authorizedAt: ts("authorized_at").notNull().defaultNow(),
  note: text("note"),
}, (t) => [uniqueIndex("slot_openings_city_category_idx").on(t.cityId, t.categoryId)]);

// Phone alerts (web push): one row per phone/browser that turned alerts on. Removed when the browser says it's gone.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSentAt: ts("last_sent_at"),
}, (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint), index("push_subscriptions_user_idx").on(t.userId)]);

// Keys Nearest makes for itself (the phone-alert signing key). Never shown in Admin; never sent to a browser except
// the public half.
export const appKeys = pgTable("app_keys", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

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

// "Invite a friend": when an invited student is verified, the inviter and the new student each get a $5 reward.
// One reward per booking (no stacking), on a student's first booking with a professional; the pro funds the $5.
// available → reserved (booking awaiting payment) → used; cancelled / expired bookings put it back to available.
export const inviteRewards = pgTable("invite_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // who can use it
  fromUserId: uuid("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // the other student in the pair
  reason: text("reason").notNull(), // "inviter" | "invitee"
  amountCents: integer("amount_cents").notNull().default(500),
  status: text("status").notNull().default("available"),
  bookingId: uuid("booking_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("invite_rewards_pair_idx").on(t.userId, t.fromUserId, t.reason), index("invite_rewards_user_idx").on(t.userId, t.status)]);

// Bundle Me: a student picks several categories, a total budget and a week; Nearest suggests professionals with
// openings that week whose prices fit the budget. She saves one per category, then books each one inside that week.
// building → ready (every category saved) → booked (every saved pro booked). Unbooked bundles expire after 14 days:
// their saved pros are cleared, but the bundle row stays (status "expired") so Nearest can count usage.
export const bundles = pgTable("bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryIds: jsonb("category_ids").$type<number[]>().notNull(),
  budgetCents: integer("budget_cents").notNull(),
  startDate: text("start_date").notNull(), // "YYYY-MM-DD" (Chicago) — the week she needs it done
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("building"),
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  completedAt: ts("completed_at"),
}, (t) => [index("bundles_student_idx").on(t.studentId), index("bundles_status_idx").on(t.status)]);

export const bundleItems = pgTable("bundle_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id").notNull().references(() => bundles.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull(),
  proId: uuid("pro_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => proServices.id, { onDelete: "cascade" }),
  priceCents: integer("price_cents").notNull(),
  bookingId: uuid("booking_id"),
  savedAt: ts("saved_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("bundle_items_cat_idx").on(t.bundleId, t.categoryId)]);

// A paying professional moving to a city where their category is full asks for a transfer; an owner approves it.
// payload = the new location exactly as they entered it (applied as-is on approval).
export const proTransfers = pgTable("pro_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fromCityId: integer("from_city_id"),
  toCityId: integer("to_city_id").notNull(),
  payload: jsonb("payload").notNull(),
  note: text("note"),
  status: text("status").notNull().default("pending"), // pending | approved | denied | cancelled
  decisionNote: text("decision_note"),
  decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: ts("decided_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("pro_transfers_status_idx").on(t.status), index("pro_transfers_user_idx").on(t.userId)]);

// ---------- Professional Outreach (Admin) ----------
// One professional = one outreach record across Nearest (matched by normalized email / phone).
// recruiterId = the owner/partner who works this prospect; their partner code goes on every signup link.
export const prospects = pgTable("prospects", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: uuid("recruiter_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  business: text("business"),
  city: text("city"),
  state: text("state"),
  cityId: integer("city_id"),
  category: text("category"),
  categoryId: integer("category_id"),
  email: text("email"),
  emailNorm: text("email_norm"),
  phone: text("phone"),
  phoneNorm: text("phone_norm"),
  source: text("source"),
  notes: text("notes"),
  // new | approved | scheduled | contacted | conversation | interested | link_sent | link_clicked | registered | profile_complete
  // | declined | no_response | opted_out | needs_review | ineligible
  status: text("status").notNull().default("approved"),
  importId: uuid("import_id"),
  registeredUserId: uuid("registered_user_id"),
  // Email outreach: which batch, how many emails sent (1 = first email, 2–3 = follow-ups), when the next one is due.
  batchId: uuid("batch_id"),
  emailsSent: integer("emails_sent").notNull().default(0),
  nextEmailAt: ts("next_email_at"),
  paused: boolean("paused").notNull().default(false),
  linkSentAt: ts("link_sent_at"),
  linkClickedAt: ts("link_clicked_at"),
  // AI recruiter: "ai" answers replies; "human" = a partner took over. reviewQuestion = what the AI couldn't answer.
  aiMode: text("ai_mode").notNull().default("ai"),
  reviewQuestion: text("review_question"),
  lastMessageAt: ts("last_message_at"),
  lastContactAt: ts("last_contact_at"),
  county: text("county"),
  socialUrl: text("social_url"), // social profile or business website
  socialNorm: text("social_norm"),
  // Lead Contributor entries (internal only). recruiterId stays the referral owner (Avy → AVY code); enteredBy is
  // who typed it in or whose invitation link it came through — never referral ownership, partner credit or pay.
  enteredBy: uuid("entered_by").references(() => users.id, { onDelete: "set null" }),
  entryMethod: text("entry_method"), // manual | invitation (contributor entries only)
  leadInviteId: uuid("lead_invite_id"),
  duplicateOf: uuid("duplicate_of"), // status "duplicate": the earlier record this one matched (its contact fields aren't normalized, so it never matches anything)
  conflictNote: text("conflict_note"), // another recruiter's attribution was found — flagged for review, never overwritten
  conflictAt: ts("conflict_at"),
  conflictReviewedAt: ts("conflict_reviewed_at"),
  conflictReviewedBy: uuid("conflict_reviewed_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("prospects_recruiter_idx").on(t.recruiterId, t.status), index("prospects_email_idx").on(t.emailNorm), index("prospects_phone_idx").on(t.phoneNorm), index("prospects_city_idx").on(t.cityId, t.categoryId), index("prospects_social_idx").on(t.socialNorm), index("prospects_entered_by_idx").on(t.enteredBy)]);

// Screenshot leads: an owner uploads screenshots of a professional's profile / business page; AI reads them into a draft
// the owner checks and fixes, then approves into a real prospect. Nothing here is contacted or counted until approved.
export const prospectDrafts = pgTable("prospect_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: uuid("recruiter_id").references(() => users.id, { onDelete: "set null" }), // whose prospect it becomes (the uploader)
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("review"), // review | approved | discarded
  images: jsonb("images").notNull(), // [{ url, access, mime }] — private storage, served only through the admin route
  fields: jsonb("fields").notNull(), // the editable lead details (see src/lib/screenshot-leads.ts DraftFields)
  aiNote: text("ai_note"), // what the reader wasn't sure about, or why it couldn't read the screenshots
  prospectId: uuid("prospect_id"),
  decidedBy: uuid("decided_by"),
  decidedAt: ts("decided_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("prospect_drafts_status_idx").on(t.status, t.createdAt), index("prospect_drafts_recruiter_idx").on(t.recruiterId)]);

// Lead Contributors: hired people who may ONLY add professional prospects (manually or through their invitation links).
// They are not admins and get no referral ownership, partner credit or compensation — every lead they add is
// attributed to recruiterId (Avy's existing recruiter account / AVY code), set on the server.
export const leadContributors = pgTable("lead_contributors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(), // lowercase — their login must use this exact email
  token: text("token").notNull(), // invitation to create their login
  status: text("status").notNull().default("invited"), // invited | active | removed
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  recruiterId: uuid("recruiter_id").notNull().references(() => users.id), // whose referral attribution their leads carry
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  inviteExpiresAt: ts("invite_expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  removedAt: ts("removed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("lead_contributors_user_idx").on(t.userId), index("lead_contributors_token_idx").on(t.token)]);

// A contributor's invitation link: opens a Nearest-hosted professional interest form. One submission per link.
export const leadInvites = pgTable("lead_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(),
  contributorId: uuid("contributor_id").notNull().references(() => leadContributors.id, { onDelete: "cascade" }),
  label: text("label"), // contributor's own reminder ("Jas — nail tech at the mall"); private
  source: text("source"), // where the contributor found them
  status: text("status").notNull().default("active"), // active | submitted | revoked
  expiresAt: ts("expires_at").notNull(),
  submittedAt: ts("submitted_at"),
  prospectId: uuid("prospect_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("lead_invites_token_idx").on(t.token), index("lead_invites_contributor_idx").on(t.contributorId, t.createdAt)]);

// Everything that happens to a prospect: added, imported, emailed, replied, link clicked, registered, notes…
export const prospectEvents = pgTable("prospect_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  detail: text("detail"),
  actorId: uuid("actor_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("prospect_events_prospect_idx").on(t.prospectId, t.createdAt)]);

// A bulk upload waiting for review: parsed rows with any issues found.
export const prospectImports = pgTable("prospect_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: uuid("recruiter_id").references(() => users.id, { onDelete: "set null" }),
  filename: text("filename"),
  source: text("source"),
  rows: jsonb("rows").notNull(),
  status: text("status").notNull().default("review"), // review | done
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Do not contact: opted out or asked not to be contacted. Checked before any outreach, forever.
export const outreachSuppression = pgTable("outreach_suppression", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailNorm: text("email_norm"),
  phoneNorm: text("phone_norm"),
  reason: text("reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("outreach_suppression_email_idx").on(t.emailNorm), index("outreach_suppression_phone_idx").on(t.phoneNorm)]);

// Admin bell: one row per admin per notification (read state is per person).
export const adminNotifications = pgTable("admin_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  readAt: ts("read_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("admin_notifications_user_idx").on(t.userId, t.readAt, t.createdAt)]);

// Outreach emails the owners edit: "first" email and two follow-ups. Placeholders: {first_name} {name} {city}
// {category} {recruiter} {link} {spots_left}. One shared set for every partner.
export const outreachTemplates = pgTable("outreach_templates", {
  key: text("key").primaryKey(), // "first" | "follow1" | "follow2" | "address" (mailing address in the footer, body only)
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// A group of prospects started (or scheduled) together.
export const outreachBatches = pgTable("outreach_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: uuid("recruiter_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled | running | paused | cancelled | done
  startAt: ts("start_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("outreach_batches_status_idx").on(t.status, t.startAt)]);

// Personal invite links in outreach emails: expire 24 hours after they're sent, credit the prospect's recruiter.
export const outreachLinks = pgTable("outreach_links", {
  token: text("token").primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  clickedAt: ts("clicked_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Every email in a prospect conversation: their replies (to info@usenearest.com), the AI's answers, a partner's answers.
export const prospectMessages = pgTable("prospect_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // "in" | "out"
  author: text("author").notNull(), // "prospect" | "ai" | "admin"
  authorId: uuid("author_id"),
  subject: text("subject"),
  body: text("body").notNull(),
  messageId: text("message_id"), // the email's Message-ID (prevents double-processing, threads replies)
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("prospect_messages_prospect_idx").on(t.prospectId, t.createdAt), index("prospect_messages_mid_idx").on(t.messageId)]);

// Approved answers the AI recruiter may use word-for-word (added by partners, often from "Needs review").
export const outreachAnswers = pgTable("outreach_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Broadcasts: one email to a chosen audience (prospects, professionals or students). Separate from recruiting —
// sending one never changes anyone's outreach status. Recipients are snapshotted when the draft is made.
export const broadcasts = pgTable("broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  audience: jsonb("audience").notNull(), // { kind, ...filters } and a human label
  label: text("label").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"), // draft | sending | sent | cancelled
  recipients: integer("recipients").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  sentAt: ts("sent_at"),
});

export const broadcastRecipients = pgTable("broadcast_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  broadcastId: uuid("broadcast_id").notNull().references(() => broadcasts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  firstName: text("first_name"),
  userId: uuid("user_id"),
  prospectId: uuid("prospect_id"),
  sentAt: ts("sent_at"),
}, (t) => [index("broadcast_recipients_todo_idx").on(t.broadcastId, t.sentAt)]);

// Taps on an ambassador's personal links, counted per day (kind = "pro" | "student").
export const repLinkClicks = pgTable("rep_link_clicks", {
  repId: uuid("rep_id").notNull().references(() => salesReps.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  day: date("day").notNull(),
  clicks: integer("clicks").notNull().default(0),
}, (t) => [uniqueIndex("rep_link_clicks_idx").on(t.repId, t.kind, t.day)]);

// ---------- Student launch campaign (elapsed-time tracking + manual evidence review) ----------
// One row per campaign. "occupied" is changed only by single atomic statements so the capacity can't be overfilled.
export const campaigns = pgTable("campaigns", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft | open | paused | closed
  capacity: integer("capacity").notNull().default(750),
  occupied: integer("occupied").notNull().default(0),
  market: text("market").notNull().default("DFW"),
  bookingOpensAt: ts("booking_opens_at"),
  instructions: text("instructions"),
  terms: text("terms"),
  termsVersion: text("terms_version"),
  termsPublishedAt: ts("terms_published_at"),
  graphicUrl: text("graphic_url"),
  rewardTitle: text("reward_title"),
  rewardIncludes: text("reward_includes"),
  rewardConfirmedAt: ts("reward_confirmed_at"), // owner confirmed the reward is arranged and funded
  rewardConfirmedBy: uuid("reward_confirmed_by"),
  updatedBy: uuid("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// One enrollment per student per campaign. Status: reserved → in_progress → ready_for_review → approved → redeemed
// (also needs_correction, rejected, cancelled). The 168-hour clock starts at started_at (server time).
export const campaignEntries = pgTable("campaign_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignKey: text("campaign_key").notNull().references(() => campaigns.key),
  studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("reserved"),
  termsVersion: text("terms_version"),
  termsAcceptedAt: ts("terms_accepted_at"),
  platform: text("platform"), // instagram | facebook | tiktok
  profileUrl: text("profile_url"),
  profileUrlNorm: text("profile_url_norm"),
  pendingProfileUrl: text("pending_profile_url"), // link change waiting for admin review
  pendingProfileReason: text("pending_profile_reason"),
  pendingProfileAt: ts("pending_profile_at"),
  reservedAt: ts("reserved_at").notNull().defaultNow(),
  fromWaitlist: boolean("from_waitlist").notNull().default(false),
  startedAt: ts("started_at"),
  completesAt: ts("completes_at"), // started_at + 168 hours
  finalProofAt: ts("final_proof_at"),
  correctionNote: text("correction_note"),
  decisionNote: text("decision_note"),
  decidedBy: uuid("decided_by"),
  approvedAt: ts("approved_at"),
  rejectedAt: ts("rejected_at"),
  cancelledAt: ts("cancelled_at"),
  placeReleased: boolean("place_released").notNull().default(false),
  rewardBookingId: uuid("reward_booking_id"),
  redeemedAt: ts("redeemed_at"),
  flags: text("flags"), // possible duplicates etc., for review
  cityId: integer("city_id"),
  countyId: integer("county_id"),
  version: integer("version").notNull().default(0), // bumped on every change; admin decisions must match it
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("campaign_entries_student_idx").on(t.campaignKey, t.studentId), index("campaign_entries_status_idx").on(t.campaignKey, t.status)]);

// Screenshots. uploaded_at is the server time; window_index 1–7 = daily windows, 8 = final proof.
export const campaignEvidence = pgTable("campaign_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => campaignEntries.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull(),
  kind: text("kind").notNull(), // start | daily | final
  windowIndex: integer("window_index").notNull(),
  storageUrl: text("storage_url").notNull(), // never sent to the browser — served only through /api/campaign/evidence/[id]
  storageAccess: text("storage_access").notNull().default("private"),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  uploadedAt: ts("uploaded_at").notNull().defaultNow(),
}, (t) => [index("campaign_evidence_entry_idx").on(t.entryId, t.uploadedAt)]);

// An admin looked at the student's social profile directly.
export const campaignChecks = pgTable("campaign_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => campaignEntries.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  pictureVisible: boolean("picture_visible"), // null = couldn't view the profile
  notes: text("notes"),
  checkedAt: ts("checked_at").notNull().defaultNow(),
});

// Everything that happened to an entry (who, what, when) — never edited.
export const campaignEvents = pgTable("campaign_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => campaignEntries.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id"),
  kind: text("kind").notNull(),
  detail: text("detail"),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("campaign_events_entry_idx").on(t.entryId, t.at)]);

export const campaignWaitlist = pgTable("campaign_waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignKey: text("campaign_key").notNull(),
  studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("waiting"), // waiting | placed | removed
  joinedAt: ts("joined_at").notNull().defaultNow(),
  placedAt: ts("placed_at"),
}, (t) => [uniqueIndex("campaign_waitlist_student_idx").on(t.campaignKey, t.studentId)]);

// Idempotency for campaign emails + notifications: a key is sent once, ever.
export const campaignNotices = pgTable("campaign_notices", {
  key: text("key").primaryKey(),
  userId: uuid("user_id"),
  sentAt: ts("sent_at").notNull().defaultNow(),
});

// Free-service rewards: one row per participating professional — the service they chose (listed at $25+) and how many
// free appointments they give. payout_cents is 0 (the professional gives the service free); confirmed_by = the professional.
export const campaignOffers = pgTable("campaign_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignKey: text("campaign_key").notNull(),
  proId: uuid("pro_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull(),
  payoutCents: integer("payout_cents").notNull(),
  slotsTotal: integer("slots_total").notNull(),
  slotsUsed: integer("slots_used").notNull().default(0),
  agreementNote: text("agreement_note"),
  confirmedBy: uuid("confirmed_by"),
  confirmedAt: ts("confirmed_at"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------- Supporter (educator) endorsements — separate from student reviews and pro ratings ----------
// Invitations an admin creates and shares themselves (copy link). One submission per invitation.
export const supporterInvites = pgTable("supporter_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(), // random, unguessable; the admin copies the link
  label: text("label"), // who it's for (admin note)
  status: text("status").notNull().default("invited"), // invited | submitted | revoked
  expiresAt: ts("expires_at").notNull(),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  usedAt: ts("used_at"),
  supporterId: uuid("supporter_id"),
}, (t) => [uniqueIndex("supporter_invites_token_idx").on(t.token)]);

// A supporter's submission. statement_original is never changed; corrections and approved revisions go to other columns.
export const supporters = pgTable("supporters", {
  id: uuid("id").primaryKey().defaultRandom(),
  inviteId: uuid("invite_id").notNull(),
  status: text("status").notNull().default("submitted"), // submitted | needs_correction | approved | published | declined | withdrawn
  manageTokenHash: text("manage_token_hash").notNull(), // sha256 of the private management link token
  name: text("name").notNull(),
  email: text("email").notNull(), // private — never shown publicly
  title: text("title").notNull(),
  organization: text("organization").notNull(), // "" when not affiliated
  affiliationStatus: text("affiliation_status").notNull().default("current"), // current | former | none
  portraitUrl: text("portrait_url"), // Blob reference; served only through /api/supporters/portrait/[id]
  portraitAccess: text("portrait_access"), // private | public
  statementOriginal: text("statement_original").notNull(),
  statementCurrent: text("statement_current").notNull(), // the supporter's own latest wording (after their corrections)
  statementProposed: text("statement_proposed"), // admin's suggested wording — needs the supporter's approval
  statementProposedAt: ts("statement_proposed_at"),
  statementPublished: text("statement_published"), // exactly what's shown publicly
  rating: integer("rating"), // the supporter's own 1–5 star rating of Nearest
  benefitCurrent: text("benefit_current"), // "How could Nearest benefit students and parents?" in their own words
  benefitPublished: text("benefit_published"),
  experience: text("experience").notNull(), // walkthrough | website | platform_use | other
  experienceOther: text("experience_other"),
  endorsementType: text("endorsement_type").notNull(), // personal | organizational
  orgAuthorityNote: text("org_authority_note"), // their role / how they're authorized (organizational only)
  orgAuthorityConfirmed: boolean("org_authority_confirmed").notNull().default(false), // supporter confirmed authorization
  orgAuthorityReviewedBy: uuid("org_authority_reviewed_by"), // admin confirmed it on approval
  relationships: text("relationships").array(), // compensation | benefit | employment | other (empty = none)
  relationshipNote: text("relationship_note"),
  permStatement: boolean("perm_statement").notNull().default(false),
  permName: boolean("perm_name").notNull().default(false), // name + title
  permPortrait: boolean("perm_portrait").notNull().default(false),
  permAffiliation: boolean("perm_affiliation").notNull().default(false),
  confirmHonest: boolean("confirm_honest").notNull().default(false),
  confirmPhoto: boolean("confirm_photo").notNull().default(false),
  adminNote: text("admin_note"), // correction request / decline reason shown to the supporter on the management page
  submittedAt: ts("submitted_at").notNull().defaultNow(),
  approvedAt: ts("approved_at"),
  approvedBy: uuid("approved_by"),
  publishedAt: ts("published_at"),
  withdrawnAt: ts("withdrawn_at"),
  sort: integer("sort").notNull().default(0),
  version: integer("version").notNull().default(1),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("supporters_status_idx").on(t.status)]);

// Everything that happened to a supporter record (submission, corrections, permission changes, admin decisions).
export const supporterEvents = pgTable("supporter_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  supporterId: uuid("supporter_id").notNull().references(() => supporters.id, { onDelete: "cascade" }),
  actor: text("actor").notNull(), // supporter | admin
  actorId: uuid("actor_id"),
  kind: text("kind").notNull(),
  detail: jsonb("detail"),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("supporter_events_idx").on(t.supporterId, t.at)]);

// ---------- Enrollment holds (2026-10-23) ----------
// Professionals who never finished registering within 30 days — no Professional Terms accepted, no ID sent, never
// submitted — and invitations / registration links never used in 30 days. Nothing is deleted: the account and all its
// information stay; a "held" row blocks registration with the enrollment-closed message until an owner releases it.
// kind: "account" (users.id in user_id) | "invitation" (invitations.id) | "outreach" (prospects.id). One row per subject.
export const enrollmentHolds = pgTable("enrollment_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  subjectId: text("subject_id").notNull(), // users.id | invitations.id | prospects.id
  userId: uuid("user_id"),
  email: text("email"), // normalized, so a fresh sign-up with the same email is held too
  name: text("name"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("held"), // held | released
  heldAt: ts("held_at").notNull().defaultNow(),
  releasedAt: ts("released_at"),
  releasedBy: uuid("released_by"),
  releaseNote: text("release_note"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: ts("last_attempt_at"),
}, (t) => [uniqueIndex("enrollment_holds_subject_idx").on(t.kind, t.subjectId), index("enrollment_holds_email_idx").on(t.email), index("enrollment_holds_user_idx").on(t.userId), index("enrollment_holds_status_idx").on(t.status)]);

// Every time a held professional tries to come back (sign in, open setup, register again, use the invitation).
export const enrollmentHoldAttempts = pgTable("enrollment_hold_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  holdId: uuid("hold_id").notNull().references(() => enrollmentHolds.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // signed_in | registration | invitation | claim_link
  detail: text("detail"),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("enrollment_hold_attempts_idx").on(t.holdId, t.at)]);
