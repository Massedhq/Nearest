// Every rule in the rules engine. The database copy (platform_settings) always wins;
// these defaults are only used for seeding and as a fallback if a row is missing.
export type SettingType = "number" | "time" | "cents" | "bool";

export type SettingDef = {
  label: string;
  group: string;
  type: SettingType;
  unit?: string;
  value: number | string | boolean;
};

export const SETTINGS: Record<string, SettingDef> = {
  "booking.advance_hours": { label: "Advance booking", group: "Booking", type: "number", unit: "hours", value: 24 },
  "booking.same_day_cutoff": { label: "Same-day cutoff", group: "Booking", type: "time", value: "12:00" },
  "booking.same_day_min_notice_hours": { label: "Minimum same-day notice", group: "Booking", type: "number", unit: "hours", value: 4 },
  "appt.grace_minutes": { label: "Late grace period", group: "Appointment", type: "number", unit: "min", value: 15 },
  "appt.checkin_radius_ft": { label: "Check-in geofence", group: "Appointment", type: "number", unit: "ft", value: 100 },
  "appt.messaging_days": { label: "Messaging window", group: "Appointment", type: "number", unit: "days", value: 90 },
  "appt.deposit_cents": { label: "Protected deposit", group: "Appointment", type: "cents", value: 500 },
  "cancel.cutoff_hours": { label: "Cancellation cutoff", group: "Cancellation & credits", type: "number", unit: "hours", value: 24 },
  "enforce.customer_noshow_limit": { label: "No-shows before suspension", group: "Customer enforcement", type: "number", value: 5 },
  "enforce.customer_suspension_days": { label: "Customer suspension", group: "Customer enforcement", type: "number", unit: "days", value: 90 },
  "enforce.completion_hours": { label: "Auto-complete after (hours)", group: "Customer enforcement", type: "number", unit: "hours", value: 24 },
  "enforce.fine_cents": { label: "Fine amount", group: "Professional enforcement", type: "cents", value: 5000 },
  "enforce.fine_due_days": { label: "Fine due", group: "Professional enforcement", type: "number", unit: "days", value: 7 },
  "enforce.pro_incident_limit": { label: "Incident threshold", group: "Professional enforcement", type: "number", value: 3 },
  "enforce.pro_suspension_days": { label: "Pro suspension", group: "Professional enforcement", type: "number", unit: "days", value: 30 },
  "enforce.unpaid_fine_termination_days": { label: "Unpaid fine termination", group: "Professional enforcement", type: "number", unit: "days", value: 30 },
  "growth.founding_capacity": { label: "First In capacity (paid professionals)", group: "Growth", type: "number", value: 750 },
  "growth.second_cohort_end": { label: "$20 pricing through pro #", group: "Growth", type: "number", value: 3500 },
  "partner.pool_size": { label: "Partner pool size (pros)", group: "Growth", type: "number", value: 3500 },
  "partner.nearest_block": { label: "Pool pros whose payments go to Nearest", group: "Growth", type: "number", value: 500 },
  "growth.target_per_city": { label: "Target per city", group: "Growth", type: "number", value: 5 },
  "outreach.paused": { label: "Pause all outreach emails", group: "Outreach", type: "bool", value: false },
  "outreach.ai_enabled": { label: "AI recruiter answers replies", group: "Outreach", type: "bool", value: true },
  "outreach.per_run": { label: "Outreach emails sent per 15 minutes (all partners)", group: "Outreach", type: "number", value: 40 },
  "outreach.follow1_days": { label: "Days before the first follow-up", group: "Outreach", type: "number", value: 3 },
  "outreach.follow2_days": { label: "Days before the second follow-up", group: "Outreach", type: "number", value: 4 },
  "growth.target_per_category": { label: "First In spots per category, per city", group: "Growth", type: "number", value: 5 },
  "growth.next_entry_capacity": { label: "Next 750 — spots at the next entry rate", group: "Growth", type: "number", value: 750 },
  "growth.cap_per_category": { label: "Total spots per category, per city (then waitlist)", group: "Growth", type: "number", value: 10 },
  "growth.market_goal": { label: "Market goal (signed-up professionals)", group: "Growth", type: "number", value: 1500 },
  "sub.termination_days": { label: "Subscription termination", group: "Growth", type: "number", unit: "days", value: 90 },
  "status.pro_registration": { label: "Professional Registration", group: "Status", type: "bool", value: true },
  "status.founding_invitations": { label: "Invitations", group: "Status", type: "bool", value: true },
  "status.student_registration": { label: "Student Registration", group: "Status", type: "bool", value: true },
  "status.bookings": { label: "Bookings", group: "Status", type: "bool", value: false },
};

export const STATUS_KEYS = [
  "status.pro_registration",
  "status.founding_invitations",
  "status.student_registration",
  "status.bookings",
] as const;
