CREATE TYPE "public"."auvryn_role" AS ENUM('administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee', 'intern', 'freelancer', 'owner');--> statement-breakpoint
CREATE TYPE "public"."download_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('draft', 'in_review', 'approved', 'released', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('internal', 'client_shared', 'private');--> statement-breakpoint
CREATE TYPE "public"."org_join_status" AS ENUM('pending', 'under_review', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'admin';--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer,
	"actorUserId" integer,
	"actionType" varchar(255) NOT NULL,
	"resourceType" varchar(255) NOT NULL,
	"resourceId" varchar(255),
	"projectId" integer,
	"taskId" integer,
	"clientId" integer,
	"departmentId" integer,
	"description" text,
	"oldValues" jsonb,
	"newValues" jsonb,
	"metadata" jsonb DEFAULT '{}',
	"platform" varchar(50),
	"requestId" varchar(255),
	"success" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auvryn_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"mimeType" varchar(255),
	"createdBy" integer NOT NULL,
	"currentVersionId" integer,
	"visibility" "file_visibility" DEFAULT 'internal' NOT NULL,
	"status" "file_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auvryn_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auvryn_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"assigneeId" integer,
	"dueDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"fileId" integer NOT NULL,
	"fileVersionId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"status" "file_status" DEFAULT 'released' NOT NULL,
	"releasedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"clientId" integer,
	"requestedBy" integer NOT NULL,
	"fileVersionId" integer NOT NULL,
	"status" "download_status" DEFAULT 'pending' NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"reviewedBy" integer,
	"reviewedAt" timestamp,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "file_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"fileId" integer NOT NULL,
	"linkType" varchar(50) NOT NULL,
	"linkedId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"fileId" integer NOT NULL,
	"versionNumber" integer NOT NULL,
	"storagePath" text NOT NULL,
	"size" integer,
	"checksum" varchar(255),
	"uploadedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"departmentId" integer,
	"jobTitle" varchar(255),
	"message" text,
	"status" "org_join_status" DEFAULT 'pending' NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"reviewedBy" integer,
	"reviewedAt" timestamp,
	"assignedRole" "auvryn_role",
	"reviewNotes" text
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"organizationId" integer NOT NULL,
	"departmentId" integer,
	"jobTitle" varchar(255),
	"accessRole" "auvryn_role" NOT NULL,
	"isOwner" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"workspaceType" varchar(50),
	"ownerId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loginMethod" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lastSignedIn" timestamp;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_users_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_auvryn_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."auvryn_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_taskId_auvryn_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."auvryn_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auvryn_files" ADD CONSTRAINT "auvryn_files_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auvryn_files" ADD CONSTRAINT "auvryn_files_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auvryn_projects" ADD CONSTRAINT "auvryn_projects_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auvryn_tasks" ADD CONSTRAINT "auvryn_tasks_projectId_auvryn_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."auvryn_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auvryn_tasks" ADD CONSTRAINT "auvryn_tasks_assigneeId_users_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_releases" ADD CONSTRAINT "client_releases_fileId_auvryn_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."auvryn_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_releases" ADD CONSTRAINT "client_releases_fileVersionId_file_versions_id_fk" FOREIGN KEY ("fileVersionId") REFERENCES "public"."file_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_releases" ADD CONSTRAINT "client_releases_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_requests" ADD CONSTRAINT "download_requests_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_requests" ADD CONSTRAINT "download_requests_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_requests" ADD CONSTRAINT "download_requests_requestedBy_users_id_fk" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_requests" ADD CONSTRAINT "download_requests_fileVersionId_file_versions_id_fk" FOREIGN KEY ("fileVersionId") REFERENCES "public"."file_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_requests" ADD CONSTRAINT "download_requests_reviewedBy_users_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_fileId_auvryn_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."auvryn_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_auvryn_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."auvryn_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploadedBy_users_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_reviewedBy_users_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;