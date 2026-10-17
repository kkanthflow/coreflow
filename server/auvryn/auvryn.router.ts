import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.js";
import { createOrganization, createJoinRequest, approveJoinRequest, provisionGoogleUserWorkspace } from "./workspace.service.js";
import { auvrynRoleEnum } from "../../drizzle/schema.js"; // This is just an enum mapping, zod will handle actual validation

export const auvrynRouter = router({
  provisionGoogleUserWorkspace: protectedProcedure
    .mutation(async ({ ctx }) => {
      return await provisionGoogleUserWorkspace({
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        fullName: ctx.user.name || 'User'
      });
    }),

  createOrganization: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      workspaceType: z.enum(["independent", "organization"]),
      jobTitle: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Assuming ctx.user is available via protectedProcedure
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
      // TODO: Role checking logic (Manager can only approve up to Team Lead, etc.)
      return await approveJoinRequest({
        requestId: input.requestId,
        reviewerId: ctx.user.id,
        assignedRole: input.assignedRole,
        reviewNotes: input.reviewNotes
      });
    })
});
