-- ==============================================================================
-- SalesMind AI Enterprise CRM — Production Database Migration
-- Version: 1.0.0
-- Database: PostgreSQL (Supabase)
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enumeration Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales_rep', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_stage AS ENUM ('New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_emotion AS ENUM ('Excited', 'Curious', 'Hesitant', 'Neutral', 'Frustrated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('Replied', 'Waiting', 'Unread', 'Archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE channel_type AS ENUM ('whatsapp', 'email', 'webchat', 'sms', 'phone');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_sender AS ENUM ('me', 'them', 'ai_agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('sending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_column AS ENUM ('today', 'tomorrow', 'upcoming', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. Core Multi-Tenant Tables
-- ==============================================================================

-- Organizations (Tenant isolation boundary)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'enterprise',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (Users within Organizations)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'sales_rep',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    initials TEXT,
    score INT NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
    stage lead_stage NOT NULL DEFAULT 'New',
    next_action TEXT,
    emotion lead_emotion NOT NULL DEFAULT 'Neutral',
    status lead_status NOT NULL DEFAULT 'Unread',
    value TEXT NOT NULL DEFAULT '₹0',
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Buyer DNA (Psychographic & purchasing parameters for each lead)
CREATE TABLE IF NOT EXISTS public.buyer_dna (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID UNIQUE NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    budget INT NOT NULL DEFAULT 50 CHECK (budget >= 0 AND budget <= 100),
    intent INT NOT NULL DEFAULT 50 CHECK (intent >= 0 AND intent <= 100),
    trust INT NOT NULL DEFAULT 50 CHECK (trust >= 0 AND trust <= 100),
    price_sensitivity INT NOT NULL DEFAULT 50 CHECK (price_sensitivity >= 0 AND price_sensitivity <= 100),
    urgency INT NOT NULL DEFAULT 50 CHECK (urgency >= 0 AND urgency <= 100),
    language TEXT NOT NULL DEFAULT 'English · Professional & direct',
    style TEXT NOT NULL DEFAULT 'Data-driven, values ROI metrics',
    confidence INT NOT NULL DEFAULT 75 CHECK (confidence >= 0 AND confidence <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations (Threads linked to leads)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    channel channel_type NOT NULL DEFAULT 'whatsapp',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages (Omnichannel message stream)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    from_type message_sender NOT NULL,
    text TEXT NOT NULL,
    channel channel_type NOT NULL DEFAULT 'whatsapp',
    status message_status NOT NULL DEFAULT 'sent',
    ai_confidence INT CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks (Kanban items linked to leads and reps)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lead_name TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'General',
    column_type task_column NOT NULL DEFAULT 'today',
    due_date TIMESTAMPTZ,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Agent Rules & Configuration per Organization
CREATE TABLE IF NOT EXISTS public.ai_agent_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    auto_reply_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    min_confidence_threshold INT NOT NULL DEFAULT 85 CHECK (min_confidence_threshold >= 0 AND min_confidence_threshold <= 100),
    system_prompt TEXT NOT NULL DEFAULT 'You are SalesMind AI, an elite enterprise sales executive. Answer customer questions clearly, warmly, and concisely. Keep responses under 3 sentences and focus on driving value.',
    tone TEXT NOT NULL DEFAULT 'Professional, warm, value-oriented',
    prohibited_topics TEXT[] DEFAULT ARRAY['unauthorized discounts', 'competitor slandering', 'internal operational details'],
    knowledge_base TEXT DEFAULT 'SalesMind AI is a real-time autonomous CRM with AI lead scoring, Buyer DNA analysis, and omnichannel WhatsApp/Email messaging.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs (Compliance and change tracking)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. High-Performance Indexes
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_org_stage ON public.leads (org_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_buyer_dna_lead ON public.buyer_dna (lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_lead ON public.conversations (org_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON public.messages (lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_col ON public.tasks (org_id, column_type);

-- ==============================================================================
-- 5. Helper Functions & Realtime Triggers
-- ==============================================================================

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS set_orgs_updated_at ON public.organizations;
CREATE TRIGGER set_orgs_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_dna_updated_at ON public.buyer_dna;
CREATE TRIGGER set_dna_updated_at BEFORE UPDATE ON public.buyer_dna FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_ai_rules_updated_at ON public.ai_agent_rules;
CREATE TRIGGER set_ai_rules_updated_at BEFORE UPDATE ON public.ai_agent_rules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Lead Score Auto-calculation Trigger from Buyer DNA
CREATE OR REPLACE FUNCTION public.recalculate_lead_score()
RETURNS TRIGGER AS $$
DECLARE
    calculated_score INT;
BEGIN
    -- Weighted Formula: Intent (40%) + Budget (30%) + Urgency (20%) + Trust (10%)
    calculated_score := ROUND((NEW.intent * 0.4) + (NEW.budget * 0.3) + (NEW.urgency * 0.2) + (NEW.trust * 0.1));
    
    UPDATE public.leads
    SET score = GREATEST(1, LEAST(100, calculated_score))
    WHERE id = NEW.lead_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalculate_lead_score ON public.buyer_dna;
CREATE TRIGGER trigger_recalculate_lead_score AFTER INSERT OR UPDATE ON public.buyer_dna FOR EACH ROW EXECUTE FUNCTION public.recalculate_lead_score();

-- Auto-create Buyer DNA and Conversation when a new lead is inserted
CREATE OR REPLACE FUNCTION public.handle_lead_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate Initials if empty
    IF NEW.initials IS NULL OR NEW.initials = '' THEN
        NEW.initials = UPPER(SUBSTRING(NEW.name FROM 1 FOR 2));
    END IF;

    -- Create default Buyer DNA
    INSERT INTO public.buyer_dna (lead_id, budget, intent, trust, price_sensitivity, urgency, confidence)
    VALUES (NEW.id, 70, 75, 70, 50, 65, 80)
    ON CONFLICT (lead_id) DO NOTHING;

    -- Create default WhatsApp conversation thread
    INSERT INTO public.conversations (org_id, lead_id, channel)
    VALUES (NEW.org_id, NEW.id, 'whatsapp')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_lead_creation ON public.leads;
CREATE TRIGGER trigger_handle_lead_creation AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_lead_creation();

-- ==============================================================================
-- 6. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper to get authenticated user's organization ID
CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID AS $$
    SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: Users can view members of their organization and update their own profile
CREATE POLICY "Users can view org profiles" ON public.profiles
    FOR SELECT USING (org_id = public.get_auth_org_id());

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Leads: Org members can access and manage leads
CREATE POLICY "Org members can read leads" ON public.leads
    FOR SELECT USING (org_id = public.get_auth_org_id());

CREATE POLICY "Org members can insert leads" ON public.leads
    FOR INSERT WITH CHECK (org_id = public.get_auth_org_id());

CREATE POLICY "Org members can update leads" ON public.leads
    FOR UPDATE USING (org_id = public.get_auth_org_id());

CREATE POLICY "Org members can delete leads" ON public.leads
    FOR DELETE USING (org_id = public.get_auth_org_id());

-- Buyer DNA: Accessible through lead's organization
CREATE POLICY "Org members can view buyer DNA" ON public.buyer_dna
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.leads WHERE leads.id = buyer_dna.lead_id AND leads.org_id = public.get_auth_org_id()
    ));

CREATE POLICY "Org members can update buyer DNA" ON public.buyer_dna
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.leads WHERE leads.id = buyer_dna.lead_id AND leads.org_id = public.get_auth_org_id()
    ));

-- Conversations & Messages: Accessible by Org members
CREATE POLICY "Org members can view conversations" ON public.conversations
    FOR ALL USING (org_id = public.get_auth_org_id());

CREATE POLICY "Org members can view messages" ON public.messages
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.conversations WHERE conversations.id = messages.conversation_id AND conversations.org_id = public.get_auth_org_id()
    ));

-- Tasks: Org members can manage tasks
CREATE POLICY "Org members can manage tasks" ON public.tasks
    FOR ALL USING (org_id = public.get_auth_org_id());

-- AI Agent Rules: Org members can read rules; admins can update
CREATE POLICY "Org members can read AI rules" ON public.ai_agent_rules
    FOR SELECT USING (org_id = public.get_auth_org_id());

CREATE POLICY "Org admins can update AI rules" ON public.ai_agent_rules
    FOR ALL USING (
        org_id = public.get_auth_org_id() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- Audit Logs
CREATE POLICY "Org members can view audit logs" ON public.audit_logs
    FOR SELECT USING (org_id = public.get_auth_org_id());

-- ==============================================================================
-- 7. Realtime Publication Setup
-- ==============================================================================

-- Enable Realtime broadcasting for key tables
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;
