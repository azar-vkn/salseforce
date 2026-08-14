-- ==============================================================================
-- SalesMind AI — Role-Based Access Control (RBAC) & Invite-Only Management
-- Version: 1.2.0
-- Roles: admin (full access), salesperson (limited sales operations)
-- Invite Policy: Only the Primary Admin or Admins can pre-invite emails with roles.
-- ==============================================================================

-- 1. Ensure user_role enum supports 'admin' and 'salesperson'
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'salesperson';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Invited Members Table (Stores pre-approved emails and prefixed roles)
CREATE TABLE IF NOT EXISTS public.invited_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'salesperson',
    invited_by UUID,
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on invited_members
ALTER TABLE public.invited_members ENABLE ROW LEVEL SECURITY;

-- Allow reading invited members for auth verification and org members
CREATE POLICY "Public read invited members for signup validation" ON public.invited_members
    FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage invited members" ON public.invited_members
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role::TEXT IN ('admin', 'owner')
        )
    );

-- 3. Helper Functions for Role Resolution
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role::TEXT INTO v_role 
    FROM public.profiles 
    WHERE id = auth.uid() 
    LIMIT 1;

    RETURN COALESCE(v_role, 'salesperson');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper to check if current user is an admin or owner
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (SELECT role::TEXT IN ('admin', 'owner') 
             FROM public.profiles 
             WHERE id = auth.uid() 
             LIMIT 1),
            TRUE -- Default to true if profile not yet provisioned to avoid initial lockout
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Automatic Profile Provisioning Trigger with Role Prefixing from Invites
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id UUID;
    user_count INT;
    assigned_role user_role;
    invite_record RECORD;
BEGIN
    -- Get or create default organization
    SELECT id INTO default_org_id FROM public.organizations LIMIT 1;
    
    IF default_org_id IS NULL THEN
        INSERT INTO public.organizations (name, slug, plan)
        VALUES ('SalesMind Workspace', 'salesmind-workspace', 'enterprise')
        RETURNING id INTO default_org_id;
    END IF;

    -- Check if user is the primary super admin or first user ever registered
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    
    IF LOWER(NEW.email) = 'azarvkn@gmail.com' OR user_count = 0 THEN
        assigned_role := 'admin'::user_role;
    ELSE
        -- Check if user was pre-invited with a prefixed role
        SELECT * INTO invite_record FROM public.invited_members WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
        
        IF invite_record.id IS NOT NULL THEN
            assigned_role := invite_record.role;
            -- Mark invite as active
            UPDATE public.invited_members SET status = 'active', updated_at = NOW() WHERE id = invite_record.id;
        ELSE
            -- If not invited, default to salesperson or fallback
            assigned_role := 'salesperson'::user_role;
        END IF;
    END IF;

    -- Insert into public.profiles
    INSERT INTO public.profiles (id, org_id, full_name, email, role)
    VALUES (
        NEW.id,
        default_org_id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            invite_record.full_name,
            split_part(NEW.email, '@', 1)
        ),
        NEW.email,
        assigned_role
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
