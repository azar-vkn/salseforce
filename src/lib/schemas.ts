import { z } from "zod";

export const BuyerDnaSchema = z.object({
  budget: z.number().min(0).max(100).default(50),
  intent: z.number().min(0).max(100).default(50),
  trust: z.number().min(0).max(100).default(50),
  priceSensitivity: z.number().min(0).max(100).default(50),
  urgency: z.number().min(0).max(100).default(50),
  language: z.string().default("English · Professional & direct"),
  style: z.string().default("Data-driven, values ROI metrics"),
  confidence: z.number().min(0).max(100).default(75),
});

export const LeadSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().min(2, "Name must be at least 2 characters"),
  company: z.string().min(1, "Company is required"),
  initials: z.string().optional(),
  score: z.number().min(0).max(100).default(50),
  stage: z.enum(["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]).default("New"),
  nextAction: z.string().default("Initial contact"),
  emotion: z.enum(["Excited", "Curious", "Hesitant", "Neutral", "Frustrated"]).default("Neutral"),
  status: z.enum(["Replied", "Waiting", "Unread", "Archived"]).default("Unread"),
  value: z.string().default("₹0"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  dna: BuyerDnaSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const MessageSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  from: z.enum(["them", "me", "ai_agent"]),
  text: z.string().min(1, "Message text cannot be empty"),
  time: z.string().default("Just now"),
  channel: z.enum(["whatsapp", "email", "webchat", "sms"]).default("whatsapp"),
  status: z.enum(["sending", "sent", "delivered", "read", "failed"]).default("sent"),
  aiConfidence: z.number().min(0).max(100).optional(),
});

export const ConversationThreadSchema = z.object({
  id: z.string(),
  channel: z.enum(["whatsapp", "email", "webchat", "sms"]).default("whatsapp"),
  messages: z.array(MessageSchema),
  unreadCount: z.number().default(0),
  lastActivity: z.string().optional(),
});

export const TaskSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  title: z.string().min(2, "Task title is required"),
  lead: z.string().min(1, "Associated lead name is required"),
  tag: z.string().default("General"),
  column: z.enum(["today", "tomorrow", "upcoming", "completed"]).default("today"),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const AiRulesSchema = z.object({
  autoReplyEnabled: z.boolean().default(true),
  minConfidenceThreshold: z.number().min(0).max(100).default(85),
  systemPrompt: z.string().default("You are SalesMind AI, an elite enterprise sales executive. Answer customer questions clearly, warmly, and concisely."),
  tone: z.string().default("Professional, warm, value-oriented"),
  prohibitedTopics: z.array(z.string()).default(["unauthorized discounts", "competitor slander"]),
  knowledgeBase: z.string().default("SalesMind AI is a real-time autonomous CRM platform."),
});

export type LeadInput = z.infer<typeof LeadSchema>;
export type TaskInput = z.infer<typeof TaskSchema>;
export type MessageInput = z.infer<typeof MessageSchema>;
export type AiRulesInput = z.infer<typeof AiRulesSchema>;
