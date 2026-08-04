export type ChannelType = "whatsapp" | "email" | "webchat" | "sms" | "phone";
export type MessageSender = "them" | "me" | "ai_agent";
export type MessageDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";

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

export type Lead = {
  id: string;
  name: string;
  company: string;
  initials: string;
  score: number;
  stage: "New" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
  nextAction: string;
  emotion: "Excited" | "Curious" | "Hesitant" | "Neutral" | "Frustrated";
  status: "Replied" | "Waiting" | "Unread" | "Archived";
  value: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  dna: BuyerDna;
  createdAt?: string;
  updatedAt?: string;
};

export type Task = {
  id: string;
  title: string;
  lead: string;
  tag: string;
  column: "today" | "tomorrow" | "upcoming" | "completed";
  dueDate?: string;
  priority?: "low" | "medium" | "high" | "urgent";
};

export type Message = {
  id: string;
  from: MessageSender;
  text: string;
  time: string;
  channel?: ChannelType;
  status?: MessageDeliveryStatus;
  aiConfidence?: number;
};

export type ConversationThread = {
  id: string;
  channel?: ChannelType;
  messages: Message[];
  unreadCount?: number;
  lastActivity?: string;
};

export type AiAgentRule = {
  id?: string;
  autoReplyEnabled: boolean;
  minConfidenceThreshold: number;
  systemPrompt: string;
  tone: string;
  prohibitedTopics: string[];
  knowledgeBase: string;
};

export type RealtimePresenceState = {
  userId: string;
  userName: string;
  avatarUrl?: string;
  activeLeadId?: string;
  isTypingInLeadId?: string;
  lastActive: string;
};
