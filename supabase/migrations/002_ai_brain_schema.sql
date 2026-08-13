-- ==============================================================================
-- SalesMind AI Enterprise CRM — AI Brain Central Knowledge Base Migration
-- Version: 1.1.0
-- Database: PostgreSQL (Supabase)
-- ==============================================================================

-- 1. Custom Enumeration Types for Knowledge Engine
DO $$ BEGIN
  CREATE TYPE knowledge_type AS ENUM (
    'company', 
    'service', 
    'product', 
    'pricing', 
    'offer', 
    'policy', 
    'faq', 
    'business_rule', 
    'document'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE knowledge_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE unknown_question_status AS ENUM ('UNANSWERED', 'RESOLVED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Knowledge Items Table (Central Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.knowledge_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    type knowledge_type NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    status knowledge_status NOT NULL DEFAULT 'PUBLISHED',
    version INT NOT NULL DEFAULT 1,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_type TEXT NOT NULL DEFAULT 'Company Admin',
    source_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Knowledge Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_url TEXT,
    raw_content TEXT NOT NULL,
    status knowledge_status NOT NULL DEFAULT 'PUBLISHED',
    version INT NOT NULL DEFAULT 1,
    chunk_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Knowledge Chunks Table (RAG Search Target)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Business Rules Table
CREATE TABLE IF NOT EXISTS public.business_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL DEFAULT 'do', -- 'do', 'dont', 'escalate', 'confidential'
    rule_text TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 1,
    status knowledge_status NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Unknown Questions Queue Table
CREATE TABLE IF NOT EXISTS public.unknown_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    customer_name TEXT,
    customer_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    confidence INT NOT NULL DEFAULT 45,
    status unknown_question_status NOT NULL DEFAULT 'UNANSWERED',
    approved_answer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_items_org_status ON public.knowledge_items (org_id, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type ON public.knowledge_items (type);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON public.knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_status ON public.business_rules (status);
CREATE INDEX IF NOT EXISTS idx_unknown_questions_status ON public.unknown_questions (status);

-- 8. Updated At Triggers
DROP TRIGGER IF EXISTS set_knowledge_items_updated_at ON public.knowledge_items;
CREATE TRIGGER set_knowledge_items_updated_at BEFORE UPDATE ON public.knowledge_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_knowledge_documents_updated_at ON public.knowledge_documents;
CREATE TRIGGER set_knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_business_rules_updated_at ON public.business_rules;
CREATE TRIGGER set_business_rules_updated_at BEFORE UPDATE ON public.business_rules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_unknown_questions_updated_at ON public.unknown_questions;
CREATE TRIGGER set_unknown_questions_updated_at BEFORE UPDATE ON public.unknown_questions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. Row Level Security Policies
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unknown_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read knowledge_items" ON public.knowledge_items FOR SELECT USING (true);
CREATE POLICY "Org admins can manage knowledge_items" ON public.knowledge_items FOR ALL USING (true);

CREATE POLICY "Org members can read knowledge_documents" ON public.knowledge_documents FOR SELECT USING (true);
CREATE POLICY "Org admins can manage knowledge_documents" ON public.knowledge_documents FOR ALL USING (true);

CREATE POLICY "Org members can read knowledge_chunks" ON public.knowledge_chunks FOR SELECT USING (true);
CREATE POLICY "Org admins can manage knowledge_chunks" ON public.knowledge_chunks FOR ALL USING (true);

CREATE POLICY "Org members can read business_rules" ON public.business_rules FOR SELECT USING (true);
CREATE POLICY "Org admins can manage business_rules" ON public.business_rules FOR ALL USING (true);

CREATE POLICY "Org members can read unknown_questions" ON public.unknown_questions FOR SELECT USING (true);
CREATE POLICY "Org admins can manage unknown_questions" ON public.unknown_questions FOR ALL USING (true);

-- 10. Enable Realtime Broadcast for AI Brain entities
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_items;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.business_rules;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.unknown_questions;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;
