/**
 * Field team training (2026-11-23): step-by-step lessons for owners' assistants. Platform steps follow each platform's
 * own help pages (linked in `source`) as of November 2026 — menus move, so each lesson links the official page too.
 * Assistants PREPARE ads and never enter a card or publish: the owner reviews and launches. Progress: field_training.
 */
export type Lesson = { id: string; title: string; why: string; source?: { label: string; url: string }[]; steps: string[] };

export const LESSONS: Lesson[] = [
  {
    id: "first-week", title: "Your first week", why: "How the work fits together, so every day counts.",
    steps: [
      "Open Today every morning. Your plan is there by your owner's send time — do the tasks in order.",
      "Tap a task, then Start working on it. Your owner sees that you started.",
      "Keep this page open while you work: your time worked is counted while the Field team page is open and in front.",
      "Finish every task with a report: each call or visit, who you talked to, their title, phone or email, the address, the outcome and the next step.",
      "If you need your owner to do something (pay, sign, show up, decide), use Send to owner with one clear sentence.",
      "Check Organizations and Upcoming before you call — never call the same place twice in one day.",
    ],
  },
  {
    id: "calling", title: "Calling organizations", why: "Most cards reach students through youth programs.",
    steps: [
      "Find places in your area: search Google Maps for \"youth program\", \"Boys & Girls Club\", \"YMCA\", \"rec center\", \"teen center\", \"church youth ministry\" + the city.",
      "Call the main line and ask: \"Who runs your teen or youth program?\" Ask for that person by name and title.",
      "Say: \"I'm with Nearest. We have free GRANTED cards that help teens 13 and up get discounted beauty and self-care services. Could your program hand out 10 to the teens you serve?\"",
      "If yes, book the drop-off: day, time, who receives them, which door. Book it on the organization's page in Nearest.",
      "Ask about space: \"Could we host a free sign-up table for beauty professionals here? Is the space free, or is there a fee?\"",
      "No answer: leave a short voicemail with your name and email, and set a call-back as the next step.",
      "Log every call in your task report the same day, even voicemails.",
    ],
  },
  {
    id: "schools", title: "Schools & counselors", why: "Counselors can list Nearest as a student resource.",
    steps: [
      "Call the school's main office and ask for the counseling office (or the CTE / cosmetology program lead).",
      "Explain: \"Nearest is a free resource students can use to find beauty and self-care services at student prices. We're not selling a service to the school and don't need a contract or bid — we'd like to be listed as a student resource.\"",
      "Ask what their process is for resource lists, flyers or newsletters, and who approves it.",
      "Offer cards for the counseling office to hand out, if they allow it.",
      "Never contact students directly. Everything goes through staff.",
      "Log the counselor's name, title, email and what they said. If they want to talk to your owner, use Send to owner.",
    ],
  },
  {
    id: "popups", title: "Finding pop-ups", why: "Pop-ups bring professionals to sign up in person.",
    steps: [
      "Search Facebook Events, Eventbrite and city calendars for \"vendor\", \"market\", \"pop-up\", \"expo\" + the city or county.",
      "For each event write down: name, date, time, address, host, the listing link and the vendor fee.",
      "Message or call the host: ask about table size, what's provided (table, chairs, power) and the deadline to sign up.",
      "Add it under Pop-ups as Someone else's event with the vendor fee. Anything that costs money goes to your owner to pay.",
      "For our own pop-up at an organization: ask if the space is free or paid, the dates it's open, set-up time and parking. Add it as Our own pop-up.",
      "When it's confirmed, set it to Confirmed so its public page turns on, and share the link.",
    ],
  },
  {
    id: "educators", title: "Video educators", why: "Paid step-by-step training videos for Learn at Nearest.",
    steps: [
      "Search Instagram, TikTok, Facebook and YouTube for educators who post clear step-by-step tutorials in the service you need (lashes, braids, nails, barber…).",
      "Check their work: clear video, good lighting, they explain each step, real results.",
      "Message or call using the script on the Video educators page. Ask for a step-by-step video, start to finish, showing every product they use, and their price.",
      "Log them: name, platform and handle, phone, email, what they teach, when you spoke, what you asked, their price.",
      "When a price comes in, set Price in — your owner approves it, counters or passes.",
      "Once approved, tap Send contract, fill in their details and send. They sign from their email and upload the video there.",
    ],
  },
  {
    id: "meta", title: "Meta Ads (Facebook & Instagram)", why: "Prepare campaigns for your owner to approve and launch.",
    source: [{ label: "Meta Business Help Center", url: "https://www.facebook.com/business/help" }, { label: "Create a Meta Pixel", url: "https://www.facebook.com/business/help/952192354843755" }],
    steps: [
      "Get access: your owner adds you to the Nearest business in Meta Business Suite (Settings → People) with access to the ad account and the Facebook Page.",
      "Pixel: in Events Manager → Data sources, find the Nearest pixel and copy its ID (15–16 digits). If there isn't one: Connect data sources → Web → Meta Pixel → name it → Create. Paste the ID in Field team → Ads → Tracking (owner's team only).",
      "In Ads Manager, click Create. Choose the objective — Traffic or Leads for votes and sign-ups.",
      "Name the campaign exactly like the campaign name in your Nearest ad link (for example north-dfw), so votes are matched to it.",
      "Ad set: set the locations to your owner's area cities only, ages 18 and up, and leave placements on Advantage+ unless your owner asks otherwise.",
      "Budget and schedule: type the daily or total budget and dates from your Nearest ad draft.",
      "Ad: add the image or video, the headline and the ad text, and paste the full Nearest ad link as the website URL.",
      "Preview it on Feed, Stories and Reels. Fix anything cut off.",
      "Do NOT publish or add a card. Leave it as a draft and tap Send to owner for approval on the Nearest ad draft.",
    ],
  },
  {
    id: "tiktok", title: "TikTok Ads", why: "Prepare TikTok campaigns for approval.",
    source: [{ label: "TikTok: set up a campaign", url: "https://ads.tiktok.com/help/article/campaign-set-up" }, { label: "TikTok: create an ad", url: "https://ads.tiktok.com/help/article/ad-set-up" }, { label: "TikTok: set up the Pixel", url: "https://ads.tiktok.com/help/article/get-started-pixel" }],
    steps: [
      "Get access: your owner adds you to the Nearest TikTok Ads Manager account.",
      "Pixel: Tools → Events Manager → Connect data source → Web, enter usenearest.com, choose Manual setup. Copy the Pixel ID and paste it in Field team → Ads → Tracking (owner's team only).",
      "Click Create ad (or Campaign → Create). Choose Traffic as the objective and Manual campaign.",
      "Name the campaign like the campaign name in your Nearest ad link and set the budget from the draft. TikTok saves drafts automatically.",
      "Ad group: placements, then audience — your owner's area cities only, ages 18 and up — then budget, schedule and optimization.",
      "Ad: name it, choose the identity, upload the video, add the text and call to action, and paste the full Nearest ad link as the URL.",
      "Use the preview to check how it looks.",
      "Do NOT submit or add payment. Leave the draft and send the Nearest ad draft to your owner for approval.",
    ],
  },
  {
    id: "google", title: "Google Ads", why: "Search ads for people already looking for beauty services.",
    source: [{ label: "Google: create a Search campaign", url: "https://support.google.com/google-ads/answer/9510373" }, { label: "Google: set up web conversions", url: "https://support.google.com/google-ads/answer/12216226" }],
    steps: [
      "Get access: your owner adds you to the Nearest Google Ads account (Admin → Access and security) as Standard access.",
      "Conversion: Goals → Summary → + Create conversion action → Conversions on a website → usenearest.com/vote. Copy the conversion ID (AW-…) and label into Field team → Ads → Tracking (owner's team only).",
      "Campaigns → + New campaign. Choose Website traffic (or Leads), then campaign type Search. A conversion goal is required.",
      "Name the campaign like the campaign name in your Nearest ad link.",
      "Settings: Google Search only (untick search partners and Display), locations = your owner's area cities, language English.",
      "Budget: the daily budget from the draft; bidding: Clicks to start.",
      "Ad group: standard ad group with keywords like \"lash extensions Frisco\", \"braids near me\", \"student nail deals\".",
      "Ad: final URL = the full Nearest Google ad link, then up to 15 headlines and 4 descriptions.",
      "Stop at payment. Send the Nearest ad draft to your owner — they finish billing and publish.",
    ],
  },
  {
    id: "trends", title: "Google Trends", why: "See which services people near you search for, to show your owner.",
    source: [{ label: "Google Trends: compare terms", url: "https://support.google.com/trends/answer/4359550" }, { label: "Google Trends: results by region", url: "https://support.google.com/trends/answer/4355212" }],
    steps: [
      "Open trends.google.com and search a service, for example lash extensions.",
      "Set the location to United States → Texas, and the time to Past 12 months.",
      "In Compare, add up to 4 more services (braids, gel nails, barber, eyebrow threading) — keep the same location and time for all.",
      "Scroll to Interest by subregion and switch to Metro: find Dallas–Ft. Worth.",
      "Open Related queries → Rising to see what's growing (for example \"knotless braids near me\").",
      "Write a short report in your task: the top 3 services, the 3 rising searches, and one idea for an ad or pop-up. Attach a screenshot link.",
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) ?? null;
