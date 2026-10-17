import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.js";
import { 
  createOrganization, 
  createJoinRequest, 
  approveJoinRequest, 
  provisionGoogleUserWorkspace,
  setupFreelancerWorkspace,
  setupOrganizationWorkspace,
  setupJoinOrganizationWorkspace
} from "./workspace.service.js";

export const auvrynRouter = router({
  // Legacy alias
  provisionGoogleUserWorkspace: protectedProcedure
    .mutation(async ({ ctx }) => {
      return await provisionGoogleUserWorkspace({
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        fullName: ctx.user.name || 'User'
      });
    }),

  // Explicit User-Selected Onboarding Endpoints
  setupFreelancer: protectedProcedure
    .input(z.object({
      skills: z.array(z.string()).optional(),
      portfolio: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      return await setupFreelancerWorkspace({
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        fullName: ctx.user.name || 'User',
        skills: input?.skills,
        portfolio: input?.portfolio,
      });
    }),

  setupOrganization: protectedProcedure
    .input(z.object({
      orgName: z.string().min(1, 'Organization name is required'),
      jobTitle: z.string().optional(),
      defaultCurrency: z.string().default('USD'),
    }))
    .mutation(async ({ ctx, input }) => {
      return await setupOrganizationWorkspace({
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        fullName: ctx.user.name || 'User',
        orgName: input.orgName,
        jobTitle: input.jobTitle,
        defaultCurrency: input.defaultCurrency,
      });
    }),

  setupJoinOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
      jobTitle: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await setupJoinOrganizationWorkspace({
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        fullName: ctx.user.name || 'User',
        organizationId: input.organizationId,
        jobTitle: input.jobTitle,
      });
    }),

  createOrganization: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      workspaceType: z.enum(["independent", "organization"]),
      jobTitle: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await createOrganization({
        userId: ctx.user.id,
        name: input.name,
        workspaceType: input.workspaceType,
        jobTitle: input.jobTitle
      });
    }),

  joinOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      departmentId: z.number(),
      jobTitle: z.string().min(1),
      message: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await createJoinRequest({
        userId: ctx.user.id,
        ...input
      });
    }),

  approveJoinRequest: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      assignedRole: z.enum([
        'administrator', 'director', 'senior_manager', 'manager',
        'team_lead', 'senior_employee', 'employee', 'intern', 'freelancer', 'owner'
      ]),
      reviewNotes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await approveJoinRequest({
        requestId: input.requestId,
        reviewerId: ctx.user.id,
        assignedRole: input.assignedRole,
        reviewNotes: input.reviewNotes
      });
    })
});
