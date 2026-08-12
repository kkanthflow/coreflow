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
