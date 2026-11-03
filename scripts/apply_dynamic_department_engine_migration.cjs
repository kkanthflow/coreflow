process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL database.');

  // Begin transaction
  await client.query('BEGIN;');

  try {
    console.log('1. Dropping obsolete auto-seeding trigger & function...');
    await client.query(`
      DROP TRIGGER IF EXISTS trg_init_new_org_departments ON public.organizations;
      DROP FUNCTION IF EXISTS public.init_new_org_departments();
    `);

    console.log('2. Extending public.departments for MNC hierarchy, objectives, and archiving...');
    await client.query(`
      ALTER TABLE public.departments
        ADD COLUMN IF NOT EXISTS parent_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS operational_requirements text,
        ADD COLUMN IF NOT EXISTS expected_outcomes text,
        ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS archived_at timestamptz;

      CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON public.departments(parent_department_id);
      CREATE INDEX IF NOT EXISTS idx_departments_is_archived ON public.departments(is_archived);
    `);

    console.log('3. Extending public.department_members for manager role & permissions...');
    await client.query(`
      ALTER TABLE public.department_members
        ADD COLUMN IF NOT EXISTS can_manage boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS access_permissions jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);

    console.log('4. Creating public.capabilities catalogue table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.capabilities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category text NOT NULL,
        key text NOT NULL UNIQUE,
        name text NOT NULL,
        description text NOT NULL,
        default_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
        display_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_capabilities_category ON public.capabilities(category);
      CREATE INDEX IF NOT EXISTS idx_capabilities_key ON public.capabilities(key);
    `);

    console.log('5. Creating public.department_capabilities junction table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.department_capabilities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
        capability_key text NOT NULL REFERENCES public.capabilities(key) ON DELETE CASCADE,
        custom_description text,
        custom_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_dept_capability UNIQUE (department_id, capability_key)
      );

      CREATE INDEX IF NOT EXISTS idx_dept_caps_dept_id ON public.department_capabilities(department_id);
      CREATE INDEX IF NOT EXISTS idx_dept_caps_org_id ON public.department_capabilities(org_id);
      CREATE INDEX IF NOT EXISTS idx_dept_caps_key ON public.department_capabilities(capability_key);
    `);

    console.log('6. Creating public.department_collaboration_requests table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.department_collaboration_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        requesting_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
        target_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
        request_type text NOT NULL,
        title text NOT NULL,
        description text,
        requester_id uuid NOT NULL REFERENCES public.users(id),
        assigned_to_id uuid REFERENCES public.users(id),
        status text NOT NULL DEFAULT 'pending',
        priority text NOT NULL DEFAULT 'medium',
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        decision_notes text,
        resolved_by uuid REFERENCES public.users(id),
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_dept_collab_org ON public.department_collaboration_requests(org_id);
      CREATE INDEX IF NOT EXISTS idx_dept_collab_target ON public.department_collaboration_requests(target_department_id);
      CREATE INDEX IF NOT EXISTS idx_dept_collab_req ON public.department_collaboration_requests(requesting_department_id);
      CREATE INDEX IF NOT EXISTS idx_dept_collab_status ON public.department_collaboration_requests(status);
    `);

    console.log('7. Creating public.department_activities audit trail table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.department_activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
        actor_id uuid NOT NULL REFERENCES public.users(id),
        activity_type text NOT NULL,
        title text NOT NULL,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_dept_activities_dept ON public.department_activities(department_id);
      CREATE INDEX IF NOT EXISTS idx_dept_activities_org ON public.department_activities(org_id);
    `);

    console.log('8. Seeding the 13 Global Functional Capability Groups into capabilities catalogue...');
    const capabilitiesSeed = [
      // 1. Finance
      { category: 'Finance', key: 'budget_planning', name: 'Budget Planning', description: 'Allocate, track, and forecast departmental fiscal allocations and variance.', default_modules: ['budgets', 'work_tasks'], display_order: 1 },
      { category: 'Finance', key: 'expense_management', name: 'Expense Management', description: 'Process vendor receipts, expense claims, and operational reimbursements.', default_modules: ['expenses'], display_order: 2 },
      { category: 'Finance', key: 'invoice_management', name: 'Invoice Management', description: 'Manage outbound billings, client payment terms, and aging receivables.', default_modules: ['invoices'], display_order: 3 },
      { category: 'Finance', key: 'payment_management', name: 'Payment Management', description: 'Track bank disbursements, settlement reconciliations, and payout logs.', default_modules: ['payments'], display_order: 4 },
      { category: 'Finance', key: 'accounts_payable', name: 'Accounts Payable', description: 'Manage supplier bills, purchase orders, and scheduled payment approvals.', default_modules: ['payables'], display_order: 5 },
      { category: 'Finance', key: 'accounts_receivable', name: 'Accounts Receivable', description: 'Audit incoming cash flows, client payment collections, and credit limits.', default_modules: ['receivables'], display_order: 6 },
      { category: 'Finance', key: 'financial_reporting', name: 'Financial Reporting', description: 'Consolidated balance sheets, P&L summaries, and margin analytics.', default_modules: ['financial_reports'], display_order: 7 },

      // 2. Human Resources
      { category: 'Human Resources', key: 'recruitment', name: 'Recruitment & ATS', description: 'Manage job postings, applicant pipelines, and interview assessments.', default_modules: ['recruitment'], display_order: 8 },
      { category: 'Human Resources', key: 'employee_management', name: 'Employee Management', description: 'Maintain personnel records, contract details, and departmental rosters.', default_modules: ['employee_records'], display_order: 9 },
      { category: 'Human Resources', key: 'attendance', name: 'Attendance & Tracking', description: 'Track working hours, shifts, attendance exceptions, and logs.', default_modules: ['attendance'], display_order: 10 },
      { category: 'Human Resources', key: 'leave_management', name: 'Leave Management', description: 'Process paid time off, medical leave approvals, and holiday calendars.', default_modules: ['leave_approvals'], display_order: 11 },
      { category: 'Human Resources', key: 'performance_management', name: 'Performance & OKRs', description: 'Quarterly review cycles, performance appraisals, and OKR goal tracking.', default_modules: ['performance_reviews'], display_order: 12 },
      { category: 'Human Resources', key: 'training_development', name: 'Training & Development', description: 'Employee upskilling courses, internal certifications, and skill matrices.', default_modules: ['training_hub'], display_order: 13 },

      // 3. Engineering & Technology
      { category: 'Engineering & Technology', key: 'software_development', name: 'Software Development', description: 'Track software engineering milestones, epics, and code deliverables.', default_modules: ['work_tasks', 'projects'], display_order: 14 },
      { category: 'Engineering & Technology', key: 'technical_project_management', name: 'Technical Project Management', description: 'Coordinate architecture sprints, engineering roadmaps, and delivery schedules.', default_modules: ['projects'], display_order: 15 },
      { category: 'Engineering & Technology', key: 'sprint_management', name: 'Sprint Management', description: 'Agile sprints, story point burn-down charts, and sprint retrospectives.', default_modules: ['sprint_board'], display_order: 16 },
      { category: 'Engineering & Technology', key: 'bug_tracking', name: 'Bug & Defect Tracking', description: 'Log defects, triage severity levels, and monitor bug resolution lifecycles.', default_modules: ['bug_tracker'], display_order: 17 },
      { category: 'Engineering & Technology', key: 'quality_assurance', name: 'Quality Assurance', description: 'Manage test cases, QA validation checklists, and release regression runs.', default_modules: ['qa_suites'], display_order: 18 },
      { category: 'Engineering & Technology', key: 'release_management', name: 'Release Management', description: 'Stage deployments, version tags, changelog drafting, and release sign-offs.', default_modules: ['releases'], display_order: 19 },
      { category: 'Engineering & Technology', key: 'infrastructure_management', name: 'Infrastructure & DevOps', description: 'Oversee cloud resources, server health, CI/CD runners, and incident alerts.', default_modules: ['infrastructure'], display_order: 20 },

      // 4. Sales & Marketing
      { category: 'Sales & Marketing', key: 'lead_generation', name: 'Lead Generation', description: 'Inbound prospect intake, lead qualification rules, and outreach funnels.', default_modules: ['leads'], display_order: 21 },
      { category: 'Sales & Marketing', key: 'sales_pipeline', name: 'Sales Pipeline', description: 'Track deals from initial discovery to negotiation, proposal, and closed-won.', default_modules: ['deals_pipeline'], display_order: 22 },
      { category: 'Sales & Marketing', key: 'customer_acquisition', name: 'Customer Acquisition', description: 'Monitor CAC, conversion funnel velocity, and client onboarding handoffs.', default_modules: ['acquisition_metrics'], display_order: 23 },
      { category: 'Sales & Marketing', key: 'campaign_management', name: 'Campaign Management', description: 'Plan, budget, and launch multi-channel promotional and branding campaigns.', default_modules: ['campaigns'], display_order: 24 },
      { category: 'Sales & Marketing', key: 'content_planning', name: 'Content Planning', description: 'Editorial calendars, copywriting reviews, creative briefs, and media drafts.', default_modules: ['content_calendar'], display_order: 25 },
      { category: 'Sales & Marketing', key: 'marketing_analytics', name: 'Marketing Analytics', description: 'Evaluate campaign CTR, ROAS, channel effectiveness, and attribution.', default_modules: ['marketing_reports'], display_order: 26 },

      // 5. Operations
      { category: 'Operations', key: 'daily_operations', name: 'Daily Operations', description: 'Coordinate daily business routines, runbooks, and SLA compliance tasks.', default_modules: ['work_tasks'], display_order: 27 },
      { category: 'Operations', key: 'resource_allocation', name: 'Resource Allocation', description: 'Balance departmental staffing, equipment capacity, and physical assets.', default_modules: ['resource_planning'], display_order: 28 },
      { category: 'Operations', key: 'process_management', name: 'Process Management', description: 'Document SOPs, standardize workflows, and manage continuous improvement.', default_modules: ['sop_library'], display_order: 29 },
      { category: 'Operations', key: 'vendor_management', name: 'Vendor Management', description: 'Track external supplier agreements, performance scores, and renewals.', default_modules: ['vendors'], display_order: 30 },
      { category: 'Operations', key: 'procurement', name: 'Procurement', description: 'Manage purchase requisitions, supplier quotes, and procurement orders.', default_modules: ['procurement_orders'], display_order: 31 },
      { category: 'Operations', key: 'inventory_management', name: 'Inventory Management', description: 'Monitor physical and digital inventory stocks, locations, and reorder points.', default_modules: ['inventory'], display_order: 32 },

      // 6. Customer Success
      { category: 'Customer Success', key: 'customer_onboarding', name: 'Customer Onboarding', description: 'New account onboarding journeys, milestone checklists, and go-live tracking.', default_modules: ['client_onboarding'], display_order: 33 },
      { category: 'Customer Success', key: 'support_tickets', name: 'Support Tickets', description: 'Triage customer inquiries, assign response priorities, and resolve tickets.', default_modules: ['tickets_queue'], display_order: 34 },
      { category: 'Customer Success', key: 'complaint_resolution', name: 'Complaint Resolution', description: 'Escalation pathways, root-cause investigations, and SLA resolutions.', default_modules: ['escalations'], display_order: 35 },
      { category: 'Customer Success', key: 'customer_retention', name: 'Customer Retention', description: 'Track renewal health scores, churn risks, and customer satisfaction metrics.', default_modules: ['retention_metrics'], display_order: 36 },
      { category: 'Customer Success', key: 'feedback_management', name: 'Feedback & NPS', description: 'Collect client feedback, survey scores, and feature suggestion logs.', default_modules: ['feedback_surveys'], display_order: 37 },

      // 7. Legal & Compliance
      { category: 'Legal & Compliance', key: 'contract_lifecycle', name: 'Contract Lifecycle', description: 'Draft, review, redline, and archive commercial and NDA agreements.', default_modules: ['contracts'], display_order: 38 },
      { category: 'Legal & Compliance', key: 'regulatory_compliance', name: 'Regulatory Compliance', description: 'Ensure adherence to statutory, data privacy, and jurisdictional mandates.', default_modules: ['compliance_checks'], display_order: 39 },
      { category: 'Legal & Compliance', key: 'policy_governance', name: 'Policy Governance', description: 'Publish corporate policies, monitor employee acknowledgments, and audit.', default_modules: ['policies'], display_order: 40 },
      { category: 'Legal & Compliance', key: 'risk_register', name: 'Risk Register', description: 'Catalog enterprise risks, assign probability scores, and mitigation plans.', default_modules: ['risk_matrix'], display_order: 41 },

      // 8. Information Security
      { category: 'Information Security', key: 'security_audits', name: 'Security Audits', description: 'Conduct internal vulnerability scans, penetration test tracking, and reports.', default_modules: ['security_reviews'], display_order: 42 },
      { category: 'Information Security', key: 'access_reviews', name: 'Access Control Reviews', description: 'Audit user credentials, role privilege creep, and MFA compliance.', default_modules: ['access_audits'], display_order: 43 },
      { category: 'Information Security', key: 'incident_response', name: 'Incident Response', description: 'Manage security alerts, breach response workflows, and post-mortems.', default_modules: ['security_incidents'], display_order: 44 },

      // 9. Research & Development
      { category: 'Research & Development', key: 'feasibility_studies', name: 'Feasibility Studies', description: 'Investigate technical feasibility, market viability, and resource requirements.', default_modules: ['r_and_d_studies'], display_order: 45 },
      { category: 'Research & Development', key: 'innovation_pipeline', name: 'Innovation Pipeline', description: 'Incubate exploratory concepts, prototypes, and experiment results.', default_modules: ['innovation_projects'], display_order: 46 },

      // 10. Product Management
      { category: 'Product Management', key: 'product_strategy', name: 'Product Strategy & PRDs', description: 'Author product requirement documents, user personas, and value props.', default_modules: ['product_specs'], display_order: 47 },
      { category: 'Product Management', key: 'roadmap_planning', name: 'Roadmap Planning', description: 'Quarterly feature roadmaps, milestone timelines, and release alignments.', default_modules: ['roadmap'], display_order: 48 },

      // 11. Data Analytics
      { category: 'Data Analytics', key: 'business_intelligence', name: 'Business Intelligence & KPIs', description: 'Curate executive dashboards, business intelligence datasets, and trends.', default_modules: ['bi_dashboards'], display_order: 49 },

      // 12. Administration
      { category: 'Administration', key: 'facilities_management', name: 'Facilities & Workplace', description: 'Manage office assets, physical desks, security passes, and services.', default_modules: ['facilities'], display_order: 50 },

      // 13. Supply Chain & Logistics
      { category: 'Supply Chain & Logistics', key: 'logistics_management', name: 'Logistics & Supply Chain', description: 'Coordinate shipment logistics, cargo handling, and fulfillment tracking.', default_modules: ['shipments'], display_order: 51 },
    ];

    for (const cap of capabilitiesSeed) {
      await client.query(`
        INSERT INTO public.capabilities (category, key, name, description, default_modules, display_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (key) DO UPDATE SET
          category = EXCLUDED.category,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          default_modules = EXCLUDED.default_modules,
          display_order = EXCLUDED.display_order;
      `, [cap.category, cap.key, cap.name, cap.description, JSON.stringify(cap.default_modules), cap.display_order]);
    }
    console.log(`✓ Seeded ${capabilitiesSeed.length} capabilities across 13 functional domains.`);

    console.log('9. Backfilling capabilities for existing active departments...');
    // For each existing department, map sensible default capabilities based on name or enabled_modules
    const depts = await client.query(`SELECT id, org_id, name, enabled_modules FROM public.departments WHERE is_deleted = false;`);
    for (const d of depts.rows) {
      const lowerName = d.name.toLowerCase();
      let keysToAssign = [];

      if (lowerName.includes('software') || lowerName.includes('dev') || lowerName.includes('tech') || lowerName.includes('engineer')) {
        keysToAssign = ['software_development', 'technical_project_management', 'sprint_management', 'bug_tracking', 'quality_assurance', 'release_management'];
      } else if (lowerName.includes('market') || lowerName.includes('sales') || lowerName.includes('growth')) {
        keysToAssign = ['campaign_management', 'lead_generation', 'content_planning', 'marketing_analytics', 'sales_pipeline'];
      } else if (lowerName.includes('finance') || lowerName.includes('account') || lowerName.includes('treasury')) {
        keysToAssign = ['budget_planning', 'expense_management', 'invoice_management', 'payment_management', 'financial_reporting'];
      } else if (lowerName.includes('hr') || lowerName.includes('people') || lowerName.includes('talent')) {
        keysToAssign = ['recruitment', 'employee_management', 'leave_management', 'performance_management'];
      } else if (lowerName.includes('ops') || lowerName.includes('operation')) {
        keysToAssign = ['daily_operations', 'process_management', 'vendor_management', 'resource_allocation'];
      } else {
        keysToAssign = ['daily_operations', 'process_management'];
      }

      for (const key of keysToAssign) {
        await client.query(`
          INSERT INTO public.department_capabilities (org_id, department_id, capability_key, custom_description, is_active)
          VALUES ($1, $2, $3, NULL, true)
          ON CONFLICT (department_id, capability_key) DO NOTHING;
        `, [d.org_id, d.id, key]);
      }
    }
    console.log(`✓ Backfilled capabilities for ${depts.rows.length} existing departments.`);

    console.log('10. Applying atomic procedures for Dynamic Department Engine...');

    // Function: create_dynamic_department
    await client.query(`
      CREATE OR REPLACE FUNCTION public.create_dynamic_department(
        p_org_id uuid,
        p_name text,
        p_description text DEFAULT NULL,
        p_color text DEFAULT '#FF6B4A',
        p_parent_department_id uuid DEFAULT NULL,
        p_head_user_id uuid DEFAULT NULL,
        p_objectives jsonb DEFAULT '[]'::jsonb,
        p_operational_requirements text DEFAULT NULL,
        p_expected_outcomes text DEFAULT NULL,
        p_capability_keys text[] DEFAULT '{}'::text[],
        p_member_assignments jsonb DEFAULT '[]'::jsonb
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_caller_id uuid;
        v_dept_id uuid;
        v_clean_name text;
        v_cap_key text;
        v_member jsonb;
        v_member_user_id uuid;
        v_member_role text;
        v_member_can_manage boolean;
        v_member_is_primary boolean;
      BEGIN
        v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

        -- Authority check: Owner or leadership with manage_departments permission
        IF NOT (
          public.is_org_owner(v_caller_id, p_org_id)
          OR EXISTS (
            SELECT 1 FROM public.leadership_members 
            WHERE org_id = p_org_id AND user_id = v_caller_id AND is_active = true AND can_manage_departments = true
          )
          OR public.has_org_permission(v_caller_id, p_org_id, 'departments.manage')
        ) THEN
          RAISE EXCEPTION 'Access denied. Only organization owners and authorized leadership can create departments.' USING ERRCODE = '42501';
        END IF;

        v_clean_name := TRIM(COALESCE(p_name, ''));
        IF LENGTH(v_clean_name) < 2 THEN
          RAISE EXCEPTION 'Department name must be at least 2 characters.' USING ERRCODE = '22000';
        END IF;

        -- 1. Create department record
        INSERT INTO public.departments (
          org_id, name, description, color, parent_department_id, head_user_id,
          objectives, operational_requirements, expected_outcomes,
          status, is_deleted, created_by, created_at
        ) VALUES (
          p_org_id, v_clean_name, TRIM(p_description), COALESCE(p_color, '#FF6B4A'), p_parent_department_id, p_head_user_id,
          COALESCE(p_objectives, '[]'::jsonb), TRIM(p_operational_requirements), TRIM(p_expected_outcomes),
          'active', false, v_caller_id, now()
        )
        RETURNING id INTO v_dept_id;

        -- 2. Associate capabilities
        IF p_capability_keys IS NOT NULL AND array_length(p_capability_keys, 1) > 0 THEN
          FOREACH v_cap_key IN ARRAY p_capability_keys LOOP
            INSERT INTO public.department_capabilities (
              org_id, department_id, capability_key, is_active
            ) VALUES (
              p_org_id, v_dept_id, v_cap_key, true
            )
            ON CONFLICT (department_id, capability_key) DO NOTHING;
          END LOOP;
        END IF;

        -- 3. Assign Head user if provided
        IF p_head_user_id IS NOT NULL THEN
          INSERT INTO public.department_members (
            department_id, user_id, org_id, department_role, can_manage, is_primary, assigned_by
          ) VALUES (
            v_dept_id, p_head_user_id, p_org_id, 'head', true, true, v_caller_id
          )
          ON CONFLICT (department_id, user_id) DO UPDATE SET
            department_role = 'head',
            can_manage = true;
        END IF;

        -- 4. Process member assignments array: [{ user_id, role, can_manage, is_primary }]
        IF p_member_assignments IS NOT NULL AND jsonb_array_length(p_member_assignments) > 0 THEN
          FOR v_member IN SELECT * FROM jsonb_array_elements(p_member_assignments) LOOP
            v_member_user_id := (v_member->>'user_id')::uuid;
            v_member_role := COALESCE(v_member->>'role', 'member');
            v_member_can_manage := COALESCE((v_member->>'can_manage')::boolean, false);
            v_member_is_primary := COALESCE((v_member->>'is_primary')::boolean, false);

            IF v_member_user_id IS NOT NULL AND v_member_user_id <> COALESCE(p_head_user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
              INSERT INTO public.department_members (
                department_id, user_id, org_id, department_role, can_manage, is_primary, assigned_by
              ) VALUES (
                v_dept_id, v_member_user_id, p_org_id, v_member_role, v_member_can_manage, v_member_is_primary, v_caller_id
              )
              ON CONFLICT (department_id, user_id) DO UPDATE SET
                department_role = EXCLUDED.department_role,
                can_manage = EXCLUDED.can_manage,
                is_primary = EXCLUDED.is_primary;

              IF v_member_is_primary THEN
                UPDATE public.user_organizations
                SET department_id = v_dept_id
                WHERE org_id = p_org_id AND user_id = v_member_user_id;

                UPDATE public.users
                SET department = v_clean_name
                WHERE id = v_member_user_id;
              END IF;
            END IF;
          END LOOP;
        END IF;

        -- 5. Automatically create a default department chat channel in public.chat_channels
        INSERT INTO public.chat_channels (
          org_id, department_id, name, type, description, is_private
        ) VALUES (
          p_org_id, v_dept_id, v_clean_name, 'department', 'General channel for ' || v_clean_name, false
        )
        ON CONFLICT DO NOTHING;

        -- 6. Log department activity
        INSERT INTO public.department_activities (
          org_id, department_id, actor_id, activity_type, title, details
        ) VALUES (
          p_org_id, v_dept_id, v_caller_id, 'department_created',
          'Department "' || v_clean_name || '" was created.',
          jsonb_build_object('name', v_clean_name, 'capabilities_count', array_length(p_capability_keys, 1))
        );

        RETURN jsonb_build_object(
          'success', true,
          'department_id', v_dept_id,
          'name', v_clean_name
        );
      END;
      $$;
    `);

    // Function: update_dynamic_department
    await client.query(`
      CREATE OR REPLACE FUNCTION public.update_dynamic_department(
        p_org_id uuid,
        p_department_id uuid,
        p_name text DEFAULT NULL,
        p_description text DEFAULT NULL,
        p_color text DEFAULT NULL,
        p_parent_department_id uuid DEFAULT NULL,
        p_head_user_id uuid DEFAULT NULL,
        p_objectives jsonb DEFAULT NULL,
        p_operational_requirements text DEFAULT NULL,
        p_expected_outcomes text DEFAULT NULL,
        p_capability_keys text[] DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_caller_id uuid;
        v_cap_key text;
        v_clean_name text;
      BEGIN
        v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

        -- Authority check
        IF NOT (
          public.is_org_owner(v_caller_id, p_org_id)
          OR EXISTS (
            SELECT 1 FROM public.departments WHERE id = p_department_id AND head_user_id = v_caller_id
          )
          OR EXISTS (
            SELECT 1 FROM public.department_members WHERE department_id = p_department_id AND user_id = v_caller_id AND can_manage = true
          )
          OR EXISTS (
            SELECT 1 FROM public.leadership_members 
            WHERE org_id = p_org_id AND user_id = v_caller_id AND is_active = true AND can_manage_departments = true
          )
        ) THEN
          RAISE EXCEPTION 'Access denied. You do not have permission to manage this department.' USING ERRCODE = '42501';
        END IF;

        IF p_name IS NOT NULL THEN
          v_clean_name := TRIM(p_name);
        END IF;

        -- Update main details
        UPDATE public.departments SET
          name = COALESCE(v_clean_name, name),
          description = COALESCE(TRIM(p_description), description),
          color = COALESCE(p_color, color),
          parent_department_id = COALESCE(p_parent_department_id, parent_department_id),
          head_user_id = COALESCE(p_head_user_id, head_user_id),
          objectives = COALESCE(p_objectives, objectives),
          operational_requirements = COALESCE(TRIM(p_operational_requirements), operational_requirements),
          expected_outcomes = COALESCE(TRIM(p_expected_outcomes), expected_outcomes)
        WHERE id = p_department_id AND org_id = p_org_id;

        -- Update capabilities if specified
        IF p_capability_keys IS NOT NULL THEN
          -- Deactivate capabilities not in the new list
          UPDATE public.department_capabilities
          SET is_active = false
          WHERE department_id = p_department_id
            AND capability_key <> ALL(p_capability_keys);

          -- Upsert and activate listed capabilities
          FOREACH v_cap_key IN ARRAY p_capability_keys LOOP
            INSERT INTO public.department_capabilities (
              org_id, department_id, capability_key, is_active
            ) VALUES (
              p_org_id, p_department_id, v_cap_key, true
            )
            ON CONFLICT (department_id, capability_key) DO UPDATE SET
              is_active = true,
              updated_at = now();
          END LOOP;
        END IF;

        -- Update head in department_members if head changed
        IF p_head_user_id IS NOT NULL THEN
          INSERT INTO public.department_members (
            department_id, user_id, org_id, department_role, can_manage, is_primary, assigned_by
          ) VALUES (
            p_department_id, p_head_user_id, p_org_id, 'head', true, true, v_caller_id
          )
          ON CONFLICT (department_id, user_id) DO UPDATE SET
            department_role = 'head',
            can_manage = true;
        END IF;

        -- Log activity
        INSERT INTO public.department_activities (
          org_id, department_id, actor_id, activity_type, title, details
        ) VALUES (
          p_org_id, p_department_id, v_caller_id, 'department_updated',
          'Department configuration was updated.',
          jsonb_build_object('updated_by', v_caller_id)
        );

        RETURN jsonb_build_object('success', true, 'department_id', p_department_id);
      END;
      $$;
    `);

    // Function: archive_department_safe
    await client.query(`
      CREATE OR REPLACE FUNCTION public.archive_department_safe(
        p_org_id uuid,
        p_department_id uuid
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_caller_id uuid;
      BEGIN
        v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

        IF NOT public.is_org_owner(v_caller_id, p_org_id) THEN
          RAISE EXCEPTION 'Only organization owners can archive a department.' USING ERRCODE = '42501';
        END IF;

        UPDATE public.departments
        SET is_archived = true,
            archived_at = now(),
            status = 'archived'
        WHERE id = p_department_id AND org_id = p_org_id;

        INSERT INTO public.department_activities (
          org_id, department_id, actor_id, activity_type, title
        ) VALUES (
          p_org_id, p_department_id, v_caller_id, 'department_archived', 'Department was safely archived.'
        );

        RETURN jsonb_build_object('success', true, 'archived_id', p_department_id);
      END;
      $$;
    `);

    // Function: create_collaboration_request
    await client.query(`
      CREATE OR REPLACE FUNCTION public.create_collaboration_request(
        p_org_id uuid,
        p_requesting_department_id uuid,
        p_target_department_id uuid,
        p_request_type text,
        p_title text,
        p_description text DEFAULT NULL,
        p_priority text DEFAULT 'medium',
        p_payload jsonb DEFAULT '{}'::jsonb
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_caller_id uuid;
        v_request_id uuid;
      BEGIN
        v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

        -- Verify caller belongs to requesting department or is owner
        IF NOT (
          public.is_org_owner(v_caller_id, p_org_id)
          OR EXISTS (
            SELECT 1 FROM public.department_members 
            WHERE department_id = p_requesting_department_id AND user_id = v_caller_id
          )
        ) THEN
          RAISE EXCEPTION 'Access denied. You must be a member of the requesting department.' USING ERRCODE = '42501';
        END IF;

        INSERT INTO public.department_collaboration_requests (
          org_id, requesting_department_id, target_department_id,
          request_type, title, description, priority, payload,
          requester_id, status, created_at
        ) VALUES (
          p_org_id, p_requesting_department_id, p_target_department_id,
          COALESCE(p_request_type, 'task_assignment'), TRIM(p_title), TRIM(p_description),
          COALESCE(p_priority, 'medium'), COALESCE(p_payload, '{}'::jsonb),
          v_caller_id, 'pending', now()
        )
        RETURNING id INTO v_request_id;

        -- Log in both departments
        INSERT INTO public.department_activities (
          org_id, department_id, actor_id, activity_type, title, details
        ) VALUES (
          p_org_id, p_requesting_department_id, v_caller_id, 'collab_request_sent',
          'Dispatched collaboration request: ' || p_title,
          jsonb_build_object('target_department_id', p_target_department_id, 'request_id', v_request_id)
        );

        INSERT INTO public.department_activities (
          org_id, department_id, actor_id, activity_type, title, details
        ) VALUES (
          p_org_id, p_target_department_id, v_caller_id, 'collab_request_received',
          'Received collaboration request: ' || p_title,
          jsonb_build_object('from_department_id', p_requesting_department_id, 'request_id', v_request_id)
        );

        RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
      END;
      $$;
    `);

    // Function: resolve_collaboration_request
    await client.query(`
      CREATE OR REPLACE FUNCTION public.resolve_collaboration_request(
        p_org_id uuid,
        p_request_id uuid,
        p_status text,
        p_decision_notes text DEFAULT NULL,
        p_assigned_to_id uuid DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_caller_id uuid;
        v_target_dept_id uuid;
        v_req_title text;
      BEGIN
        v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

        SELECT target_department_id, title INTO v_target_dept_id, v_req_title
        FROM public.department_collaboration_requests
        WHERE id = p_request_id AND org_id = p_org_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Collaboration request not found.' USING ERRCODE = 'P0002';
        END IF;

        -- Authority check: Owner, target dept head/manager
        IF NOT (
          public.is_org_owner(v_caller_id, p_org_id)
          OR EXISTS (
            SELECT 1 FROM public.departments WHERE id = v_target_dept_id AND head_user_id = v_caller_id
          )
          OR EXISTS (
            SELECT 1 FROM public.department_members 
            WHERE department_id = v_target_dept_id AND user_id = v_caller_id AND can_manage = true
          )
        ) THEN
          RAISE EXCEPTION 'Access denied. Only target department leadership can resolve collaboration requests.' USING ERRCODE = '42501';
        END IF;

        UPDATE public.department_collaboration_requests SET
          status = p_status,
          decision_notes = COALESCE(p_decision_notes, decision_notes),
          assigned_to_id = COALESCE(p_assigned_to_id, assigned_to_id),
          resolved_by = v_caller_id,
          resolved_at = now(),
          updated_at = now()
        WHERE id = p_request_id;

        INSERT INTO public.department_activities (
          org_id, department_id, actor_id, activity_type, title, details
        ) VALUES (
          p_org_id, v_target_dept_id, v_caller_id, 'collab_request_resolved',
          'Collaboration request "' || v_req_title || '" resolved as ' || p_status,
          jsonb_build_object('request_id', p_request_id, 'status', p_status)
        );

        RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', p_status);
      END;
      $$;
    `);

    console.log('11. Configuring Row Level Security (RLS) on new tables...');
    await client.query(`
      ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.department_capabilities ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.department_collaboration_requests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.department_activities ENABLE ROW LEVEL SECURITY;

      -- Capabilities catalogue is globally readable by all authenticated users
      DROP POLICY IF EXISTS "Global capabilities are readable by authenticated users" ON public.capabilities;
      CREATE POLICY "Global capabilities are readable by authenticated users"
      ON public.capabilities FOR SELECT
      TO authenticated, anon
      USING (true);

      -- Department capabilities isolated by organization
      DROP POLICY IF EXISTS "Department capabilities isolated by org" ON public.department_capabilities;
      CREATE POLICY "Department capabilities isolated by org"
      ON public.department_capabilities FOR ALL
      USING (
        public.is_org_owner(auth.uid(), org_id)
        OR public.can_access_department(auth.uid(), department_id)
        OR EXISTS (
          SELECT 1 FROM public.user_organizations WHERE org_id = department_capabilities.org_id AND user_id = auth.uid()
        )
      );

      -- Collaboration requests isolated by org and participant departments
      DROP POLICY IF EXISTS "Collaboration requests isolated by org" ON public.department_collaboration_requests;
      CREATE POLICY "Collaboration requests isolated by org"
      ON public.department_collaboration_requests FOR ALL
      USING (
        public.is_org_owner(auth.uid(), org_id)
        OR public.can_access_department(auth.uid(), target_department_id)
        OR public.can_access_department(auth.uid(), requesting_department_id)
        OR requester_id = auth.uid()
        OR assigned_to_id = auth.uid()
      );

      -- Department activities viewable by department members & leadership
      DROP POLICY IF EXISTS "Department activities viewable by members & leadership" ON public.department_activities;
      CREATE POLICY "Department activities viewable by members & leadership"
      ON public.department_activities FOR SELECT
      USING (
        public.is_org_owner(auth.uid(), org_id)
        OR public.can_access_department(auth.uid(), department_id)
      );

      -- Grant execute on all RPCs
      GRANT EXECUTE ON FUNCTION public.create_dynamic_department(uuid, text, text, text, uuid, uuid, jsonb, text, text, text[], jsonb) TO authenticated, anon, service_role;
      GRANT EXECUTE ON FUNCTION public.update_dynamic_department(uuid, uuid, text, text, text, uuid, uuid, jsonb, text, text, text[]) TO authenticated, anon, service_role;
      GRANT EXECUTE ON FUNCTION public.archive_department_safe(uuid, uuid) TO authenticated, anon, service_role;
      GRANT EXECUTE ON FUNCTION public.create_collaboration_request(uuid, uuid, uuid, text, text, text, text, jsonb) TO authenticated, anon, service_role;
      GRANT EXECUTE ON FUNCTION public.resolve_collaboration_request(uuid, uuid, text, text, uuid) TO authenticated, anon, service_role;

      NOTIFY pgrst, 'reload schema';
    `);

    await client.query('COMMIT;');
    console.log('\n======================================================');
    console.log('✓ DYNAMIC DEPARTMENT ENGINE MIGRATION APPLIED SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Migration failed, transaction rolled back:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

