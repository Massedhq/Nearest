import {
  pgTable, pgEnum, uuid, text, date, timestamp, boolean, integer, jsonb, bigserial, primaryKey, index, uniqueIndex,
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
  createdAt: ts("created_at").notNull().defaultNow(),
});

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
  serviceMode: serviceMode("service_mode"),
  travelRadiusMi: integer("travel_radius_mi"),
  // Phase 2: communication
  languages: text("languages").array(),
  aslLevel: aslLevel("asl_level").notNull().default("none"),
  textCommunication: boolean("text_communication").notNull().default(false),
  // Phase 2: availability
  acceptsAfterSchool: boolean("accepts_after_school").notNull().default(false),
  vacationMode: boolean("vacation_mode").notNull().default(false),
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
