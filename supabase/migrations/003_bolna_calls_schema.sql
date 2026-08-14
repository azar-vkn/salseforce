-- ==============================================================================
-- SalesMind AI — Bolna Voice AI Call Tracking Schema
-- Migration: 003_bolna_calls_schema.sql
-- ==============================================================================

-- 1. Create the `calls` table for Bolna call tracking
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    bolna_execution_id TEXT UNIQUE,
    direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'scheduled', 'queued', 'in-progress', 'completed', 'failed')),
    transcript TEXT,
    summary TEXT,
    extracted_data JSONB,
    recording_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create the `call_tasks` table for scheduled follow-ups / booked slots
CREATE TABLE IF NOT EXISTS public.call_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'follow_up',
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_calls_bolna_execution_id ON public.calls (bolna_execution_id);
CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON public.calls (lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls (status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON public.calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_tasks_lead_id ON public.call_tasks (lead_id);
CREATE INDEX IF NOT EXISTS idx_call_tasks_due_at ON public.call_tasks (due_at);

-- 4. Auto-update updated_at trigger for calls
DROP TRIGGER IF EXISTS set_calls_updated_at ON public.calls;
CREATE TRIGGER set_calls_updated_at
    BEFORE UPDATE ON public.calls
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Row Level Security
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_tasks ENABLE ROW LEVEL SECURITY;

-- Calls: Accessible through lead's organization, or if lead_id is null (inbound unmatched)
CREATE POLICY "Org members can view calls" ON public.calls
    FOR SELECT USING (
        lead_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = calls.lead_id
            AND leads.org_id = public.get_auth_org_id()
        )
    );

CREATE POLICY "Org members can insert calls" ON public.calls
    FOR INSERT WITH CHECK (
        lead_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = calls.lead_id
            AND leads.org_id = public.get_auth_org_id()
        )
    );

CREATE POLICY "Org members can update calls" ON public.calls
    FOR UPDATE USING (
        lead_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = calls.lead_id
            AND leads.org_id = public.get_auth_org_id()
        )
    );

-- Call Tasks: Accessible through lead's organization
CREATE POLICY "Org members can manage call tasks" ON public.call_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = call_tasks.lead_id
            AND leads.org_id = public.get_auth_org_id()
        )
    );

-- 6. Enable Realtime for the calls table
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;
