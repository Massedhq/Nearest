/** Alternative to a school ID for schools that don't issue one (trade schools and similar). Shared by student + admin screens. */
export const NO_ID_LABEL = "My school does not issue student IDs";
export const NO_ID_EXPLAIN =
  "Upload an enrollment confirmation, current class schedule, student portal screenshot, or tuition receipt showing your name, school, and current enrollment. You may hide financial details and unrelated personal information.";

export const ENROLLMENT_DOC_KINDS = {
  enrollment_confirmation: "Enrollment confirmation",
  class_schedule: "Current class schedule",
  student_portal: "Student portal screenshot",
  tuition_receipt: "Tuition receipt",
} as const;
export type EnrollmentDocKind = keyof typeof ENROLLMENT_DOC_KINDS;

/** Raw file limit (PDFs aren't resized; photos are shrunk on the phone first). */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

export const PROOF_REJECT_REASONS = [
  "The document doesn't show your name.",
  "The document doesn't show the school you chose.",
  "The document doesn't show current enrollment (it's out of date or for a past term).",
  "The name on the document doesn't match your Nearest account.",
] as const;

export const PROOF_CLEARER_REASONS = [
  "The document is blurry or hard to read. Please upload a clearer photo or a PDF.",
  "Part of the document is cut off. Please include the whole page.",
  "Your name, school or current term is covered. Hide only financial details and unrelated personal information.",
  "Please upload a more recent document from this term.",
] as const;
