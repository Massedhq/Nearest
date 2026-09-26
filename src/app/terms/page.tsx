import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Terms of Service" };

const ENTITY = "[Company legal name]";
const ADDRESS = "[Mailing address]";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 2026"
      other={{ href: "/privacy", label: "Privacy Policy" }}
      intro={[
        `These Terms of Service ("Terms") are an agreement between you and ${ENTITY}, doing business as Nearest ("Nearest," "we," "us"). They apply whenever you use usenearest.com, the Nearest app, or any related service (together, the "Service").`,
        "By creating an account or using the Service, you agree to these Terms and to our Privacy Policy. If you don't agree, don't use the Service. If you are under 18, your parent or legal guardian must also agree to these Terms (see Section 3).",
        "Please read Sections 7 (Cancellations, No-Shows and Credits) and 19–21 (Disclaimers, Limits on Liability and Disputes) carefully — they affect your rights.",
      ]}
      sections={[
        {
          h: "1. What Nearest is",
          p: [
            "Nearest is an online marketplace that connects verified students (\"Students\") with independent beauty and personal-care professionals (\"Professionals\") in participating areas of the Dallas–Fort Worth region. Through Nearest, Students can find Professionals, book and pay for appointments and Model Calls, message about their booking, and leave reviews.",
            "Nearest does not provide beauty, hair, lash, nail, barber, makeup, photography or any other personal-care services. Professionals are independent businesses. They are not Nearest's employees, agents or contractors, and Nearest does not control how they perform their services. Any agreement for a service is between the Student and the Professional; Nearest provides the platform, payment processing and the booking rules described in these Terms.",
          ],
        },
        {
          h: "2. Changes to the Service",
          p: ["We may add, change or remove features, participating areas, categories and rules at any time. Rule values shown in these Terms (for example notice periods, grace periods, deposit amounts and fines) are the current settings and may be updated; the values in effect when you make a booking apply to that booking."],
        },
        {
          h: "3. Who can use Nearest",
          p: [
            "Students. To book on Nearest you must:",
            [
              "be at least 13 years old;",
              "be currently enrolled at a participating high school, college or trade school; and",
              "complete Nearest's student verification (school, school ID photo and selfie) and re-verify when asked, at least once each school year.",
            ],
            "Students under 18. If you are 13 to 17, you may use Nearest only with the permission of your parent or legal guardian, who must review and agree to these Terms on your behalf. Your parent or guardian is responsible for your use of Nearest and for any payments made on your account, and should be comfortable with the services you book, where appointments take place, and the fact that Professionals are independent adults. Some services may require parental consent under the Professional's own policies or Texas licensing rules; Professionals may decline to serve a minor without it.",
            "Professionals. To offer services on Nearest you must be at least 18, legally able to work in the United States, able to form a binding contract, and hold every license, permit and registration required for the services you list (see Section 10).",
            "Nearest isn't available to anyone we have previously removed, or where it would be unlawful. We may refuse, suspend or close any account at our discretion, including if we can't verify the information provided.",
          ],
        },
        {
          h: "4. Your account and verification",
          p: [
            "You agree to give accurate, current and complete information, keep it up to date, keep your login secure, and use only one account. You're responsible for everything that happens under your account. Tell us right away at hello@usenearest.com if you think your account has been used without permission.",
            "Student verification is reviewed by Nearest staff. Professional identity is verified by our payment partner (Stripe Identity) using a government ID and a live selfie. Identity verification only confirms that a real person is behind an account — it is not a background check, criminal history search, or endorsement of anyone's skills, character or safety.",
            "\"Approved by Nearest,\" \"Identity Verified,\" \"Verified Student\" and similar labels describe the checks described here and nothing more.",
          ],
        },
        {
          h: "5. Booking appointments",
          p: [
            "Professionals set their own services, prices, hours and locations. When you book, you agree to the service, price, date, time and location shown at checkout.",
            [
              "Standard bookings must be made at least 24 hours before the appointment.",
              "Same-day bookings are available only for openings a Professional has posted for that day, only until 12:00 PM Central Time, and only for start times at least 4 hours away.",
              "Where the service happens — at the Professional's location or at an address you provide — is shown at checkout. The appointment address is shared with the booked Student (or, for travel appointments, with the Professional) starting at 12:00 AM Central Time on the appointment day.",
              "Each booking has its own message thread. Keep booking communication inside Nearest; phone numbers and email addresses are not shared between users.",
            ],
            "Model Calls are appointments a Professional offers, often at a reduced price, to practice techniques or build a portfolio. Results may differ from a standard service. Model Calls may list requirements (for example, natural hair only, or photos/video required); by booking you confirm you meet them. A Professional may cancel a Model Call; if they do, Section 7's Professional cancellation terms apply.",
          ],
        },
        {
          h: "6. Payments",
          p: [
            "Payments are processed by Stripe. By paying through Nearest you also agree to Stripe's terms. Nearest does not store full card numbers.",
            [
              "Bookings are paid in full at checkout. Each booking includes a protected deposit (currently $5, or the full price if the service costs less).",
              "Your payment is held by Nearest's payment processor and is released to the Professional when you complete the appointment finish steps (confirm the service, optional photo, review, release payment).",
              "If a Professional has finished the service and you don't complete the finish steps within 24 hours after the scheduled end time, the payment is released to the Professional automatically, unless you have reported a problem that is still under review.",
              "Available credits are applied automatically at checkout before any card charge.",
              "Prices are set by Professionals and include everything shown at checkout. You're responsible for any taxes that apply to your purchase if not included.",
            ],
            "Nearest does not charge Students a booking fee. Professionals pay Nearest a membership fee and bear card-processing fees, as described in Section 10.",
          ],
        },
        {
          h: "7. Cancellations, no-shows and credits",
          p: [
            "Nearest uses service credits instead of cash refunds. Please make sure you can attend before you book.",
            [
              "If you cancel 24 hours or more before the appointment: the full amount you paid becomes credit you can use with that same Professional.",
              "If you cancel less than 24 hours before the appointment: the protected deposit is forfeited and paid to the Professional; the rest becomes credit with that same Professional.",
              "Grace period: Professionals must wait 15 minutes after the start time. If you haven't checked in by then, the Professional may mark you a no-show. A no-show is treated like a late cancellation: the deposit is forfeited to the Professional and the rest becomes credit with that Professional.",
              "If a Professional cancels, or Nearest confirms the Professional was at fault (see Section 8), you receive the full amount as general Nearest credit you can use with any Professional.",
            ],
            "About credits: credits have no cash value; can't be withdrawn, sold, transferred or exchanged for cash; don't expire while your account is open; and can be used only on Nearest. Credits tied to a Professional can be used only with that Professional. Credits are not gift cards or stored-value cards. If your account is closed, unused credits end, except where the law requires otherwise.",
            "Nothing in these Terms limits any refund right you have under applicable law. If a charge was made in error (for example a duplicate charge or a booking that failed), contact us and we will correct it.",
          ],
        },
        {
          h: "8. Appointment day",
          p: [
            [
              "Check in through the app when you arrive. Check-in uses your device's location and requires you to be at the appointment location (currently within 100 feet).",
              "If something goes wrong at the appointment — the Professional isn't there, refuses the booked service, or there's an access problem — report it from the appointment location using Report a problem. Reports are reviewed by Nearest; a report doesn't automatically mean anyone is at fault.",
              "Before you leave, complete the finish steps. Photos are optional; a photo is shown on a Professional's portfolio only if you choose Yes.",
              "Be respectful and safe. Either party may end or decline an appointment if they feel unsafe or are treated inappropriately; report it to us.",
              "Tell your Professional about allergies, sensitivities, medical conditions or medications that could affect the service (for example adhesive or product allergies). Ask for a patch test if you are unsure. Services involving the body carry inherent risks, including allergic reactions and irritation.",
            ],
          ],
        },
        {
          h: "9. Account standing",
          p: [
            "To keep Nearest fair and reliable:",
            [
              "Students: more than 5 no-shows, or leaving an appointment without completing the finish steps, pauses booking for 90 days.",
              "Professionals: each confirmed professional-fault incident results in a fine (currently $50) due within 7 days. While a fine is past due, your profile is hidden from Students. Every 3rd confirmed incident suspends your account for 30 days. An unpaid fine outstanding for 30 days may result in account termination.",
              "We may also suspend or close accounts for violations of these Terms, safety concerns, fraud, chargebacks, or unpaid amounts.",
            ],
            "You can request a review of any suspension or fine in the app. Reviews can take 30 to 90 days, and the action stays in place during the review unless we decide otherwise. Our decision after review is final, subject to Section 21.",
          ],
        },
        {
          h: "10. Additional terms for Professionals",
          p: [
            "Independent business. You operate your own independent business. You decide whether to accept work on Nearest, your prices, your hours, your methods and your tools. Nothing in these Terms creates an employment, partnership, joint venture, franchise or agency relationship. You're responsible for your own taxes, insurance, supplies, workspace and compliance.",
            "Licenses and law. You must hold and maintain every license, permit and registration required for the services you offer — including any required by the Texas Department of Licensing and Regulation (TDLR) — and follow all health, sanitation and safety rules. You must keep license information on Nearest accurate and tell us immediately if a license lapses, is suspended or is revoked. Nearest's license review is limited and doesn't replace your obligations.",
            "Insurance. We strongly recommend that you carry professional liability (malpractice) and general liability insurance appropriate to your services.",
            "Your listings. Your profile, services, prices, photos, hours, location, languages and ASL level must be accurate. Only post work you performed or have the right to post. You must honor bookings made through Nearest at the listed price.",
            "Membership. Professionals pay a monthly membership to be listed. Founding Professionals receive 30 days free, then $10 per month for their first 12 months. Other introductory cohorts pay the rate shown when they join (currently $20 per month for their first 12 months). After the introductory 12 months, your membership moves to the standard rate in effect at that time (currently $30 per month); we'll let you know before it changes. Memberships renew automatically each month until cancelled. You can cancel anytime from Membership & payments; cancellation takes effect at the end of the current billing period, and fees already paid aren't refunded except where required by law. If a membership payment fails, your profile may be hidden until it's paid, and a membership more than 90 days past due may be terminated.",
            "No commission; fees. Nearest does not take a commission on bookings. Card-processing fees charged by our payment processor are deducted from each payout.",
            "Payouts. Payouts are made through Stripe Connect to the account you connect. You must complete Stripe's onboarding and identity requirements and agree to Stripe's terms. Payout timing is set by Stripe. Stripe may issue tax forms (such as Form 1099-K) where required.",
            "Keeping bookings on Nearest. You may not ask Students you met through Nearest to cancel and rebook outside Nearest, or ask for payment outside Nearest for a booking made on Nearest.",
            "Minors. Some Students are 13 to 17. You're responsible for following any law, licensing rule or policy that applies to serving minors, including obtaining parental consent where required, and you may decline to serve a minor.",
          ],
        },
        {
          h: "11. Reviews, photos and other content",
          p: [
            "Content includes profiles, photos, service descriptions, messages, reviews and anything else you submit. You keep ownership of your content. You give Nearest a worldwide, non-exclusive, royalty-free license to host, store, display, reproduce, adapt (for formatting) and distribute your content to operate, improve and promote the Service. This license ends when you delete the content or your account, except for copies already shared with others, backups kept for a limited time, and content we must keep for legal reasons.",
            "Reviews can be left only for completed bookings and must reflect your honest experience. Professionals may not offer anything in exchange for reviews or ask for reviews to be changed or removed.",
            "Photos taken during the finish steps are shared to a Professional's portfolio only when the Student chooses Yes. If you're in a photo you want removed, contact us.",
            "You may not post content that is illegal, false, misleading, defamatory, harassing, hateful, sexually explicit, or that infringes someone else's rights, or that includes another person's personal information without permission. We may remove content and take action on accounts at our discretion.",
          ],
        },
        {
          h: "12. Messages and notices",
          p: [
            "Booking messages are for arranging and completing the booking. For safety, Nearest may review messages in connection with reports, disputes or suspected violations. Message threads close 90 days after the appointment.",
            "You agree that we may send you service messages (such as verification codes, booking confirmations, reminders, receipts, and account notices) by email and in the app. These are part of the Service and can't be turned off while your account is active.",
          ],
        },
        {
          h: "13. Things you may not do",
          p: [
            [
              "Break any law or anyone else's rights, or use Nearest for anything unsafe or illegal.",
              "Create fake accounts, impersonate anyone, or submit false verification information or someone else's ID.",
              "Harass, threaten, discriminate against or abuse anyone.",
              "Share contact details to take bookings off Nearest, or pay or ask for payment outside Nearest for a Nearest booking.",
              "Manipulate reviews, ratings, check-in or location data.",
              "Scrape, copy, reverse engineer, overload or interfere with the Service, or access it by automated means without our permission.",
              "Use Nearest for any commercial purpose other than as a Student or Professional as described here.",
            ],
          ],
        },
        {
          h: "14. Safety",
          p: [
            "Nearest does not conduct criminal background checks and does not supervise appointments. Use good judgment: review profiles and reviews, keep communication in the app, tell someone where you are going, and leave if you feel unsafe. In an emergency, call 911. Report any safety concern to us at hello@usenearest.com.",
          ],
        },
        {
          h: "15. Location",
          p: [
            "Check-in and problem reports use your device's location at that moment. Near Me uses your device's location to show distances. You can turn location access off in your device settings, but check-in and on-site problem reports won't work without it.",
          ],
        },
        {
          h: "16. Nearest's rights",
          p: [
            "The Service, including its software, design, logos and trademarks, belongs to Nearest and its licensors. We give you a limited, personal, revocable, non-transferable license to use the Service as allowed by these Terms. If you send us feedback or ideas, we may use them without any obligation to you.",
          ],
        },
        {
          h: "17. Third-party services",
          p: [
            "The Service relies on third parties, including Stripe (payments, payouts and identity verification), Clerk (sign-in), and hosting and email providers, and may link to other websites (for example a Professional's Instagram, TikTok or website). We're not responsible for third-party services or websites, and your use of them is subject to their terms.",
          ],
        },
        {
          h: "18. Ending your account",
          p: [
            "You can ask us to close your account at any time. You can't close an account with upcoming appointments or unpaid amounts; cancel or complete those first. We may suspend or close your account as described in Sections 3, 9 and 13. Sections that by their nature should survive (including payments owed, credits, content licenses, disclaimers, limits on liability, indemnity and disputes) survive after your account ends.",
          ],
        },
        {
          h: "19. Disclaimers",
          p: [
            "The Service is provided \"as is\" and \"as available.\" To the fullest extent allowed by law, Nearest disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, title and non-infringement. Nearest does not guarantee the quality, safety, legality, timing or results of any service provided by a Professional, the accuracy of any listing, review or user content, or that the Service will be uninterrupted or error-free. Professionals are solely responsible for the services they provide.",
          ],
        },
        {
          h: "20. Limits on liability",
          p: [
            "To the fullest extent allowed by law, Nearest and its owners, employees and agents will not be liable for any indirect, incidental, special, consequential, exemplary or punitive damages, or for lost profits, data or goodwill, or for any injury, loss or damage arising from services provided by Professionals or from interactions between users, even if we were told they were possible.",
            "To the fullest extent allowed by law, Nearest's total liability for all claims relating to the Service is limited to the greater of (a) the amounts you paid to Nearest in the 12 months before the claim arose, or (b) $100. Some laws don't allow certain limitations, so some of these may not apply to you.",
            "Indemnity: to the extent allowed by law, you agree to defend and hold Nearest harmless from claims, losses and costs (including reasonable attorneys' fees) arising from your content, your use of the Service, your violation of these Terms or the law, or — for Professionals — the services you provide.",
          ],
        },
        {
          h: "21. Disputes and governing law",
          p: [
            "Talk to us first. Most concerns can be resolved quickly. Before filing any claim, contact us at hello@usenearest.com with a description and what you'd like us to do, and give us 30 days to try to resolve it.",
            "These Terms are governed by the laws of the State of Texas, without regard to conflict-of-law rules. Any dispute that isn't resolved informally will be brought only in the state or federal courts located in Collin County, Texas, and you and Nearest consent to those courts' jurisdiction — except that either party may bring an individual claim in small claims court if it qualifies.",
            "Disputes between Students and Professionals about a service are between them. Nearest may help through Report a problem and our review process, but is not obligated to resolve private disputes.",
          ],
        },
        {
          h: "22. Changes to these Terms",
          p: [
            "We may update these Terms. If a change is material, we'll notify you by email or in the app before it takes effect. Continuing to use the Service after the effective date means you accept the updated Terms. Changes won't apply retroactively to bookings already made.",
          ],
        },
        {
          h: "23. Other terms",
          p: [
            "These Terms and the Privacy Policy are the entire agreement between you and Nearest about the Service. If any part is found unenforceable, the rest stays in effect. Our failure to enforce a provision isn't a waiver. You may not transfer these Terms; we may transfer them in connection with a merger, acquisition or sale of assets.",
          ],
        },
        {
          h: "24. Contact",
          p: [`${ENTITY} (Nearest) • ${ADDRESS} • hello@usenearest.com`],
        },
      ]}
    />
  );
}
