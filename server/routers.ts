import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createConversation,
  createProject,
  deleteCsvAttachmentForUser,
  deleteWorkspaceDataForUser,
  deleteProjectForUser,
  exportWorkspaceForUser,
  getAttachmentsForConversation,
  getConversationForUser,
  listCsvAttachmentsForUser,
  getMessagesForConversation,
  getUserSettings,
  listConversationsForUser,
  listAttachmentsForUser,
  listProjectsForUser,
  renameCsvAttachmentForUser,
  renameConversation,
  setConversationProvider,
  setConversationProject,
  updateProjectForUser,
  updateUserSettings,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getProviderStatus } from "./modelProvider";

const conversationIdSchema = z.object({ conversationId: z.number().int().positive() });
const projectIdSchema = z.object({ projectId: z.number().int().positive() });
const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  fontSize: z.enum(["compact", "comfortable", "large"]).optional(),
  accent: z.enum(["lime", "sky", "violet"]).optional(),
  assistantMode: z.enum(["balanced", "study", "developer", "creative"]).optional(),
  preferredModel: z.string().trim().max(128).nullable().optional(),
  memoryEnabled: z.boolean().optional(),
  privacy: z.enum(["strict", "standard"]).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  providers: router({
    status: protectedProcedure.query(() => getProviderStatus()),
  }),
  workspace: router({
    settings: protectedProcedure.query(({ ctx }) => getUserSettings(ctx.user.id)),
    updateSettings: protectedProcedure
      .input(settingsSchema)
      .mutation(({ ctx, input }) => updateUserSettings(ctx.user.id, input)),
    export: protectedProcedure.query(({ ctx }) => exportWorkspaceForUser(ctx.user.id)),
    deleteData: protectedProcedure
      .input(z.object({ confirmation: z.literal("DELETE MY AXIS DATA") }))
      .mutation(async ({ ctx }) => {
        await deleteWorkspaceDataForUser(ctx.user.id);
        return { success: true } as const;
      }),
  }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => listProjectsForUser(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(140), description: z.string().trim().max(10_000).optional() }))
      .mutation(({ ctx, input }) => createProject(ctx.user.id, input.name, input.description)),
    update: protectedProcedure
      .input(projectIdSchema.extend({
        name: z.string().trim().min(1).max(140).optional(),
        description: z.string().trim().max(10_000).nullable().optional(),
        isPinned: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await updateProjectForUser(ctx.user.id, input.projectId, input);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        return project;
      }),
    delete: protectedProcedure.input(projectIdSchema).mutation(async ({ ctx, input }) => {
      await deleteProjectForUser(ctx.user.id, input.projectId);
      return { success: true } as const;
    }),
  }),
  files: router({
    list: protectedProcedure.query(({ ctx }) => listAttachmentsForUser(ctx.user.id)),
    listCsv: protectedProcedure.query(({ ctx }) => listCsvAttachmentsForUser(ctx.user.id)),
    renameCsv: protectedProcedure
      .input(z.object({ attachmentId: z.number().int().positive(), fileName: z.string().trim().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const attachment = await renameCsvAttachmentForUser(ctx.user.id, input.attachmentId, input.fileName);
        if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "CSV file not found" });
        return attachment;
      }),
    deleteCsv: protectedProcedure
      .input(z.object({ attachmentId: z.number().int().positive(), confirmation: z.literal("DELETE CSV") }))
      .mutation(async ({ ctx, input }) => {
        const attachment = await deleteCsvAttachmentForUser(ctx.user.id, input.attachmentId);
        if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "CSV file not found" });
        return { success: true } as const;
      }),
  }),
  conversations: router({
    list: protectedProcedure.query(({ ctx }) => listConversationsForUser(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ title: z.string().trim().max(255).optional(), projectId: z.number().int().positive().nullable().optional() }))
      .mutation(({ ctx, input }) => {
        const provider = getProviderStatus();
        return createConversation(ctx.user.id, input.title || "New conversation", input.projectId, provider.id, provider.model);
      }),
    get: protectedProcedure.input(conversationIdSchema).query(async ({ ctx, input }) => {
      const conversation = await getConversationForUser(ctx.user.id, input.conversationId);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

      const [chatMessages, conversationAttachments] = await Promise.all([
        getMessagesForConversation(ctx.user.id, input.conversationId),
        getAttachmentsForConversation(ctx.user.id, input.conversationId),
      ]);
      return { conversation, messages: chatMessages, attachments: conversationAttachments };
    }),
    rename: protectedProcedure
      .input(conversationIdSchema.extend({ title: z.string().trim().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await renameConversation(ctx.user.id, input.conversationId, input.title);
        if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
        return conversation;
      }),
    assignProject: protectedProcedure
      .input(conversationIdSchema.extend({ projectId: z.number().int().positive().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await setConversationProject(ctx.user.id, input.conversationId, input.projectId);
        if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation or project not found" });
        return conversation;
      }),
    selectProvider: protectedProcedure
      .input(conversationIdSchema.extend({ provider: z.enum(["omniroute", "gemini"]) }))
      .mutation(async ({ ctx, input }) => {
        const providerStatus = getProviderStatus();
        const allowed = providerStatus.eligibleProviders.some(provider => provider.id === input.provider);
        if (!allowed) throw new TRPCError({ code: "BAD_REQUEST", message: "That provider is not configured or approved for this workspace." });
        const model = providerStatus.eligibleProviders.find(provider => provider.id === input.provider)?.model ?? null;
        const conversation = await setConversationProvider(ctx.user.id, input.conversationId, input.provider, model);
        if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
        return conversation;
      }),
  }),
});

export type AppRouter = typeof appRouter;
