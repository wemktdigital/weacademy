-- Fix Security Warnings (RLS and Security Definer Views)

BEGIN;

-- 1. Fix SECURITY DEFINER views by setting security_invoker = true
-- This ensures the view runs with the permissions of the user querying it, respecting RLS.
ALTER VIEW public.audit_logs_view SET (security_invoker = true);
ALTER VIEW public.lab_workflow_metrics_daily SET (security_invoker = true);
ALTER VIEW public.lab_workflow_stage_metrics_daily SET (security_invoker = true);

-- 2. Enable RLS on public tables

-- Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Categories are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Categories are viewable by authenticated users" 
        ON public.categories FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;
END $$;

-- lab_workflow_teams
ALTER TABLE public.lab_workflow_teams ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_teams' AND policyname = 'Workflow teams are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Workflow teams are viewable by authenticated users" 
        ON public.lab_workflow_teams FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_teams' AND policyname = 'Workflow teams can be managed by authenticated users'
    ) THEN
        CREATE POLICY "Workflow teams can be managed by authenticated users" 
        ON public.lab_workflow_teams FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- lab_workflow_team_members
ALTER TABLE public.lab_workflow_team_members ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_team_members' AND policyname = 'Workflow team members are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Workflow team members are viewable by authenticated users" 
        ON public.lab_workflow_team_members FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_team_members' AND policyname = 'Workflow team members can be managed by authenticated users'
    ) THEN
        CREATE POLICY "Workflow team members can be managed by authenticated users" 
        ON public.lab_workflow_team_members FOR ALL 
        TO authenticated 
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- lab_workflow_human_tasks
ALTER TABLE public.lab_workflow_human_tasks ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_human_tasks' AND policyname = 'Human tasks are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Human tasks are viewable by authenticated users" 
        ON public.lab_workflow_human_tasks FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_human_tasks' AND policyname = 'Human tasks can be managed by authenticated users'
    ) THEN
        CREATE POLICY "Human tasks can be managed by authenticated users" 
        ON public.lab_workflow_human_tasks FOR ALL 
        TO authenticated 
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- lab_workflow_human_task_logs
ALTER TABLE public.lab_workflow_human_task_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_human_task_logs' AND policyname = 'Human task logs are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Human task logs are viewable by authenticated users" 
        ON public.lab_workflow_human_task_logs FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'lab_workflow_human_task_logs' AND policyname = 'Human task logs can be inserted by authenticated users'
    ) THEN
        CREATE POLICY "Human task logs can be inserted by authenticated users" 
        ON public.lab_workflow_human_task_logs FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    END IF;
END $$;

COMMIT;
