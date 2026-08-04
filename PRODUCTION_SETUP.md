# SalesMind AI — Production Deployment & Realtime Configuration Guide

This guide details the complete configuration required to run **SalesMind AI** in a high-scale production environment with **Supabase PostgreSQL Realtime**, **Google Gemini 2.0 AI**, and **Omnichannel Inbound Webhooks** (WhatsApp, Email, Webchat).

---

## 1. Architecture Overview

SalesMind AI features a **Dual-Mode Enterprise Architecture**:
1. **Production Mode (Supabase + Gemini 2.0)**:
   - Full PostgreSQL with Row Level Security (RLS) and multi-tenancy.
   - Postgres WAL Change Data Capture (Realtime Broadcast & Presence).
   - Gemini 2.0 Flash / Pro LLM for sub-second query resolution.
2. **Interactive Local Engine Mode (Zero-Config / Demo)**:
   - Instant local storage persistence with `BroadcastChannel` sub-second multi-tab sync.
   - Intelligent local sales battlecard reasoning engine.

---

## 2. Supabase Setup (Database & Realtime)

### Step 1: Create a Supabase Project
1. Go to [database.new](https://database.new) and create a new project.
2. Note your **Project URL** and **Anon Public API Key** from **Project Settings → API**.

### Step 2: Run Database Migrations
1. Open the **SQL Editor** in your Supabase Dashboard.
2. Copy and paste the entire contents of [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql).
3. Click **Run**.
4. This will create:
   - Tables: `organizations`, `profiles`, `leads`, `buyer_dna`, `conversations`, `messages`, `tasks`, `ai_agent_rules`, `audit_logs`.
   - Automated Triggers: Timestamp update triggers, Dynamic Lead Score recalculation based on weighted Buyer DNA.
   - Realtime Publication: Enables PostgreSQL Replication for `leads`, `messages`, `tasks`, `buyer_dna`, `ai_agent_rules`.
   - Row Level Security (RLS) policies for multi-tenant tenant isolation.

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env.local` (or configure in your cloud host):

```env
# ── Supabase Credentials ──────────────────────────────────────────
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── AI LLM Engines (Gemini or OpenRouter) ─────────────────────────
# Get your key at: https://aistudio.google.com/app/apikey
VITE_GEMINI_API_KEY=AIzaSy...

# Optional alternative: OpenRouter API Key
VITE_OPENROUTER_API_KEY=sk-or-v1-...
```

---

## 4. Omnichannel Inbound Webhook (WhatsApp Cloud API)

To route incoming customer messages from WhatsApp or Email directly into SalesMind AI:

1. **Endpoint**: `https://your-domain.com/api/webhooks/inbound`
2. **Webhook Payload Format**:
```json
{
  "channel": "whatsapp",
  "lead": {
    "name": "Rohan Verma",
    "phone": "+91 98765 43210",
    "company": "Apex Global"
  },
  "message": {
    "text": "What are your enterprise pricing plans and SLA guarantees?",
    "timestamp": "2026-08-03T18:30:00Z"
  }
}
```
3. **Autonomous Handling**:
   - The AI Agent will compute a confidence score against your customized AI Knowledge Base.
   - If confidence $\ge$ threshold (default 85%), it automatically replies on the channel and updates the lead's Buyer DNA (Intent, Urgency, Budget).
   - If confidence $<$ threshold, it generates an AI Draft Card in the CRM for rep review.

---

## 5. Local Testing & Verification

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 6. Cloud Deployment

### Deploying to Cloudflare Pages / Workers
```bash
npm run build
npx wrangler pages deploy .output/public
```

### Deploying to Vercel / Netlify
- **Build Command**: `npm run build`
- **Output Directory**: `.output/public`
- **Environment Variables**: Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`.
