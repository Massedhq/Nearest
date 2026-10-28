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
  "booking.request_reminder_minutes": { label: "Remind the pro about an unanswered request after", group: "Booking", type: "number", unit: "min", value: 60 },
  "booking.request_reminder_same_day_minutes": { label: "Remind sooner when the appointment is within 12 hours", group: "Booking", type: "number", unit: "min", value: 30 },
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
  "growth.unfinished_registration_days": { label: "Days a professional has to accept the Terms or send their ID (and to use an invitation) before registration is put on hold", group: "Growth", type: "number", unit: "days", value: 30 },
  "growth.target_per_city": { label: "Target per city", group: "Growth", type: "number", value: 5 },
  "campaign.reward_credit_cents": { label: "Launch campaign reward — Nearest credit added when a student is approved", group: "Fees", type: "cents", value: 2000 },
  "meet.meeting_minutes": { label: "Outreach meetings — length of each meeting", group: "Outreach meetings", type: "number", unit: "min", value: 30 },
  "meet.travel_minutes": { label: "Outreach meetings — travel time needed after each meeting", group: "Outreach meetings", type: "number", unit: "min", value: 45 },
  "meet.first_time": { label: "Outreach meetings — first start time", group: "Outreach meetings", type: "time", value: "09:00" },
  "meet.last_time": { label: "Outreach meetings — last start time", group: "Outreach meetings", type: "time", value: "19:00" },
  "meet.break_start": { label: "Outreach meetings — no meetings from", group: "Outreach meetings", type: "time", value: "12:00" },
  "meet.break_end": { label: "Outreach meetings — no meetings until", group: "Outreach meetings", type: "time", value: "13:00" },
  "meet.day_off": { label: "Outreach meetings — no-travel day (0 = Sunday, 1 = Monday … 6 = Saturday)", group: "Outreach meetings", type: "number", value: 1 },
  "meet.days_ahead": { label: "Outreach meetings — how far ahead people can book", group: "Outreach meetings", type: "number", unit: "days", value: 21 },
  "meet.min_notice_hours": { label: "Outreach meetings — minimum notice before a meeting", group: "Outreach meetings", type: "number", unit: "hours", value: 3 },
  "meet.spots_per_specialty": { label: "Outreach meetings — spots per specialty in each city", group: "Outreach meetings", type: "number", value: 5 },
  "match.min_score": { label: "Find by photo — lowest match score shown (out of 10; 8 = same look with tiny differences)", group: "Find by photo", type: "number", value: 7 },
  "match.daily_searches": { label: "Find by photo — searches per student per day", group: "Find by photo", type: "number", value: 20 },
  "match.shortlist": { label: "Find by photo — closest portfolio photos checked by the AI each search (3–20)", group: "Find by photo", type: "number", value: 12 },
  "match.fallback_similarity": { label: "Find by photo — when the AI is unavailable, show only photos this similar", group: "Find by photo", type: "number", unit: "%", value: 88 },
  "shop.order_fee_cents": { label: "Partner shop — Nearest fee per order (taken from the seller's payout)", group: "Partner shop", type: "cents", value: 0 },
  "shop.max_price_cents": { label: "Partner shop — highest product price", group: "Partner shop", type: "cents", value: 50000 },
  "shop.download_limit": { label: "Partner shop — downloads allowed per digital purchase", group: "Partner shop", type: "number", value: 10 },
  "shop.download_days": { label: "Partner shop — days a download link keeps working", group: "Partner shop", type: "number", unit: "days", value: 365 },
  "fees.service_fee_cents": { label: "Nearest service fee per service (added to the price students see)", group: "Fees", type: "cents", value: 500 },
  "outreach.paused": { label: "Pause all outreach emails", group: "Outreach", type: "bool", value: false },
  "outreach.ai_enabled": { label: "AI recruiter answers replies", group: "Outreach", type: "bool", value: true },
  "outreach.per_run": { label: "Outreach emails sent per 15 minutes (all partners)", group: "Outreach", type: "number", value: 40 },
  "outreach.follow1_days": { label: "Days before the first follow-up", group: "Outreach", type: "number", value: 3 },
  "outreach.follow2_days": { label: "Days before the second follow-up", group: "Outreach", type: "number", value: 4 },
  "growth.target_per_category": { label: "Spots per opening, per category, per city (first opening = First In)", group: "Growth", type: "number", value: 5 },
  "growth.next_entry_capacity": { label: "Next 750 — spots at the next entry rate", group: "Growth", type: "number", value: 750 },
  "growth.cap_per_category": { label: "Most spots per category, per city — only after an owner authorizes the second opening (never above 10)", group: "Growth", type: "number", value: 10 },
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
