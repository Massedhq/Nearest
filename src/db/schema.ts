import {
  pgTable, pgEnum, uuid, text, date, timestamp, boolean, integer, jsonb, bigserial, primaryKey, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const accountType = pgEnum("account_type", ["student", "professional", "staff"]);
export const userStatus = pgEnum("user_status", ["active", "paused", "suspended", "deactivated"]);
export const studentVerification = pgEnum("student_verification", ["unverified", "pending", "manual_review", "verified", "rejected"]);
export const identityStatus = pgEnum("identity_status", ["unverified", "pending", "verified", "rejected"]);
export const cohort = pgEnum("cohort", ["FOUNDING", "SECOND", "STANDARD"]);
export const inviteStatus = pgEnum("invite_status", ["invited", "registered", "expired", "declined", "revoked"]);
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
  createdAt: ts("created_at").notNull().defaultNow(),
});

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
