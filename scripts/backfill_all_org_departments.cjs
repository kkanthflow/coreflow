process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const CONNECTION_STRING = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function backfillAllOrgs() {
  console.log('Connecting to Supabase PostgreSQL database...');
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  try {
    console.log('1. Ensuring all existing organizations have department workspaces...');

    const orgsRes = await client.query('SELECT id, name FROM public.organizations;');
    const orgs = orgsRes.rows;
    console.log(`Found ${orgs.length} total organizations.`);

    for (const org of orgs) {
      const deptCheck = await client.query('SELECT COUNT(*) FROM public.departments WHERE org_id = $1;', [org.id]);
      const count = parseInt(deptCheck.rows[0].count, 10);

      if (count === 0) {
        console.log(`  -> Initializing departments for org: ${org.name} (${org.id})`);

        // Software Development
        await client.query(`
          INSERT INTO public.departments (
            org_id, name, description, purpose, color, status, is_deleted, module_configurations
          ) VALUES (
            $1, 'Software Development', 'Engineering, platform architecture, and sprint delivery.',
            'Deliver high-velocity reliable software systems and feature releases.', '#FF6B4A', 'active', false,
            $2::jsonb
          );
        `, [
          org.id,
          JSON.stringify({
            project_configuration: {
              project_types: ['Software Product', 'Sprint Release', 'Bug Resolution Workstream', 'Architecture Refactor'],
              workflow_stages: ['Backlog', 'Sprint Planning', 'In Development', 'Code Review', 'QA Testing', 'Released'],
              metrics: ['Velocity', 'Deliverables', 'Milestones']
            }
          })
        ]);

        // Sales & Marketing
        await client.query(`
          INSERT INTO public.departments (
            org_id, name, description, purpose, color, status, is_deleted, module_configurations
          ) VALUES (
            $1, 'Sales & Marketing', 'Campaigns, lead acquisition, brand growth, and client relationships.',
            'Expand market presence, acquire target customers, and manage outward deliverables.', '#60A5FA', 'active', false,
            $2::jsonb
          );
        `, [
          org.id,
          JSON.stringify({
            project_configuration: {
              project_types: ['Marketing Campaign', 'Content Deliverable', 'Product Launch', 'Lead Gen Initiative'],
              workflow_stages: ['Campaign Strategy', 'Content Drafting', 'Creative Review', 'Live in Market', 'Performance Review'],
              metrics: ['Conversion', 'Reach', 'Deliverables']
            }
          })
        ]);

        // Finance & Operations
        await client.query(`
          INSERT INTO public.departments (
            org_id, name, description, purpose, color, status, is_deleted, module_configurations
          ) VALUES (
            $1, 'Finance & Operations', 'Fiscal governance, budget allocation, audits, and operational health.',
            'Maintain financial integrity, fiscal accuracy, and corporate compliance.', '#34D399', 'active', false,
            $2::jsonb
          );
        `, [
          org.id,
          JSON.stringify({
            project_configuration: {
              project_types: ['Budget Planning', 'Audit & Compliance', 'Quarterly Reconciliation', 'Expense Optimization'],
              workflow_stages: ['Proposed', 'Budget Allocation', 'Fiscal Approval', 'Execution', 'Audited & Reconciled'],
              metrics: ['Budget Variance', 'Compliance Rate', 'Milestones']
            }
          })
        ]);
      }
    }

    console.log('\n2. Backfilling all legacy unassigned projects to primary department...');
    const backfillProjects = await client.query(`
      DO $$
      DECLARE
        r RECORD;
        v_primary_dept_id uuid;
      BEGIN
        FOR r IN SELECT DISTINCT org_id FROM public.projects WHERE department_id IS NULL AND org_id IS NOT NULL LOOP
          SELECT id INTO v_primary_dept_id 
          FROM public.departments 
          WHERE org_id = r.org_id AND is_deleted = false 
          ORDER BY 
            CASE WHEN name ILIKE '%software%' OR name ILIKE '%product%' THEN 0 ELSE 1 END,
            created_at ASC 
          LIMIT 1;

          IF v_primary_dept_id IS NOT NULL THEN
            UPDATE public.projects 
            SET department_id = v_primary_dept_id,
                project_type = COALESCE(project_type, 'standard'),
                workflow_stage = COALESCE(workflow_stage, 'planning')
            WHERE org_id = r.org_id AND department_id IS NULL;
          END IF;
        END LOOP;

        -- Also link tasks
        UPDATE public.tasks t
        SET department_id = p.department_id
        FROM public.projects p
        WHERE t.project_id = p.id 
          AND t.department_id IS NULL 
          AND p.department_id IS NOT NULL;
      END $$;
    `);

    console.log('✓ Projects and tasks successfully backfilled across all organization departments.');

    console.log('\n3. Creating automated trigger for any new organizations created in the future...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.init_new_org_departments()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- Software Development
        INSERT INTO public.departments (
          org_id, name, description, purpose, color, status, is_deleted, module_configurations
        ) VALUES (
          NEW.id, 'Software Development', 'Engineering, platform architecture, and sprint delivery.',
          'Deliver high-velocity reliable software systems and feature releases.', '#FF6B4A', 'active', false,
          jsonb_build_object(
            'project_configuration', jsonb_build_object(
              'project_types', jsonb_build_array('Software Product', 'Sprint Release', 'Bug Resolution Workstream', 'Architecture Refactor'),
              'workflow_stages', jsonb_build_array('Backlog', 'Sprint Planning', 'In Development', 'Code Review', 'QA Testing', 'Released'),
              'metrics', jsonb_build_array('Velocity', 'Deliverables', 'Milestones')
            )
          )
        );

        -- Sales & Marketing
        INSERT INTO public.departments (
          org_id, name, description, purpose, color, status, is_deleted, module_configurations
        ) VALUES (
          NEW.id, 'Sales & Marketing', 'Campaigns, lead acquisition, brand growth, and client relationships.',
          'Expand market presence, acquire target customers, and manage outward deliverables.', '#60A5FA', 'active', false,
          jsonb_build_object(
            'project_configuration', jsonb_build_object(
              'project_types', jsonb_build_array('Marketing Campaign', 'Content Deliverable', 'Product Launch', 'Lead Gen Initiative'),
              'workflow_stages', jsonb_build_array('Campaign Strategy', 'Content Drafting', 'Creative Review', 'Live in Market', 'Performance Review'),
              'metrics', jsonb_build_array('Conversion', 'Reach', 'Deliverables')
            )
          )
        );

        -- Finance & Operations
        INSERT INTO public.departments (
          org_id, name, description, purpose, color, status, is_deleted, module_configurations
        ) VALUES (
          NEW.id, 'Finance & Operations', 'Fiscal governance, budget allocation, audits, and operational health.',
          'Maintain financial integrity, fiscal accuracy, and corporate compliance.', '#34D399', 'active', false,
          jsonb_build_object(
            'project_configuration', jsonb_build_object(
              'project_types', jsonb_build_array('Budget Planning', 'Audit & Compliance', 'Quarterly Reconciliation', 'Expense Optimization'),
              'workflow_stages', jsonb_build_array('Proposed', 'Budget Allocation', 'Fiscal Approval', 'Execution', 'Audited & Reconciled'),
              'metrics', jsonb_build_array('Budget Variance', 'Compliance Rate', 'Milestones')
            )
          )
        );

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_init_new_org_departments ON public.organizations;
      CREATE TRIGGER trg_init_new_org_departments
      AFTER INSERT ON public.organizations
      FOR EACH ROW
      EXECUTE FUNCTION public.init_new_org_departments();
    `);

    console.log('✓ Automated trigger trg_init_new_org_departments active.');

  } catch (err) {
    console.error('Backfill error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

backfillAllOrgs();
