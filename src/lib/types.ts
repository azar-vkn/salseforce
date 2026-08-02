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
  phone?: string;
  whatsapp?: string;
  email?: string;
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

export type Task = {
  id: string;
  title: string;
  lead: string;
  tag: string;
  column: "today" | "tomorrow" | "upcoming" | "completed";
};

export type Message = { id: string; from: "them" | "me"; text: string; time: string };

export type ConversationThread = {
  id: string;
  messages: Message[];
};
