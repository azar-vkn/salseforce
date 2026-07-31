export type Lead = {
  id: string;
  name: string;
  company: string;
  initials: string;
  score: number;
  stage: "New" | "Qualified" | "Proposal" | "Negotiation" | "Won";
  nextAction: string;
  emotion: "Excited" | "Curious" | "Hesitant" | "Neutral";
  status: "Replied" | "Waiting" | "Unread";
  value: string;
  dna: BuyerDna;
};

export type BuyerDna = {
  budget: number;
  intent: number;
  trust: number;
  priceSensitivity: number;
  urgency: number;
  language: string;
  style: string;
  confidence: number;
};

export const leads: Lead[] = [
  {
    id: "1",
    name: "Aarav Mehta",
    company: "Nimbus Interiors",
    initials: "AM",
    score: 92,
    stage: "Negotiation",
    nextAction: "Send revised quote",
    emotion: "Excited",
    status: "Replied",
    value: "₹8.4L",
    dna: {
      budget: 88,
      intent: 94,
      trust: 81,
      priceSensitivity: 42,
      urgency: 86,
      language: "Hindi + English",
      style: "Direct, quick replies",
      confidence: 91,
    },
  },
  {
    id: "2",
    name: "Sara Kapoor",
    company: "Lumen Studio",
    initials: "SK",
    score: 78,
    stage: "Proposal",
    nextAction: "Book demo call",
    emotion: "Curious",
    status: "Waiting",
    value: "₹3.1L",
    dna: {
      budget: 64,
      intent: 76,
      trust: 70,
      priceSensitivity: 61,
      urgency: 52,
      language: "English",
      style: "Detail oriented",
      confidence: 74,
    },
  },
  {
    id: "3",
    name: "Dev Sharma",
    company: "Orbit Logistics",
    initials: "DS",
    score: 64,
    stage: "Qualified",
    nextAction: "Share case study",
    emotion: "Hesitant",
    status: "Unread",
    value: "₹1.9L",
    dna: {
      budget: 51,
      intent: 58,
      trust: 46,
      priceSensitivity: 79,
      urgency: 38,
      language: "English",
      style: "Cautious, needs proof",
      confidence: 62,
    },
  },
  {
    id: "4",
    name: "Neha Iyer",
    company: "Bright Foods",
    initials: "NI",
    score: 87,
    stage: "Negotiation",
    nextAction: "Call at 4:00 PM",
    emotion: "Excited",
    status: "Replied",
    value: "₹5.6L",
    dna: {
      budget: 82,
      intent: 89,
      trust: 84,
      priceSensitivity: 35,
      urgency: 74,
      language: "English",
      style: "Warm, relationship first",
      confidence: 88,
    },
  },
  {
    id: "5",
    name: "Rohit Verma",
    company: "Sable Ventures",
    initials: "RV",
    score: 55,
    stage: "New",
    nextAction: "Send intro message",
    emotion: "Neutral",
    status: "Unread",
    value: "₹90K",
    dna: {
      budget: 44,
      intent: 49,
      trust: 40,
      priceSensitivity: 68,
      urgency: 30,
      language: "Hindi",
      style: "Short replies",
      confidence: 51,
    },
  },
  {
    id: "6",
    name: "Ishita Rao",
    company: "Peak Realty",
    initials: "IR",
    score: 81,
    stage: "Proposal",
    nextAction: "Follow up on brochure",
    emotion: "Curious",
    status: "Waiting",
    value: "₹4.2L",
    dna: {
      budget: 73,
      intent: 80,
      trust: 68,
      priceSensitivity: 55,
      urgency: 61,
      language: "English",
      style: "Analytical",
      confidence: 77,
    },
  },
];

export const revenueSeries = [
  { month: "Feb", revenue: 18, target: 20 },
  { month: "Mar", revenue: 24, target: 22 },
  { month: "Apr", revenue: 21, target: 24 },
  { month: "May", revenue: 31, target: 26 },
  { month: "Jun", revenue: 28, target: 28 },
  { month: "Jul", revenue: 42, target: 32 },
];

export const sourceSeries = [
  { name: "WhatsApp", value: 42 },
  { name: "Referral", value: 24 },
  { name: "Website", value: 19 },
  { name: "Ads", value: 15 },
];

export const funnelSeries = [
  { stage: "Leads", value: 480 },
  { stage: "Qualified", value: 260 },
  { stage: "Proposal", value: 140 },
  { stage: "Negotiation", value: 72 },
  { stage: "Won", value: 38 },
];

export type Task = {
  id: string;
  title: string;
  lead: string;
  tag: string;
  column: "today" | "tomorrow" | "upcoming" | "completed";
};

export const initialTasks: Task[] = [
  { id: "t1", title: "Call about revised pricing", lead: "Aarav Mehta", tag: "Call", column: "today" },
  { id: "t2", title: "Send interior brochure", lead: "Ishita Rao", tag: "Send", column: "today" },
  { id: "t3", title: "Demo walkthrough", lead: "Sara Kapoor", tag: "Meeting", column: "tomorrow" },
  { id: "t4", title: "Share ROI case study", lead: "Dev Sharma", tag: "Send", column: "tomorrow" },
  { id: "t5", title: "Quarterly check-in", lead: "Neha Iyer", tag: "Call", column: "upcoming" },
  { id: "t6", title: "Renewal proposal draft", lead: "Peak Realty", tag: "Doc", column: "upcoming" },
  { id: "t7", title: "Onboarding kickoff", lead: "Bright Foods", tag: "Meeting", column: "completed" },
];

export type Message = { id: string; from: "them" | "me"; text: string; time: string };

export const conversationThreads: Record<string, Message[]> = {
  "1": [
    { id: "m1", from: "them", text: "Hi! Can you share the final pricing for 40 units?", time: "09:12" },
    { id: "m2", from: "me", text: "Absolutely — sending a revised sheet in a moment.", time: "09:14" },
    { id: "m3", from: "them", text: "If the discount works we can close this week.", time: "09:20" },
  ],
  "2": [
    { id: "m1", from: "them", text: "The proposal looks good. Can we do a walkthrough?", time: "Yesterday" },
    { id: "m2", from: "me", text: "Sure, does Thursday 11 AM work?", time: "Yesterday" },
  ],
  "3": [{ id: "m1", from: "them", text: "We're comparing 3 vendors right now.", time: "Mon" }],
  "4": [
    { id: "m1", from: "them", text: "Team loved the demo 🙌", time: "08:02" },
    { id: "m2", from: "me", text: "Amazing! I'll send the agreement today.", time: "08:05" },
  ],
  "5": [{ id: "m1", from: "them", text: "Saw your ad. What's the starting price?", time: "Tue" }],
  "6": [{ id: "m1", from: "them", text: "Brochure received, reviewing internally.", time: "Wed" }],
};

export const aiSuggestions = [
  "Who should I call today?",
  "Which lead is closest to purchasing?",
  "Summarize today's sales.",
  "Create a WhatsApp campaign.",
  "Generate follow-up messages.",
  "Analyze objections.",
];

export function aiReply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("call"))
    return "**Call Aarav Mehta first.** Intent 94, urgency 86, and he asked about final pricing 2 hours ago. Then Neha Iyer — her team already approved the demo.\n\nSuggested opener: *\"Hi Aarav, I've reworked the numbers for 40 units — got 3 minutes?\"*";
  if (p.includes("closest") || p.includes("purchas"))
    return "**Aarav Mehta (Nimbus Interiors)** is closest — 92 lead score, negotiation stage, ₹8.4L expected. Blocker: a ~6% discount ask. Offer a 12-month lock instead of a price cut.";
  if (p.includes("summar"))
    return "**Today:** 8 hot leads, 3 meetings, 12 follow-ups. Pipeline moved ₹2.1L forward, 2 deals entered negotiation, and reply time improved to 7 minutes.";
  if (p.includes("campaign") || p.includes("broadcast"))
    return "**WhatsApp campaign draft — \"Monsoon Upgrade\"**\nAudience: 128 warm leads, last active <30 days.\nMessage: *\"Hi {name}, we're opening 20 upgrade slots this month with free installation. Want me to hold one for you?\"*\nBest send window: Thu 11:00 AM.";
  if (p.includes("follow"))
    return "3 follow-ups ready:\n• **Sara Kapoor** — *\"Thursday 11 AM still good for the walkthrough?\"*\n• **Dev Sharma** — send the logistics ROI case study.\n• **Ishita Rao** — *\"Any questions on the brochure? Happy to do a quick call.\"*";
  if (p.includes("objection"))
    return "**Top objections this month:** price (41%), timing (26%), internal approval (19%). Deals where you sent proof within 24h closed 2.3× more often.";
  return "Here's what I'd do next: prioritise the 3 negotiation-stage leads (₹18.2L combined), clear the 12 pending follow-ups before noon, and send the Thursday campaign. Ask me for a specific lead and I'll draft the message.";
}
