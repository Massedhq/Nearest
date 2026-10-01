// Nearest Sales Ambassador Agreement. Reps sign this (checkbox + typed full legal name) BEFORE their
// account can be created. Change REP_AGREEMENT_VERSION whenever the text changes — every signature records
// the version signed. Have counsel review before use.

export const REP_AGREEMENT_VERSION = "2026-10-01";
export const REP_AGREEMENT_TITLE = "Nearest Sales Ambassador Agreement";

const ENTITY = "Nearest";
const ADDRESS = "5729 Lebanon Rd #144605, Frisco, Texas 75034";

export const REP_AGREEMENT: { title: string; body: string[] }[] = [
  {
    title: "1. What this is",
    body: [
      `This Agreement is between ${ENTITY} ("Nearest," "we," "us") and you, the person signing below ("you"). It governs your participation in the Nearest Sales Ambassador Program (the "Program"), in which you may share your Nearest referral links with people who may want to use Nearest.`,
      "The Program is voluntary. You may stop participating at any time. Signing this Agreement does not guarantee you any work, referrals, or payment.",
      "You confirm that you are at least 18 years old, that the name you sign below is your full legal name, and that you are legally able to enter into this Agreement.",
    ],
  },
  {
    title: "2. You are an independent contractor — not an employee",
    body: [
      "You participate as an independent contractor. Nothing in this Agreement or the Program makes you an employee, agent, partner, joint venturer, franchisee, or legal representative of Nearest.",
      "You decide when, where, whether, and how you share your links. Nearest does not set your hours, does not supervise your methods, and does not require any minimum activity.",
      "You have no authority to make any promise, agreement, or statement on Nearest's behalf, or to bind Nearest in any way.",
      "You are not entitled to wages, overtime, benefits, insurance, retirement plans, paid leave, unemployment benefits, workers' compensation, or any other employee benefit from Nearest. You are responsible for your own expenses, equipment, phone, transportation, and costs. Nearest does not reimburse expenses.",
      "If any court, agency, or arbitrator ever decides you should be treated as an employee for any purpose, you agree that you will not receive any benefit or payment beyond what this Agreement expressly provides, to the fullest extent the law allows.",
    ],
  },
  {
    title: "3. Compensation",
    body: [
      "No compensation is guaranteed. Any compensation for the Program is set by Nearest, in its sole discretion, and communicated to you in writing (for example, on your dashboard or by email). Nearest may change, pause, or end any compensation at any time going forward.",
      "A referral counts only if Nearest confirms it qualifies. Referrals that are duplicates, fake, fraudulent, self-referrals (including family members or accounts you control), made through prohibited methods, later cancelled, refunded, or charged back, or that break this Agreement do not qualify. Nearest's records and decision are final.",
      "Payments are made only through Nearest's payment provider (Stripe), and only after you complete its payout setup with accurate information. Nearest is not responsible for delays, holds, fees, or errors caused by the payment provider, your bank, or information you provide.",
      "If Nearest pays you by mistake, or for a referral that later turns out not to qualify, you agree to repay it, and Nearest may deduct it from any future amounts owed to you.",
      "If this Agreement ends for any reason, no further compensation is earned. If it ends because you broke this Agreement, any unpaid amounts are forfeited.",
    ],
  },
  {
    title: "4. Taxes are your responsibility",
    body: [
      "You are solely responsible for reporting and paying all federal, state, and local taxes on anything you receive through the Program, including income and self-employment taxes.",
      "Nearest does not withhold any taxes from payments to you and does not provide tax, legal, or financial advice. Nearest does not issue tax forms or tax paperwork for the Program except where the law specifically requires it.",
      "You agree to provide accurate identity and tax information to Nearest's payment provider when it asks. You will indemnify and hold Nearest harmless from any taxes, penalties, interest, or claims arising from your failure to pay or report taxes.",
    ],
  },
  {
    title: "5. How you must represent Nearest",
    body: [
      "Be honest. Describe Nearest accurately, using only information Nearest has published or approved. Never promise earnings, bookings, prices, results, discounts, or anything Nearest has not offered in writing.",
      "No spam. Do not send bulk, unsolicited, or automated emails, texts, calls, or direct messages. Follow all laws on marketing and messages, including CAN-SPAM and the Telephone Consumer Protection Act (TCPA).",
      "Protect students and minors. Many Nearest students are under 18. Do not seek out, contact, message, meet, or collect information from anyone under 18 for the Program. You may only share your public link in places where adults and families can see it. Never ask anyone for their passwords, ID, school information, or payment details.",
      "No incentives or shortcuts. Do not offer money, gifts, or anything of value for sign-ups unless Nearest approves it in writing. Do not create accounts for other people, sign up yourself or people you control through your link, or use fake names, emails, or devices.",
      "No paid advertising using Nearest's name, logo, or trademarks (including search ads), and no websites, pages, or accounts that look like they belong to Nearest, without written approval.",
      "No harassment, discrimination, false statements about Nearest or its professionals, or illegal activity of any kind while participating.",
    ],
  },
  {
    title: "6. Confidentiality",
    body: [
      "Anything you learn about Nearest that is not public — including business plans, pricing strategy, numbers, partners, professionals' or students' information, and anything in your dashboard — is confidential. You will not share it or use it for anything except the Program. This obligation continues after this Agreement ends.",
    ],
  },
  {
    title: "7. Nearest's name and brand",
    body: [
      "Nearest owns its name, logo, website, app, content, and materials. Nearest gives you a limited, revocable, non-transferable permission to share your referral links and materials Nearest provides, only for the Program. That permission ends immediately when this Agreement ends.",
    ],
  },
  {
    title: "8. Ending the Agreement",
    body: [
      "You or Nearest may end this Agreement at any time, for any reason or no reason, with or without notice. Nearest may also suspend your participation or your links at any time. When it ends, your links stop counting and your dashboard closes.",
    ],
  },
  {
    title: "9. No warranties",
    body: [
      "The Program, your dashboard, and your links are provided \"as is\" and \"as available,\" without any warranty of any kind. Nearest does not promise that the Program will continue, be error-free, or produce any result.",
    ],
  },
  {
    title: "10. Limits on Nearest's liability",
    body: [
      "To the fullest extent the law allows, Nearest and its owners, officers, partners, employees, and agents will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost income, or lost opportunities, arising from this Agreement or the Program.",
      "To the fullest extent the law allows, Nearest's total liability for any claim related to this Agreement or the Program is limited to the amount Nearest actually paid you under the Program in the three (3) months before the claim arose.",
    ],
  },
  {
    title: "11. You protect Nearest",
    body: [
      "You will defend, indemnify, and hold harmless Nearest and its owners, officers, partners, employees, and agents from any claims, losses, damages, fines, penalties, and costs (including reasonable attorneys' fees) arising from: your participation in the Program; anything you say or do; your breach of this Agreement; your violation of any law or anyone's rights; your taxes; and any claim by you or on your behalf that you are an employee of Nearest.",
    ],
  },
  {
    title: "12. Release",
    body: [
      "To the fullest extent the law allows, you release Nearest and its owners, officers, partners, employees, and agents from all claims, known or unknown, arising from or related to the Program, except a claim for compensation that Nearest confirmed in writing as earned and has not paid.",
    ],
  },
  {
    title: "13. Disputes — individual arbitration",
    body: [
      "Before starting any formal dispute, you agree to email support@usenearest.com describing the issue and give Nearest 30 days to try to resolve it.",
      "Any dispute arising from or related to this Agreement or the Program will be resolved by final, binding arbitration on an individual basis under the Commercial Arbitration Rules of the American Arbitration Association, in Collin County, Texas. Either party may instead bring an individual claim in small-claims court. Nearest may also seek a court order to protect its confidential information, name, or brand.",
      "You and Nearest each give up the right to a jury trial and the right to bring or join any class, collective, or representative action. If this waiver is found unenforceable for a claim, that claim will be decided by a court, not an arbitrator.",
      "This Agreement is governed by the laws of the State of Texas and applicable federal law, without regard to conflict-of-law rules. Any court proceeding will be in the state or federal courts located in Collin County, Texas.",
    ],
  },
  {
    title: "14. General terms",
    body: [
      "This Agreement, together with any compensation terms Nearest gives you in writing, is the entire agreement between you and Nearest about the Program and replaces any earlier conversations or promises.",
      "Nearest may update this Agreement. If it does, Nearest will show the new version on your dashboard or email you, and you must accept it to keep participating.",
      "You may not transfer this Agreement or your links to anyone. Nearest may transfer this Agreement.",
      "If any part of this Agreement is found unenforceable, it will be limited to the minimum extent necessary and the rest stays in effect. Nearest's failure to enforce any part is not a waiver. Sections 3 through 7 and 9 through 14 continue after this Agreement ends.",
      "You agree to sign electronically. Checking the box and typing your full legal name below is your electronic signature and has the same effect as a handwritten signature.",
      `Notices to Nearest: support@usenearest.com, ${ADDRESS}.`,
    ],
  },
];
