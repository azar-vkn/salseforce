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
  autoReply?: boolean;
  phone?: string;
  whatsapp?: string;
  email?: string;
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

// ── Call Autopilot Types ───────────────────────────────────────────
export type CallDirection = "INBOUND" | "OUTBOUND";
export type CallStatus = "RINGING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "MISSED" | "TRANSFERRED";

export type CallTranscriptItem = {
  id?: string;
  speaker: "AI" | "CUSTOMER" | "HUMAN";
  text: string;
  timestamp: string;
};

export type CallAiAnalysis = {
  callId: string;
  intentScore?: number;
  budgetSignal?: number;
  trustSignal?: number;
  priceSensitivity?: number;
  urgencySignal?: number;
  purchaseProbability?: number;
  objections?: string[];
  requirements?: string[];
  detectedDealChanges?: string;
  recommendedNextAction?: string;
  confidence?: number;
  summary?: string;
};

export type CallRecord = {
  id: string;
  contactId?: string;
  leadId: string;
  dealId?: string;
  direction: CallDirection;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  duration: number; // seconds
  provider: string;
  providerCallId?: string;
  aiAgentId?: string;
  recordingUrl?: string;
  transcriptId?: string;
  summary?: string;
  outcome?: string;
  humanHandoff: boolean;
  createdAt: string;
  transcripts?: CallTranscriptItem[];
  analysis?: CallAiAnalysis;
};

export type CallAutopilotSettings = {
  id?: string;
  enabled: boolean; // Master switch: ON/OFF
  
  // Incoming Calls
  incomingEnabled: boolean;
  identifyCustomers: boolean;
  loadBuyerDna: boolean;
  loadActiveDeals: boolean;
  askQualification: boolean;
  updateBuyerDna: boolean;
  generateSummary: boolean;
  createFollowUp: boolean;

  // Outbound Calls
  outboundEnabled: boolean;
  dealFollowUp: boolean;
  dealConfirmation: boolean;
  leadQualification: boolean;
  appointmentConfirmation: boolean;

  // AI Behavior
  usePreviousConversations: boolean;
  useBuyerDna: boolean;
  useDealInformation: boolean;
  detectObjections: boolean;
  detectPurchaseIntent: boolean;
  detectRequirements: boolean;
  recommendNextAction: boolean;

  // Human Handoff Triggers
  transferOnCustomerRequest: boolean;
  transferOnLowConfidence: boolean;
  minConfidenceThreshold: number; // e.g. 75%
  transferOnComplexNegotiation: boolean;
  transferOnFrustration: boolean;

  // Recording & Compliance
  storeTranscript: boolean;
  storeSummary: boolean;
  storeAnalysis: boolean;
  storeRecordingMetadata: boolean;
  aiDisclosure: boolean;
  callRecordingNotice: boolean;
  recordingEnabled: boolean;
  retentionDays: number;

  // Telephony Provider Configuration
  provider: "vapi" | "twilio" | "telnyx" | "vonage" | "mock";
  phoneNumber?: string;
  accountId?: string;
};

// ── Central CRM AI Brain Types ─────────────────────────────────────
export type KnowledgeType = 
  | "company"
  | "service"
  | "product"
  | "pricing"
  | "offer"
  | "policy"
  | "faq"
  | "business_rule"
  | "document";

export type KnowledgeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface KnowledgeItem {
  id: string;
  orgId?: string;
  type: KnowledgeType;
  category: string;
  title: string;
  content: Record<string, any> | string;
  status: KnowledgeStatus;
  version: number;
  effectiveDate: string;
  sourceType: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  orgId?: string;
  title: string;
  fileType: string;
  fileUrl?: string;
  rawContent: string;
  status: KnowledgeStatus;
  version: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId?: string;
  itemId?: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface BusinessRuleItem {
  id: string;
  orgId?: string;
  ruleType: "do" | "dont" | "escalate" | "confidential";
  ruleText: string;
  priority: number;
  status: KnowledgeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UnknownQuestion {
  id: string;
  orgId?: string;
  question: string;
  customerName?: string;
  leadId?: string;
  channel: string;
  confidence: number;
  status: "UNANSWERED" | "RESOLVED" | "ARCHIVED";
  approvedAnswer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiBrainStats {
  knowledgeItemsCount: number;
  servicesCount: number;
  productsCount: number;
  faqsCount: number;
  policiesCount: number;
  documentsCount: number;
  businessRulesCount: number;
  status: "Ready" | "Syncing" | "Offline";
  lastUpdated: string;
  knowledgeCoverage: number; // e.g. 96%
  questionsAnswered: number;
  unknownQuestionsCount: number;
  humanEscalations: number;
}

// ── Bolna Voice AI Call Types ──────────────────────────────────────
export type BolnaCallDirection = "outbound" | "inbound";
export type BolnaCallStatus = "initiated" | "scheduled" | "queued" | "in-progress" | "completed" | "failed";

export type BolnaCallRecord = {
  id: string;
  lead_id?: string | null;
  bolna_execution_id?: string;
  direction: BolnaCallDirection;
  status: BolnaCallStatus;
  transcript?: string | null;
  summary?: string | null;
  extracted_data?: Record<string, any> | null;
  recording_url?: string | null;
  created_at: string;
  updated_at: string;
};

// ── Role-Based Access Control (RBAC) Types ───────────────────────────
export type UserRole = "admin" | "salesperson";

export type UserProfile = {
  id: string;
  org_id?: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  status?: "active" | "invited";
  isPrimaryAdmin?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RolePermissions = {
  canManageSettings: boolean;
  canManageApiKeys: boolean;
  canManageTeam: boolean;
  canEditAiBrain: boolean;
  canDeleteLeads: boolean;
  canExportData: boolean;
  canAccessConversations: boolean;
  canAccessCallAutopilot: boolean;
  canAccessTasks: boolean;
  canAccessLeads: boolean;
};

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canManageSettings: true,
    canManageApiKeys: true,
    canManageTeam: true,
    canEditAiBrain: true,
    canDeleteLeads: true,
    canExportData: true,
    canAccessConversations: true,
    canAccessCallAutopilot: true,
    canAccessTasks: true,
    canAccessLeads: true,
  },
  salesperson: {
    canManageSettings: false,
    canManageApiKeys: false,
    canManageTeam: false,
    canEditAiBrain: false,
    canDeleteLeads: false,
    canExportData: false,
    canAccessConversations: true,
    canAccessCallAutopilot: true,
    canAccessTasks: true,
    canAccessLeads: true,
  },
};
