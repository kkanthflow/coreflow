// ==============================================================================
// AUVRYN — Global Capability Engine & Module Registry
// Covers all 13 Enterprise Capability Domains for Startups to MNCs
// ==============================================================================

export interface CapabilityItem {
  key: string;
  category: string;
  name: string;
  description: string;
  defaultModules: string[];
  icon: string;
}

export interface CapabilityDomain {
  category: string;
  label: string;
  description: string;
  icon: string;
  badgeColor: string;
  capabilities: CapabilityItem[];
}

export const CAPABILITY_DOMAINS: CapabilityDomain[] = [
  {
    category: 'Finance',
    label: 'Finance & Treasury',
    description: 'Fiscal planning, budget allocations, revenue, expenses, and financial reporting.',
    icon: 'CreditCard',
    badgeColor: 'emerald',
    capabilities: [
      { key: 'budget_planning', category: 'Finance', name: 'Budget Planning', description: 'Allocate, track, and forecast departmental fiscal allocations and variance.', defaultModules: ['budgets'], icon: 'PiggyBank' },
      { key: 'expense_management', category: 'Finance', name: 'Expense Management', description: 'Process vendor receipts, expense claims, and operational reimbursements.', defaultModules: ['expenses'], icon: 'Receipt' },
      { key: 'invoice_management', category: 'Finance', name: 'Invoice Management', description: 'Manage outbound billings, client payment terms, and aging receivables.', defaultModules: ['invoices'], icon: 'FileText' },
      { key: 'payment_management', category: 'Finance', name: 'Payment Management', description: 'Track bank disbursements, settlement reconciliations, and payout logs.', defaultModules: ['payments'], icon: 'DollarSign' },
      { key: 'accounts_payable', category: 'Finance', name: 'Accounts Payable', description: 'Manage supplier bills, purchase orders, and scheduled payment approvals.', defaultModules: ['payables'], icon: 'ArrowDownRight' },
      { key: 'accounts_receivable', category: 'Finance', name: 'Accounts Receivable', description: 'Audit incoming cash flows, client payment collections, and credit limits.', defaultModules: ['receivables'], icon: 'ArrowUpRight' },
      { key: 'financial_reporting', category: 'Finance', name: 'Financial Reporting', description: 'Consolidated balance sheets, P&L summaries, and margin analytics.', defaultModules: ['financial_reports'], icon: 'BarChart3' },
    ],
  },
  {
    category: 'Human Resources',
    label: 'Human Resources & Talent',
    description: 'Recruitment, employee lifecycle, performance appraisals, and attendance.',
    icon: 'Users',
    badgeColor: 'indigo',
    capabilities: [
      { key: 'recruitment', category: 'Human Resources', name: 'Recruitment & ATS', description: 'Manage job postings, applicant pipelines, and interview assessments.', defaultModules: ['recruitment'], icon: 'UserPlus' },
      { key: 'employee_management', category: 'Human Resources', name: 'Employee Management', description: 'Maintain personnel records, contract details, and departmental rosters.', defaultModules: ['employee_records'], icon: 'Users' },
      { key: 'attendance', category: 'Human Resources', name: 'Attendance & Tracking', description: 'Track working hours, shifts, attendance exceptions, and logs.', defaultModules: ['attendance'], icon: 'Clock' },
      { key: 'leave_management', category: 'Human Resources', name: 'Leave Management', description: 'Process paid time off, medical leave approvals, and holiday calendars.', defaultModules: ['leave_approvals'], icon: 'Calendar' },
      { key: 'performance_management', category: 'Human Resources', name: 'Performance & OKRs', description: 'Quarterly review cycles, performance appraisals, and OKR goal tracking.', defaultModules: ['performance_reviews'], icon: 'Award' },
      { key: 'training_development', category: 'Human Resources', name: 'Training & Development', description: 'Employee upskilling courses, internal certifications, and skill matrices.', defaultModules: ['training_hub'], icon: 'GraduationCap' },
    ],
  },
  {
    category: 'Engineering & Technology',
    label: 'Engineering & Technology',
    description: 'Software development, sprints, defect tracking, releases, and infrastructure.',
    icon: 'Code',
    badgeColor: 'cyan',
    capabilities: [
      { key: 'software_development', category: 'Engineering & Technology', name: 'Software Development', description: 'Track software engineering milestones, epics, and code deliverables.', defaultModules: ['dev_projects'], icon: 'Code' },
      { key: 'technical_project_management', category: 'Engineering & Technology', name: 'Technical Project Management', description: 'Coordinate architecture sprints, engineering roadmaps, and delivery schedules.', defaultModules: ['projects'], icon: 'Layers' },
      { key: 'sprint_management', category: 'Engineering & Technology', name: 'Sprint Management', description: 'Agile sprints, story point burn-down charts, and sprint retrospectives.', defaultModules: ['sprint_board'], icon: 'Zap' },
      { key: 'bug_tracking', category: 'Engineering & Technology', name: 'Bug & Defect Tracking', description: 'Log defects, triage severity levels, and monitor bug resolution lifecycles.', defaultModules: ['bug_tracker'], icon: 'Bug' },
      { key: 'quality_assurance', category: 'Engineering & Technology', name: 'Quality Assurance', description: 'Manage test cases, QA validation checklists, and release regression runs.', defaultModules: ['qa_suites'], icon: 'CheckCircle2' },
      { key: 'release_management', category: 'Engineering & Technology', name: 'Release Management', description: 'Stage deployments, version tags, changelog drafting, and release sign-offs.', defaultModules: ['releases'], icon: 'Rocket' },
      { key: 'infrastructure_management', category: 'Engineering & Technology', name: 'Infrastructure & DevOps', description: 'Oversee cloud resources, server health, CI/CD runners, and incident alerts.', defaultModules: ['infrastructure'], icon: 'Cpu' },
    ],
  },
  {
    category: 'Sales & Marketing',
    label: 'Sales & Marketing',
    description: 'Prospect pipelines, advertising campaigns, content calendars, and acquisition metrics.',
    icon: 'Target',
    badgeColor: 'amber',
    capabilities: [
      { key: 'lead_generation', category: 'Sales & Marketing', name: 'Lead Generation', description: 'Inbound prospect intake, lead qualification rules, and outreach funnels.', defaultModules: ['leads'], icon: 'UserCheck' },
      { key: 'sales_pipeline', category: 'Sales & Marketing', name: 'Sales Pipeline', description: 'Track deals from initial discovery to negotiation, proposal, and closed-won.', defaultModules: ['deals_pipeline'], icon: 'TrendingUp' },
      { key: 'customer_acquisition', category: 'Sales & Marketing', name: 'Customer Acquisition', description: 'Monitor CAC, conversion funnel velocity, and client onboarding handoffs.', defaultModules: ['acquisition_metrics'], icon: 'Users' },
      { key: 'campaign_management', category: 'Sales & Marketing', name: 'Campaign Management', description: 'Plan, budget, and launch multi-channel promotional and branding campaigns.', defaultModules: ['campaigns'], icon: 'Megaphone' },
      { key: 'content_planning', category: 'Sales & Marketing', name: 'Content Planning', description: 'Editorial calendars, copywriting reviews, creative briefs, and media drafts.', defaultModules: ['content_calendar'], icon: 'FileText' },
      { key: 'marketing_analytics', category: 'Sales & Marketing', name: 'Marketing Analytics', description: 'Evaluate campaign CTR, ROAS, channel effectiveness, and attribution.', defaultModules: ['marketing_reports'], icon: 'LineChart' },
    ],
  },
  {
    category: 'Operations',
    label: 'Operations & Procurement',
    description: 'Process governance, daily runbooks, resource allocation, and vendor contracts.',
    icon: 'Briefcase',
    badgeColor: 'blue',
    capabilities: [
      { key: 'daily_operations', category: 'Operations', name: 'Daily Operations', description: 'Coordinate daily business routines, runbooks, and SLA compliance tasks.', defaultModules: ['runbooks'], icon: 'CheckSquare' },
      { key: 'resource_allocation', category: 'Operations', name: 'Resource Allocation', description: 'Balance departmental staffing, equipment capacity, and physical assets.', defaultModules: ['resource_planning'], icon: 'Sliders' },
      { key: 'process_management', category: 'Operations', name: 'Process Management', description: 'Document SOPs, standardize workflows, and manage continuous improvement.', defaultModules: ['sop_library'], icon: 'BookOpen' },
      { key: 'vendor_management', category: 'Operations', name: 'Vendor Management', description: 'Track external supplier agreements, performance scores, and renewals.', defaultModules: ['vendors'], icon: 'Building' },
      { key: 'procurement', category: 'Operations', name: 'Procurement', description: 'Manage purchase requisitions, supplier quotes, and procurement orders.', defaultModules: ['procurement_orders'], icon: 'ShoppingCart' },
      { key: 'inventory_management', category: 'Operations', name: 'Inventory Management', description: 'Monitor physical and digital inventory stocks, locations, and reorder points.', defaultModules: ['inventory'], icon: 'Package' },
    ],
  },
  {
    category: 'Customer Success',
    label: 'Customer Success & Support',
    description: 'Client onboarding journeys, ticket queues, escalations, retention health, and NPS.',
    icon: 'Headphones',
    badgeColor: 'violet',
    capabilities: [
      { key: 'customer_onboarding', category: 'Customer Success', name: 'Customer Onboarding', description: 'New account onboarding journeys, milestone checklists, and go-live tracking.', defaultModules: ['client_onboarding'], icon: 'Smile' },
      { key: 'support_tickets', category: 'Customer Success', name: 'Support Tickets', description: 'Triage customer inquiries, assign response priorities, and resolve tickets.', defaultModules: ['tickets_queue'], icon: 'LifeBuoy' },
      { key: 'complaint_resolution', category: 'Customer Success', name: 'Complaint Resolution', description: 'Escalation pathways, root-cause investigations, and SLA resolutions.', defaultModules: ['escalations'], icon: 'AlertTriangle' },
      { key: 'customer_retention', category: 'Customer Success', name: 'Customer Retention', description: 'Track renewal health scores, churn risks, and customer satisfaction metrics.', defaultModules: ['retention_metrics'], icon: 'HeartHandshake' },
      { key: 'feedback_management', category: 'Customer Success', name: 'Feedback & NPS', description: 'Collect client feedback, survey scores, and feature suggestion logs.', defaultModules: ['feedback_surveys'], icon: 'MessageCircle' },
    ],
  },
  {
    category: 'Legal & Compliance',
    label: 'Legal & Compliance',
    description: 'Contract management, regulatory audits, corporate policies, and risk registers.',
    icon: 'Shield',
    badgeColor: 'red',
    capabilities: [
      { key: 'contract_lifecycle', category: 'Legal & Compliance', name: 'Contract Lifecycle', description: 'Draft, review, redline, and archive commercial and NDA agreements.', defaultModules: ['contracts'], icon: 'FileCheck' },
      { key: 'regulatory_compliance', category: 'Legal & Compliance', name: 'Regulatory Compliance', description: 'Ensure adherence to statutory, data privacy, and jurisdictional mandates.', defaultModules: ['compliance_checks'], icon: 'CheckCircle' },
      { key: 'policy_governance', category: 'Legal & Compliance', name: 'Policy Governance', description: 'Publish corporate policies, monitor employee acknowledgments, and audit.', defaultModules: ['policies'], icon: 'Book' },
      { key: 'risk_register', category: 'Legal & Compliance', name: 'Risk Register', description: 'Catalog enterprise risks, assign probability scores, and mitigation plans.', defaultModules: ['risk_matrix'], icon: 'AlertOctagon' },
    ],
  },
  {
    category: 'Information Security',
    label: 'Information Security',
    description: 'Vulnerability triage, credential audits, SOC2/ISO compliance, and incident response.',
    icon: 'Lock',
    badgeColor: 'rose',
    capabilities: [
      { key: 'security_audits', category: 'Information Security', name: 'Security Audits', description: 'Conduct internal vulnerability scans, penetration test tracking, and reports.', defaultModules: ['security_reviews'], icon: 'ShieldAlert' },
      { key: 'access_reviews', category: 'Information Security', name: 'Access Control Reviews', description: 'Audit user credentials, role privilege creep, and MFA compliance.', defaultModules: ['access_audits'], icon: 'Key' },
      { key: 'incident_response', category: 'Information Security', name: 'Incident Response', description: 'Manage security alerts, breach response workflows, and post-mortems.', defaultModules: ['security_incidents'], icon: 'Radio' },
    ],
  },
  {
    category: 'Research & Development',
    label: 'Research & Development',
    description: 'Exploratory prototypes, innovation pipelines, lab studies, and patents.',
    icon: 'Sparkles',
    badgeColor: 'purple',
    capabilities: [
      { key: 'feasibility_studies', category: 'Research & Development', name: 'Feasibility Studies', description: 'Investigate technical feasibility, market viability, and resource requirements.', defaultModules: ['r_and_d_studies'], icon: 'Search' },
      { key: 'innovation_pipeline', category: 'Research & Development', name: 'Innovation Pipeline', description: 'Incubate exploratory concepts, prototypes, and experiment results.', defaultModules: ['innovation_projects'], icon: 'Lightbulb' },
    ],
  },
  {
    category: 'Product Management',
    label: 'Product Management',
    description: 'Roadmaps, PRD authoring, feature prioritization matrix, and user discovery.',
    icon: 'Layers',
    badgeColor: 'sky',
    capabilities: [
      { key: 'product_strategy', category: 'Product Management', name: 'Product Strategy & PRDs', description: 'Author product requirement documents, user personas, and value props.', defaultModules: ['product_specs'], icon: 'Compass' },
      { key: 'roadmap_planning', category: 'Product Management', name: 'Roadmap Planning', description: 'Quarterly feature roadmaps, milestone timelines, and release alignments.', defaultModules: ['roadmap'], icon: 'Milestone' },
    ],
  },
  {
    category: 'Data Analytics',
    label: 'Data Analytics & BI',
    description: 'Executive dashboards, data pipelines, KPI trends, and governance.',
    icon: 'BarChart',
    badgeColor: 'teal',
    capabilities: [
      { key: 'business_intelligence', category: 'Data Analytics', name: 'Business Intelligence & KPIs', description: 'Curate executive dashboards, business intelligence datasets, and trends.', defaultModules: ['bi_dashboards'], icon: 'PieChart' },
    ],
  },
  {
    category: 'Administration',
    label: 'Administration & Workplace',
    description: 'Physical desk allocation, office facilities, passes, and internal equipment.',
    icon: 'Building2',
    badgeColor: 'orange',
    capabilities: [
      { key: 'facilities_management', category: 'Administration', name: 'Facilities & Workplace', description: 'Manage office assets, physical desks, security passes, and services.', defaultModules: ['facilities'], icon: 'Building' },
    ],
  },
  {
    category: 'Supply Chain & Logistics',
    label: 'Supply Chain & Logistics',
    description: 'Freight scheduling, warehouse logistics, supplier auditing, and fulfillment.',
    icon: 'Truck',
    badgeColor: 'stone',
    capabilities: [
      { key: 'logistics_management', category: 'Supply Chain & Logistics', name: 'Logistics & Supply Chain', description: 'Coordinate shipment logistics, cargo handling, and fulfillment tracking.', defaultModules: ['shipments'], icon: 'Truck' },
    ],
  },
];

// Flat lookup map of capabilities by key
export const ALL_CAPABILITIES_MAP = new Map<string, CapabilityItem>();
CAPABILITY_DOMAINS.forEach(domain => {
  domain.capabilities.forEach(cap => {
    ALL_CAPABILITIES_MAP.set(cap.key, cap);
  });
});

/**
 * Returns dynamic workspace modules active for a department based on its enabled capability keys.
 */
export function getActiveModulesForCapabilities(capabilityKeys: string[]): {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  capabilityKey: string;
}[] {
  const seenModuleIds = new Set<string>();
  const modules: {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    capabilityKey: string;
  }[] = [];

  for (const key of capabilityKeys) {
    const cap = ALL_CAPABILITIES_MAP.get(key);
    if (!cap) continue;

    for (const modId of cap.defaultModules) {
      if (!seenModuleIds.has(modId)) {
        seenModuleIds.add(modId);
        modules.push({
          id: modId,
          name: cap.name,
          description: cap.description,
          category: cap.category,
          icon: cap.icon,
          capabilityKey: key,
        });
      }
    }
  }

  return modules;
}

