// ==============================================================================
// AUVRYN — Dynamic Department Configuration & Module Recommendation Engine
// ==============================================================================

export interface DynamicQuestion {
  id: string;
  text: string;
  category: string;
  enabled: boolean;
  suggestedModule?: string;
  isCustom?: boolean;
}

export interface OperationalModule {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  isCore?: boolean;
  isCustom?: boolean;
  permission: 'all_members' | 'head_only' | 'managers_and_head';
  workflowStages: string[];
}

interface DomainRule {
  keywords: string[];
  questions: { text: string; category: string; suggestedModule: string }[];
  modules: {
    key: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    workflowStages: string[];
  }[];
}

const DOMAIN_RULES: DomainRule[] = [
  // 1. Growth, Strategy & Sales
  {
    keywords: ['growth', 'strategy', 'sales', 'lead', 'prospect', 'market', 'business development', 'bizdev', 'partnership', 'revenue', 'expansion'],
    questions: [
      { text: 'Does this department manage inbound and outbound lead generation?', category: 'Lead Generation', suggestedModule: 'lead_management' },
      { text: 'Will the team track prospect engagement, pipelines and outreach stages?', category: 'Prospect Tracking', suggestedModule: 'prospect_tracking' },
      { text: 'Does the team coordinate client follow-ups and touchpoints?', category: 'Follow-up Management', suggestedModule: 'followup_management' },
      { text: 'Are strategic partnerships, joint ventures and alliances tracked here?', category: 'Strategic Partnerships', suggestedModule: 'partnerships' },
      { text: 'Does the team perform market research, competitor and demographic analysis?', category: 'Market Research', suggestedModule: 'market_research' },
      { text: 'Should growth velocity, acquisition metrics and conversion KPIs be tracked?', category: 'Growth Performance', suggestedModule: 'growth_analytics' },
    ],
    modules: [
      { key: 'lead_management', name: 'Lead Management', description: 'Capture, qualify and manage inbound and outbound sales leads.', icon: 'Target', category: 'Sales', workflowStages: ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'] },
      { key: 'prospect_tracking', name: 'Prospect Tracking', description: 'Monitor client prospects, company profiles and outreach history.', icon: 'Users', category: 'Sales', workflowStages: ['Prospect', 'Discovery', 'Pitch', 'Decision'] },
      { key: 'followup_management', name: 'Follow-up Management', description: 'Schedule and enforce communication touchpoints and SLAs.', icon: 'Clock', category: 'Operations', workflowStages: ['Scheduled', 'Pending Call', 'Followed Up', 'Archived'] },
      { key: 'growth_analytics', name: 'Lead Analytics & Growth', description: 'Real-time metrics on conversion rates, funnel velocity and KPIs.', icon: 'TrendingUp', category: 'Analytics', workflowStages: ['Draft', 'Active Tracking', 'Reviewed'] },
      { key: 'partnerships', name: 'Strategic Partnerships', description: 'Manage alliance pipelines, contract milestones and partner commitments.', icon: 'Handshake', category: 'Strategy', workflowStages: ['Exploratory', 'Negotiating', 'Contracted', 'Active'] },
    ],
  },

  // 2. Product, Software & Engineering
  {
    keywords: ['product', 'engineering', 'software', 'tech', 'technology', 'developer', 'dev', 'architecture', 'qa', 'test', 'release', 'sprint', 'code'],
    questions: [
      { text: 'Does this department deliver software development projects and epics?', category: 'Development Projects', suggestedModule: 'dev_projects' },
      { text: 'Will agile sprints, iterations and backlog refinement be conducted?', category: 'Sprint Management', suggestedModule: 'sprint_management' },
      { text: 'Does the team triage, track and resolve bugs and quality issues?', category: 'Bug Tracking', suggestedModule: 'bug_tracking' },
      { text: 'Are product features, user stories and roadmap milestones managed here?', category: 'Feature Management', suggestedModule: 'feature_management' },
      { text: 'Does the team document technical architecture, ADRs and design specs?', category: 'Technical Architecture', suggestedModule: 'technical_architecture' },
      { text: 'Will production deployments, CI/CD releases and versions be scheduled?', category: 'Releases', suggestedModule: 'release_tracking' },
    ],
    modules: [
      { key: 'dev_projects', name: 'Development Projects', description: 'Track software engineering milestones, epics and repositories.', icon: 'Code', category: 'Engineering', workflowStages: ['Backlog', 'In Dev', 'Code Review', 'Testing', 'Deployed'] },
      { key: 'sprint_management', name: 'Sprint Management', description: 'Agile sprints, velocity planning, story point tracking and burndowns.', icon: 'Zap', category: 'Engineering', workflowStages: ['Planned', 'Active Sprint', 'Review', 'Retro', 'Closed'] },
      { key: 'bug_tracking', name: 'Bug & Defect Tracking', description: 'Triage defects, assign severity levels and track bug resolution.', icon: 'Bug', category: 'Quality', workflowStages: ['Reported', 'Investigating', 'In Fix', 'Verified', 'Resolved'] },
      { key: 'feature_management', name: 'Feature Management', description: 'Roadmap features, user stories and customer requirements.', icon: 'Layers', category: 'Product', workflowStages: ['Idea', 'Discovery', 'Specification', 'Building', 'Shipped'] },
      { key: 'release_tracking', name: 'Release Tracking', description: 'Version control changelogs, staging rollouts and release notes.', icon: 'Rocket', category: 'DevOps', workflowStages: ['Staging', 'Canary', 'General Availability', 'Rollback'] },
    ],
  },

  // 3. Accounts, Finance & Treasury
  {
    keywords: ['account', 'finance', 'billing', 'invoice', 'payment', 'budget', 'expense', 'tax', 'treasury', 'audit', 'payroll'],
    questions: [
      { text: 'Does this department maintain official financial records and journals?', category: 'Financial Records', suggestedModule: 'financial_records' },
      { text: 'Will department expenses, vendor receipts and reimbursements be processed?', category: 'Expenses', suggestedModule: 'expense_management' },
      { text: 'Does the team allocate and oversee annual/quarterly departmental budgets?', category: 'Budgets', suggestedModule: 'budget_management' },
      { text: 'Are client invoices, billing schedules and receivable collections handled?', category: 'Invoices', suggestedModule: 'invoice_management' },
      { text: 'Does the team reconcile bank payments, disbursements and transfers?', category: 'Payments', suggestedModule: 'payment_tracking' },
      { text: 'Will P&L statements, balance sheets and financial audits be generated?', category: 'Financial Reporting', suggestedModule: 'financial_reports' },
    ],
    modules: [
      { key: 'budget_management', name: 'Budget Management', description: 'Set and track department budgets, variance and fiscal allocations.', icon: 'PiggyBank', category: 'Finance', workflowStages: ['Proposed', 'Approved', 'Active', 'Reallocated', 'Closed'] },
      { key: 'expense_management', name: 'Expense Management', description: 'Record vendor expenses, employee reimbursements and receipts.', icon: 'Receipt', category: 'Finance', workflowStages: ['Submitted', 'Under Review', 'Approved', 'Reconciled'] },
      { key: 'invoice_management', name: 'Invoice Management', description: 'Track outbound billings, payment milestones and aging receivables.', icon: 'FileText', category: 'Finance', workflowStages: ['Draft', 'Sent', 'Partially Paid', 'Settled', 'Overdue'] },
      { key: 'payment_tracking', name: 'Payment Tracking', description: 'Audit payment confirmations, banking transfers and transaction logs.', icon: 'CreditCard', category: 'Finance', workflowStages: ['Initiated', 'Processing', 'Cleared', 'Disputed'] },
      { key: 'financial_reports', name: 'Financial Reports', description: 'Consolidated fiscal summaries, margin reports and audit exports.', icon: 'BarChart3', category: 'Reporting', workflowStages: ['Draft', 'Audited', 'Published'] },
    ],
  },

  // 4. Marketing, Creative & Content
  {
    keywords: ['market', 'campaign', 'creative', 'brand', 'content', 'social', 'media', 'seo', 'advertising', 'copywriting', 'design'],
    questions: [
      { text: 'Does this department produce and schedule multi-channel marketing campaigns?', category: 'Campaign Management', suggestedModule: 'campaigns' },
      { text: 'Will content calendars, blog posts, video briefs and copy be managed?', category: 'Content Production', suggestedModule: 'content_hub' },
      { text: 'Does the team curate and safeguard brand identity, typography and assets?', category: 'Brand Assets', suggestedModule: 'brand_assets' },
      { text: 'Are performance marketing, CPC metrics and campaign ROAS analyzed?', category: 'Marketing Analytics', suggestedModule: 'marketing_analytics' },
    ],
    modules: [
      { key: 'campaigns', name: 'Campaign Management', description: 'Plan, budget and execute omni-channel campaigns.', icon: 'Megaphone', category: 'Marketing', workflowStages: ['Brainstorm', 'Planning', 'In Execution', 'Evaluating', 'Completed'] },
      { key: 'content_hub', name: 'Content Production', description: 'Editorial calendars, copy drafting, creative reviews and approvals.', icon: 'FileCode', category: 'Content', workflowStages: ['Brief', 'Drafting', 'Design Review', 'Scheduled', 'Published'] },
      { key: 'marketing_analytics', name: 'Marketing Analytics', description: 'Monitor CTR, ROAS, acquisition cost and channel performance.', icon: 'LineChart', category: 'Analytics', workflowStages: ['Tracking', 'Review Required', 'Optimized'] },
    ],
  },

  // 5. People Operations, HR & Talent
  {
    keywords: ['people', 'hr', 'human resources', 'talent', 'recruit', 'hiring', 'onboard', 'culture', 'employee'],
    questions: [
      { text: 'Does this department manage recruitment pipelines, applicant tracking and interviews?', category: 'Talent Acquisition', suggestedModule: 'recruitment' },
      { text: 'Will new employee onboarding workflows and document verification be handled?', category: 'Onboarding', suggestedModule: 'onboarding' },
      { text: 'Does the team facilitate performance appraisals, 360 reviews and goal setting?', category: 'Performance Reviews', suggestedModule: 'performance' },
    ],
    modules: [
      { key: 'recruitment', name: 'Recruitment & ATS', description: 'Job openings, candidate pipelines and interview feedback.', icon: 'UserCheck', category: 'HR', workflowStages: ['Screening', 'Interviewing', 'Offer Extended', 'Hired', 'Archived'] },
      { key: 'onboarding', name: 'Employee Onboarding', description: 'Structured checklists, equipment assignment and initial compliance.', icon: 'GraduationCap', category: 'HR', workflowStages: ['Pre-joining', 'Day 1', 'Week 1', '30-Day Check', 'Completed'] },
      { key: 'performance', name: 'Performance & Appraisals', description: 'Quarterly reviews, goal setting (OKRs) and manager evaluations.', icon: 'Award', category: 'HR', workflowStages: ['Draft Goals', 'In Progress', 'Self Review', 'Manager Review', 'Finalized'] },
    ],
  },

  // 6. Operations, Administration & Facilities
  {
    keywords: ['operation', 'ops', 'admin', 'administration', 'facility', 'logistics', 'procurement', 'vendor', 'supply'],
    questions: [
      { text: 'Does this department manage physical office facilities and asset inventory?', category: 'Asset Management', suggestedModule: 'asset_management' },
      { text: 'Will vendor agreements, external contracts and suppliers be audited?', category: 'Vendor Management', suggestedModule: 'vendor_management' },
      { text: 'Are internal operational service requests, tickets and approvals resolved here?', category: 'Operations Helpdesk', suggestedModule: 'ops_requests' },
    ],
    modules: [
      { key: 'vendor_management', name: 'Vendor Management', description: 'Vendor directory, service level agreements and contract renewals.', icon: 'Building', category: 'Operations', workflowStages: ['Evaluating', 'Active Vendor', 'Under Review', 'Terminated'] },
      { key: 'asset_management', name: 'Asset Management', description: 'Hardware, software licenses, equipment allocation and warranties.', icon: 'Package', category: 'Operations', workflowStages: ['In Stock', 'Assigned', 'Maintenance', 'Retired'] },
      { key: 'ops_requests', name: 'Operations Helpdesk', description: 'Internal ticket queue for equipment, access and general requests.', icon: 'HelpCircle', category: 'Operations', workflowStages: ['Open', 'Assigned', 'In Progress', 'Resolved'] },
    ],
  },
];

// Always available core collaboration modules
export const CORE_MODULES: OperationalModule[] = [
  {
    key: 'tasks',
    name: 'Department Tasks',
    description: 'Prioritized task board and execution tracker for team deliverables.',
    icon: 'CheckSquare',
    category: 'Core',
    isCore: true,
    permission: 'all_members',
    workflowStages: ['To Do', 'In Progress', 'Review', 'Done'],
  },
  {
    key: 'projects',
    name: 'Department Projects',
    description: 'Multi-phase initiatives and departmental milestones.',
    icon: 'Briefcase',
    category: 'Core',
    isCore: true,
    permission: 'all_members',
    workflowStages: ['Planning', 'Active', 'On Hold', 'Completed'],
  },
  {
    key: 'chat',
    name: 'Department Chat',
    description: 'Dedicated real-time communication channel with file sharing.',
    icon: 'MessageSquare',
    category: 'Core',
    isCore: true,
    permission: 'all_members',
    workflowStages: ['Active'],
  },
  {
    key: 'meetings',
    name: 'Meetings',
    description: 'Departmental syncs, video conferences and agendas.',
    icon: 'Video',
    category: 'Core',
    isCore: true,
    permission: 'all_members',
    workflowStages: ['Scheduled', 'In Progress', 'Ended'],
  },
  {
    key: 'announcements',
    name: 'Announcements',
    description: 'Official department bulletins and pinned updates.',
    icon: 'Bell',
    category: 'Core',
    isCore: true,
    permission: 'all_members',
    workflowStages: ['Published'],
  },
];

/**
 * Dynamically analyzes department details and generates tailored configuration questions.
 * Works with any custom name or responsibility list.
 */
export function generateQuestionsForDepartment(
  name: string,
  description: string,
  purpose: string,
  responsibilities: string[] = []
): DynamicQuestion[] {
  const combinedText = `${name} ${description} ${purpose} ${responsibilities.join(' ')}`.toLowerCase();
  const matchedQuestions: DynamicQuestion[] = [];
  const addedIds = new Set<string>();

  // Check matching domains
  for (const rule of DOMAIN_RULES) {
    const isMatch = rule.keywords.some(kw => combinedText.includes(kw));
    if (isMatch) {
      for (const q of rule.questions) {
        const qId = `q_${q.suggestedModule}`;
        if (!addedIds.has(qId)) {
          addedIds.add(qId);
          matchedQuestions.push({
            id: qId,
            text: q.text,
            category: q.category,
            enabled: true,
            suggestedModule: q.suggestedModule,
          });
        }
      }
    }
  }

  // Also generate questions dynamically from custom responsibilities!
  for (const resp of responsibilities) {
    const cleanResp = resp.trim();
    if (cleanResp.length > 2) {
      const respKey = cleanResp.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24);
      const qId = `q_resp_${respKey}`;
      if (!addedIds.has(qId)) {
        addedIds.add(qId);
        matchedQuestions.push({
          id: qId,
          text: `Does the department require dedicated tracking for "${cleanResp}"?`,
          category: 'Responsibility Tracking',
          enabled: true,
          suggestedModule: `mod_${respKey}`,
        });
      }
    }
  }

  // Fallback questions for custom / unknown departments
  if (matchedQuestions.length === 0) {
    matchedQuestions.push(
      {
        id: 'q_custom_deliverables',
        text: `Does "${name}" produce specific regular deliverables that require custom workflow tracking?`,
        category: 'Custom Workflow',
        enabled: true,
        suggestedModule: 'custom_deliverables',
      },
      {
        id: 'q_custom_pipeline',
        text: 'Will this team manage multi-stage pipelines or review lifecycles?',
        category: 'Pipeline Tracking',
        enabled: true,
        suggestedModule: 'custom_pipeline',
      },
      {
        id: 'q_custom_resources',
        text: 'Does this department govern specialized assets, documents or client files?',
        category: 'Resource Governance',
        enabled: true,
        suggestedModule: 'custom_resources',
      }
    );
  }

  return matchedQuestions;
}

/**
 * Recommends operational modules based on department purpose, responsibilities, and answered questions.
 */
export function generateRecommendedModules(
  name: string,
  responsibilities: string[] = [],
  questions: DynamicQuestion[] = []
): OperationalModule[] {
  const combinedText = `${name} ${responsibilities.join(' ')}`.toLowerCase();
  const enabledModuleKeys = new Set<string>();

  // Collect from questions enabled by user
  for (const q of questions) {
    if (q.enabled && q.suggestedModule) {
      enabledModuleKeys.add(q.suggestedModule);
    }
  }

  const recommended: OperationalModule[] = [];
  const addedKeys = new Set<string>();

  // Always include core modules by default
  for (const core of CORE_MODULES) {
    addedKeys.add(core.key);
    recommended.push({ ...core });
  }

  // Find matching domain modules
  for (const rule of DOMAIN_RULES) {
    for (const mod of rule.modules) {
      if (enabledModuleKeys.has(mod.key) || rule.keywords.some(k => combinedText.includes(k))) {
        if (!addedKeys.has(mod.key)) {
          addedKeys.add(mod.key);
          recommended.push({
            ...mod,
            permission: 'all_members',
          });
        }
      }
    }
  }

  // Generate custom modules directly from custom responsibilities if answered yes!
  for (const q of questions) {
    if (q.enabled && q.suggestedModule && q.suggestedModule.startsWith('mod_')) {
      if (!addedKeys.has(q.suggestedModule)) {
        addedKeys.add(q.suggestedModule);
        const moduleName = q.category === 'Responsibility Tracking'
          ? q.text.replace(/Does the department require dedicated tracking for "(.*)"\?/i, '$1')
          : q.category;

        recommended.push({
          key: q.suggestedModule,
          name: moduleName || 'Operational Module',
          description: `Custom tracking and operational workflow for ${moduleName}.`,
          icon: 'FolderCheck',
          category: 'Custom',
          isCustom: true,
          permission: 'all_members',
          workflowStages: ['New', 'In Progress', 'Under Review', 'Completed'],
        });
      }
    }
  }

  // Handle fallback custom questions
  if (enabledModuleKeys.has('custom_deliverables') && !addedKeys.has('custom_deliverables')) {
    addedKeys.add('custom_deliverables');
    recommended.push({
      key: 'custom_deliverables',
      name: 'Deliverables & Milestones',
      description: `Operational milestone and deliverable tracker for ${name}.`,
      icon: 'Target',
      category: 'Custom',
      isCustom: true,
      permission: 'all_members',
      workflowStages: ['Planned', 'In Execution', 'Internal Review', 'Delivered'],
    });
  }

  if (enabledModuleKeys.has('custom_pipeline') && !addedKeys.has('custom_pipeline')) {
    addedKeys.add('custom_pipeline');
    recommended.push({
      key: 'custom_pipeline',
      name: 'Operations Pipeline',
      description: `Stage-by-stage operational workflow pipeline for ${name}.`,
      icon: 'GitPullRequest',
      category: 'Custom',
      isCustom: true,
      permission: 'all_members',
      workflowStages: ['Intake', 'Triaged', 'In Progress', 'Approval', 'Closed'],
    });
  }

  return recommended;
}
