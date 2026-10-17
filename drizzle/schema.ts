import { serial, pgEnum, pgTable, text, timestamp, varchar, boolean, integer, jsonb } from "drizzle-orm/pg-core";

// ==========================================
// ENUMS
// ==========================================
export const roleEnum = pgEnum("role", [
  "student",
  "faculty",
  "club_admin",
  "placement_cell",
  "department_admin",
  "college_administrator",
  "super_admin",
  "admin"
]);

export const eventTypeEnum = pgEnum("event_type", ["workshop", "seminar", "hackathon", "cultural", "sports", "other"]);
export const jobTypeEnum = pgEnum("job_type", ["internship", "full_time", "part_time"]);
export const lostFoundCategoryEnum = pgEnum("lost_found_category", ["electronics", "documents", "clothing", "other"]);
export const lostFoundStatusEnum = pgEnum("lost_found_status", ["lost", "found", "returned"]);

// ==========================================
// AUVRYN ENUMS
// ==========================================
export const auvrynRoleEnum = pgEnum('auvryn_role', ['administrator','director','senior_manager','manager','team_lead','senior_employee','employee','intern','freelancer','owner']);
export const orgJoinStatusEnum = pgEnum('org_join_status', ['pending','under_review','approved','rejected','cancelled']);
export const fileVisibilityEnum = pgEnum('file_visibility', ['internal','client_shared','private']);
export const fileStatusEnum = pgEnum('file_status', ['draft','in_review','approved','released','superseded']);
export const downloadStatusEnum = pgEnum('download_status', ['pending','approved','rejected','expired']);

// ==========================================
// USERS
// ==========================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(), // Auth provider ID
  name: text("name"), // nullable, may be set later
  email: varchar("email", { length: 320 }).unique(), // nullable, may be set later
  role: roleEnum("role").default("student").notNull(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  department: varchar("department", { length: 100 }),
  year: integer("year"),
  skills: jsonb("skills"), // Array of skill strings
  githubUrl: text("githubUrl"),
  linkedinUrl: text("linkedinUrl"),
  portfolioUrl: text("portfolioUrl"),
  loginMethod: varchar("loginMethod", { length: 100 }), // optional login method
  onboardingStatus: varchar("onboardingStatus", { length: 50 }).default("workspace_required"),
  lastSignedIn: timestamp("lastSignedIn"), // optional timestamp of last sign‑in
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ==========================================
// HOME FEED (Posts)
// ==========================================
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaUrls: jsonb("mediaUrls"), // Array of media URLs
  isPinned: boolean("isPinned").default(false),
  isOfficial: boolean("isOfficial").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: integer("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==========================================
// EVENTS
// ==========================================
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  eventType: eventTypeEnum("eventType").default("other").notNull(),
  organizerId: integer("organizerId").notNull().references(() => users.id),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  location: varchar("location", { length: 255 }),
  coverImageUrl: text("coverImageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const eventRegistrations = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  hasAttended: boolean("hasAttended").default(false),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
});

// ==========================================
// CLUB HUB
// ==========================================
export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logoUrl: text("logoUrl"),
  adminId: integer("adminId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const clubMembers = pgTable("club_members", {
  id: serial("id").primaryKey(),
  clubId: integer("clubId").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).default("member").notNull(), // committee, member
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

// ==========================================
// CAREER HUB
// ==========================================
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  jobType: jobTypeEnum("jobType").notNull(),
  description: text("description").notNull(),
  eligibilityCriteria: text("eligibilityCriteria"),
  deadline: timestamp("deadline"),
  postedById: integer("postedById").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==========================================
// TEAM FINDER
// ==========================================
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  projectCategory: varchar("projectCategory", { length: 100 }), // hackathon, research, etc.
  requiredSkills: jsonb("requiredSkills"),
  creatorId: integer("creatorId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==========================================
// LOST & FOUND
// ==========================================
export const lostAndFoundItems = pgTable("lost_and_found_items", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: lostFoundCategoryEnum("category").notNull(),
  status: lostFoundStatusEnum("status").default("lost").notNull(),
  location: varchar("location", { length: 255 }),
  imageUrl: text("imageUrl"),
  reporterId: integer("reporterId").notNull().references(() => users.id),
  dateReported: timestamp("dateReported").defaultNow().notNull(),
});

// ==========================================
// CAMPUS PROJECTS
// ==========================================
export const campusProjects = pgTable("campus_projects", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  techStack: jsonb("techStack"),
  githubUrl: text("githubUrl"),
  liveDemoUrl: text("liveDemoUrl"),
  coverImageUrl: text("coverImageUrl"),
  ownerId: integer("ownerId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==========================================
// SEMESTER FEEDBACK
// ==========================================
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  department: varchar("department", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  facultyName: varchar("facultyName", { length: 255 }).notNull(),
  rating: integer("rating").notNull(),
  comments: text("comments"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  // Anonymous submission, so no userId
});

// ==========================================
// ACHIEVEMENTS
// ==========================================
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  clubId: integer("clubId").references(() => clubs.id, { onDelete: "cascade" }),
  imageUrl: text("imageUrl"),
  awardedAt: timestamp("awardedAt").defaultNow().notNull(),
});

// ==========================================
// NOTIFICATIONS
// ==========================================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
// (Add other types as needed)


// ==========================================
// AUVRYN CORE ORGANIZATIONS & MEMBERS
// ==========================================
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  workspaceType: varchar('workspaceType', { length: 50 }),
  ownerId: integer('ownerId').notNull().references(() => users.id),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const organizationMemberships = pgTable('organization_memberships', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: integer('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  departmentId: integer('departmentId').references(() => departments.id),
  jobTitle: varchar('jobTitle', { length: 255 }),
  accessRole: auvrynRoleEnum('accessRole').notNull(),
  isOwner: boolean('isOwner').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const organizationJoinRequests = pgTable('organization_join_requests', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  departmentId: integer('departmentId').references(() => departments.id),
  jobTitle: varchar('jobTitle', { length: 255 }),
  message: text('message'),
  status: orgJoinStatusEnum('status').default('pending').notNull(),
  requestedAt: timestamp('requestedAt').defaultNow().notNull(),
  reviewedBy: integer('reviewedBy').references(() => users.id),
  reviewedAt: timestamp('reviewedAt'),
  assignedRole: auvrynRoleEnum('assignedRole'),
  reviewNotes: text('reviewNotes'),
});

// ==========================================
// AUVRYN PROJECTS & TASKS
// ==========================================
export const auvrynProjects = pgTable('auvryn_projects', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const auvrynTasks = pgTable('auvryn_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('projectId').notNull().references(() => auvrynProjects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  assigneeId: integer('assigneeId').references(() => users.id),
  dueDate: timestamp('dueDate'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ==========================================
// AUVRYN FILES
// ==========================================
export const auvrynFiles = pgTable('auvryn_files', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  mimeType: varchar('mimeType', { length: 255 }),
  createdBy: integer('createdBy').notNull().references(() => users.id),
  currentVersionId: integer('currentVersionId'),
  visibility: fileVisibilityEnum('visibility').default('internal').notNull(),
  status: fileStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const fileVersions = pgTable('file_versions', {
  id: serial('id').primaryKey(),
  fileId: integer('fileId').notNull().references(() => auvrynFiles.id, { onDelete: 'cascade' }),
  versionNumber: integer('versionNumber').notNull(),
  storagePath: text('storagePath').notNull(),
  size: integer('size'),
  checksum: varchar('checksum', { length: 255 }),
  uploadedBy: integer('uploadedBy').notNull().references(() => users.id),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const fileLinks = pgTable('file_links', {
  id: serial('id').primaryKey(),
  fileId: integer('fileId').notNull().references(() => auvrynFiles.id, { onDelete: 'cascade' }),
  linkType: varchar('linkType', { length: 50 }).notNull(),
  linkedId: integer('linkedId').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ==========================================
// AUVRYN CLIENT RELEASES & DOWNLOADS
// ==========================================
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const clientReleases = pgTable('client_releases', {
  id: serial('id').primaryKey(),
  fileId: integer('fileId').notNull().references(() => auvrynFiles.id, { onDelete: 'cascade' }),
  fileVersionId: integer('fileVersionId').notNull().references(() => fileVersions.id, { onDelete: 'cascade' }),
  clientId: integer('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  status: fileStatusEnum('status').default('released').notNull(),
  releasedAt: timestamp('releasedAt').defaultNow().notNull(),
});

export const downloadRequests = pgTable('download_requests', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  clientId: integer('clientId').references(() => clients.id),
  requestedBy: integer('requestedBy').notNull().references(() => users.id),
  fileVersionId: integer('fileVersionId').notNull().references(() => fileVersions.id, { onDelete: 'cascade' }),
  status: downloadStatusEnum('status').default('pending').notNull(),
  requestedAt: timestamp('requestedAt').defaultNow().notNull(),
  reviewedBy: integer('reviewedBy').references(() => users.id),
  reviewedAt: timestamp('reviewedAt'),
  expiresAt: timestamp('expiresAt'),
});

// ==========================================
// AUVRYN AUDIT LOGS
// ==========================================
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').references(() => organizations.id),
  actorUserId: integer('actorUserId').references(() => users.id),
  actionType: varchar('actionType', { length: 255 }).notNull(),
  resourceType: varchar('resourceType', { length: 255 }).notNull(),
  resourceId: varchar('resourceId', { length: 255 }),
  projectId: integer('projectId').references(() => auvrynProjects.id),
  taskId: integer('taskId').references(() => auvrynTasks.id),
  clientId: integer('clientId').references(() => clients.id),
  departmentId: integer('departmentId').references(() => departments.id),
  description: text('description'),
  oldValues: jsonb('oldValues'),
  newValues: jsonb('newValues'),
  metadata: jsonb('metadata').default('{}'),
  platform: varchar('platform', { length: 50 }),
  requestId: varchar('requestId', { length: 255 }),
  success: boolean('success').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ==========================================
// AUVRYN SUBSCRIPTIONS & RAZORPAY BILLING
// ==========================================
export const subscriptionPlans = pgTable('subscription_plans', {
  id: varchar('id', { length: 64 }).primaryKey(), // 'freelancer_monthly', 'freelancer_yearly', etc.
  tier: varchar('tier', { length: 32 }).notNull(), // 'freelancer', 'starter', 'pro'
  interval: varchar('interval', { length: 16 }).notNull(), // 'monthly', 'yearly'
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  priceInr: integer('price_inr').notNull(),
  razorpayPlanId: varchar('razorpay_plan_id', { length: 128 }),
  maxSeats: integer('max_seats'),
  maxInvoicesPerMonth: integer('max_invoices_per_month'),
  maxActiveProjects: integer('max_active_projects'),
  maxMeetingsPerMonth: integer('max_meetings_per_month'),
  analyticsTier: varchar('analytics_tier', { length: 32 }).default('basic').notNull(),
  features: jsonb('features'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  organizationId: varchar('organization_id', { length: 64 }),
  workspaceType: varchar('workspace_type', { length: 32 }).default('independent').notNull(),
  planTier: varchar('plan_tier', { length: 32 }).notNull(),
  planInterval: varchar('plan_interval', { length: 16 }).notNull(),
  planId: varchar('plan_id', { length: 64 }).references(() => subscriptionPlans.id),
  razorpaySubscriptionId: varchar('razorpay_subscription_id', { length: 128 }).unique().notNull(),
  razorpayPlanId: varchar('razorpay_plan_id', { length: 128 }),
  razorpayCustomerId: varchar('razorpay_customer_id', { length: 128 }),
  status: varchar('status', { length: 32 }).default('created').notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  endedAt: timestamp('ended_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  totalCount: integer('total_count').default(12),
  paidCount: integer('paid_count').default(0),
  shortUrl: text('short_url'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptionPayments = pgTable('subscription_payments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  subscriptionId: varchar('subscription_id', { length: 64 }).references(() => subscriptions.id),
  razorpaySubscriptionId: varchar('razorpay_subscription_id', { length: 128 }).notNull(),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 128 }).unique().notNull(),
  razorpayOrderId: varchar('razorpay_order_id', { length: 128 }),
  razorpayInvoiceId: varchar('razorpay_invoice_id', { length: 128 }),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 10 }).default('INR').notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  method: varchar('method', { length: 32 }),
  errorCode: varchar('error_code', { length: 128 }),
  errorDescription: text('error_description'),
  capturedAt: timestamp('captured_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscriptionWebhookEvents = pgTable('subscription_webhook_events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  eventId: varchar('event_id', { length: 128 }).unique().notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  entityId: varchar('entity_id', { length: 128 }),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 32 }).default('processed').notNull(),
  errorMessage: text('error_message'),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customDevelopmentInquiries = pgTable('custom_development_inquiries', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 255 }).notNull(),
  businessEmail: varchar('business_email', { length: 320 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  preferredContactMethod: varchar('preferred_contact_method', { length: 32 }).notNull(),
  projectDescription: text('project_description').notNull(),
  estimatedBudget: varchar('estimated_budget', { length: 64 }),
  status: varchar('status', { length: 32 }).default('new').notNull(),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type SubscriptionWebhookEvent = typeof subscriptionWebhookEvents.$inferSelect;
export type CustomDevelopmentInquiry = typeof customDevelopmentInquiries.$inferSelect;

