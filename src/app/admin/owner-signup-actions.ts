"use server";

/** Only the owner emails in OWNER_EMAILS may create an owner login. (The emailed code still proves they own the address.) */
export async function isOwnerEmail(email: string) {
  const list = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(email ?? "").trim().toLowerCase());
}
