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
  "enforce.fine_cents": { label: "Fine amount", group: "Professional enforcement", type: "cents", value: 5000 },
  "enforce.fine_due_days": { label: "Fine due", group: "Professional enforcement", type: "number", unit: "days", value: 7 },
  "enforce.pro_incident_limit": { label: "Incident threshold", group: "Professional enforcement", type: "number", value: 3 },
  "enforce.pro_suspension_days": { label: "Pro suspension", group: "Professional enforcement", type: "number", unit: "days", value: 30 },
  "enforce.unpaid_fine_termination_days": { label: "Unpaid fine termination", group: "Professional enforcement", type: "number", unit: "days", value: 30 },
  "growth.founding_capacity": { label: "Founding capacity", group: "Growth", type: "number", value: 750 },
  "growth.target_per_city": { label: "Target per city", group: "Growth", type: "number", value: 5 },
  "growth.invite_expiry_days": { label: "Invitation expiry", group: "Growth", type: "number", unit: "days", value: 7 },
  "sub.termination_days": { label: "Subscription termination", group: "Growth", type: "number", unit: "days", value: 90 },
  "status.pro_registration": { label: "Professional Registration", group: "Status", type: "bool", value: true },
  "status.founding_invitations": { label: "Founding Invitations", group: "Status", type: "bool", value: true },
  "status.student_registration": { label: "Student Registration", group: "Status", type: "bool", value: true },
  "status.bookings": { label: "Bookings", group: "Status", type: "bool", value: false },
};

export const STATUS_KEYS = [
  "status.pro_registration",
  "status.founding_invitations",
  "status.student_registration",
  "status.bookings",
] as const;
