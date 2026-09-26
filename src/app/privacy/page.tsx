import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacy Policy" };

const ENTITY = "[Company legal name]";
const ADDRESS = "[Mailing address]";

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 2026"
      other={{ href: "/terms", label: "Terms of Service" }}
      intro={[
        `This Privacy Policy explains how ${ENTITY}, doing business as Nearest ("Nearest," "we," "us"), collects, uses, shares and protects personal information when you use usenearest.com and the Nearest app (the "Service"), and the choices and rights you have.`,
        "The short version: we collect what we need to verify accounts, run bookings and payments, and keep people safe. We don't sell your personal information, we don't use it for targeted advertising, and we don't share phone numbers or emails between users.",
      ]}
      sections={[
        {
          h: "1. Information we collect",
          p: [
            "Information you give us:",
            [
              "Account details: first and last name, date of birth, email address, optional mobile number, and password (passwords are handled by our sign-in provider, Clerk; we never see them).",
              "Students: school, graduation year, optional interests and communication preferences (for example, text communication or ASL).",
              "Professionals: business name, profile photo, bio, years of experience, services and prices, hours, city, ZIP code, service address, travel radius, languages and ASL level, portfolio photos, social media and website links, and license information (type, number, state and expiration).",
              "Verification: Students provide a school ID photo and a selfie for review. Professionals verify identity through Stripe Identity (see Section 3).",
              "Bookings and activity: appointments, Model Calls, messages, reviews, ratings, finish-step photos, problem reports, requests for review, favorites and searches within the app.",
              "Payments: payment and payout details are collected and stored by Stripe. Nearest receives limited information such as the amount, date, card brand and last four digits, and payout status — never your full card or bank account number.",
            ],
            "Information collected automatically:",
            [
              "Location: your device's precise location at the moment you check in or report a problem, and — only if you tap Near Me — your approximate location to show distances (see Section 5).",
              "Device and usage information: IP address, browser and device type, pages viewed, and similar technical logs used to run and secure the Service.",
              "Cookies: essential cookies that keep you signed in and secure your session, and a Near Me cookie that stores a rounded location on your device for one day. We don't use advertising cookies.",
            ],
          ],
        },
        {
          h: "2. How we use information",
          p: [
            [
              "Create and manage accounts and verify Students and Professionals.",
              "Show Professionals' profiles, availability, Model Calls and reviews to verified Students.",
              "Process bookings, payments, holds, releases, credits, payouts, memberships and fines.",
              "Confirm check-ins and review problem reports, disputes, no-shows and requests for review.",
              "Send service messages: verification codes, confirmations, reminders, receipts and account notices.",
              "Keep the Service safe: prevent fraud, abuse and violations of our Terms, and enforce account standing rules.",
              "Understand and improve the Service, including which areas need more Professionals or Students (using search activity within the app).",
              "Comply with law, taxes and accounting, and respond to lawful requests.",
            ],
            "We don't use personal information for targeted advertising, and we don't make decisions that produce legal or similarly significant effects about you based solely on automated processing. Account-standing actions such as suspensions follow the published rules in our Terms and can always be reviewed by a person on request.",
          ],
        },
        {
          h: "3. Verification photos and biometric information",
          p: [
            "Students: your school ID photo and selfie are stored privately and can be viewed only by Nearest reviewers to confirm your identity and school. Every view is logged. The photos are permanently deleted as soon as your review is finished (approved or sent back). They are never shown on your profile or to Professionals.",
            "Professionals: identity verification is performed by Stripe Identity, which captures an image of your government ID and a live selfie and may create a record of face geometry to confirm the two match. By starting verification, you consent to this capture and use for identity verification only. Nearest does not receive or store your ID images or any biometric record — only the result (for example, verified or not verified). Stripe retains verification data according to its own privacy policy and legal obligations.",
            "Nearest does not sell, lease or disclose biometric information, and uses verification photos only to verify identity.",
          ],
        },
        {
          h: "4. What other users can see",
          p: [
            [
              "Students see a Professional's business name, photo, portfolio, services and prices, city or distance, hours, languages, ASL level, ratings and reviews, Model Calls, same-day openings, and the social links the Professional added.",
              "A Professional's street address is shown only to a Student with a confirmed booking, starting at 12:00 AM Central Time on the appointment day. For travel appointments, the Student's address is shown to the Professional on the same schedule.",
              "Professionals see a booked Student's first name, last initial, verified-student status, communication preferences, and booking messages.",
              "Reviews show the rating, text and date; finish-step photos appear on a Professional's portfolio only if the Student chooses Yes.",
              "Phone numbers, email addresses, dates of birth, school ID photos and payment details are never shared between users.",
            ],
          ],
        },
        {
          h: "5. Location",
          p: [
            "Nearest asks your device for location only when you choose an action that needs it:",
            [
              "Check-in and Report a problem: we compare your precise location at that moment with the appointment location and store that single reading (distance and accuracy) with the booking so disputes can be reviewed fairly.",
              "Near Me: your device shares its location so we can show distances. A rounded location (about 100 meters) is kept in a cookie on your device for one day. Nearest does not store it.",
            ],
            "We don't track your location in the background. You can turn off location access at any time in your device or browser settings; check-in and on-site reports won't work without it.",
          ],
        },
        {
          h: "6. How we share information",
          p: [
            "We don't sell personal information. We share it only as follows:",
            [
              "Between users, as described in Section 4, to make bookings work.",
              "Service providers who process data for us under contract and only to provide their services: Clerk (sign-in and account security), Stripe (payments, payouts, memberships and identity verification), Neon (database hosting), Vercel (website hosting and photo storage), Resend (email delivery), and the U.S. Census Bureau's address lookup (to turn addresses into map coordinates for check-in; only the address is sent).",
              "For safety and legal reasons: to comply with law or legal process, to protect the rights, property or safety of Nearest, our users or the public, and to investigate fraud or violations of our Terms.",
              "Business changes: if Nearest is involved in a merger, acquisition or sale of assets, information may transfer as part of that transaction, subject to this Policy.",
              "With your direction or consent.",
            ],
          ],
        },
        {
          h: "7. Students under 18",
          p: [
            "Nearest is not intended for children under 13, and we don't knowingly collect personal information from them. If we learn we have, we will delete it.",
            "Students aged 13 to 17 may use Nearest only with a parent's or legal guardian's permission. For these Students we collect only what's needed to verify school enrollment and run bookings, we never use their information for advertising, and we don't sell it.",
            "Parents and guardians may ask to review the information we hold about their minor child, have it corrected or deleted, or close the account, by emailing hello@usenearest.com from a verifiable address. We may need to confirm your identity and relationship to the Student before acting.",
          ],
        },
        {
          h: "8. How long we keep information",
          p: [
            [
              "Student ID photos and selfies: deleted as soon as the review is finished.",
              "Account and profile information: while your account is open, and for a limited period after closure to handle disputes, prevent fraud and meet legal requirements.",
              "Bookings, payments, credits, fines and payout records: as long as needed for accounting, tax and legal requirements (generally up to seven years).",
              "Messages, reviews, problem reports and check-in readings: while the account is open and afterwards as long as reasonably needed for safety, disputes and legal purposes.",
              "Technical logs: for a limited period for security and troubleshooting.",
            ],
          ],
        },
        {
          h: "9. How we protect information",
          p: [
            "We use encryption in transit (HTTPS), access controls, private storage for verification photos, logged access to sensitive records, and reputable providers for sign-in, payments and hosting. No system is perfectly secure; if we learn of a security incident that affects your personal information, we'll notify you and regulators as required by law.",
          ],
        },
        {
          h: "10. Your privacy rights",
          p: [
            "Depending on where you live — including under the Texas Data Privacy and Security Act — you have the right to:",
            [
              "confirm whether we process your personal data and access it;",
              "correct inaccurate personal data;",
              "delete personal data you provided or that we obtained about you;",
              "get a copy of your personal data in a portable format; and",
              "opt out of the sale of personal data, targeted advertising, and profiling in furtherance of decisions that produce legal or similarly significant effects. Nearest doesn't do any of these.",
            ],
            "Nearest processes certain sensitive data — precise location at check-in, and (for minors) personal data of a known child — only with consent or, for minors, parental permission, and only for the purposes described above.",
            "To make a request, email hello@usenearest.com from the email on your account (or have an authorized agent do so with proof of authorization). We'll respond within 45 days, and may extend once by 45 more days when reasonably necessary, telling you why. We won't discriminate against you for exercising your rights. Some information may need to be kept for legal or safety reasons (for example, payment records or an open dispute); we'll tell you if so.",
            "If we decline your request, you can appeal by replying to our decision with \"Appeal\" in the subject line. We'll respond to appeals within 60 days. If your appeal is denied, you may contact the Texas Attorney General at texasattorneygeneral.gov.",
          ],
        },
        {
          h: "11. Your choices",
          p: [
            [
              "Update your profile, communication preferences and interests in the app at any time.",
              "Turn location access on or off in your device settings.",
              "Service emails (verification, bookings, reminders, receipts, account notices) are required to use Nearest. We don't send marketing emails without your consent, and any marketing email will include an unsubscribe link.",
              "Ask us to close your account at hello@usenearest.com. Accounts with upcoming appointments or unpaid amounts must settle those first.",
            ],
          ],
        },
        {
          h: "12. Links to other sites",
          p: ["Profiles may link to a Professional's Instagram, TikTok or website. Those sites are run by others and have their own privacy policies; we're not responsible for their practices."],
        },
        {
          h: "13. Changes to this Policy",
          p: ["We may update this Policy. If a change is material, we'll notify you by email or in the app before it takes effect. The \"Last updated\" date shows when it last changed."],
        },
        {
          h: "14. Contact",
          p: [`${ENTITY} (Nearest) • ${ADDRESS} • hello@usenearest.com`],
        },
      ]}
    />
  );
}
