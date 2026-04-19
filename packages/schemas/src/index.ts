/**
 * @nexus/schemas — Shared Zod validation schemas
 * Used by: web frontend, mobile app, api-gateway, ai-service (via JSON).
 * Agnostic — no domain-specific field names.
 */
import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────
export const IdSchema = z.string().cuid();
export const ISODateSchema = z.string().datetime();
export const JSONValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JSONValueSchema),
    z.record(JSONValueSchema),
  ])
);

// ─── Pagination ───────────────────────────────────────────────
export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().max(200).optional(),
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

// ─── Auth ─────────────────────────────────────────────────────
export const SignUpSchema = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, "Must contain uppercase")
      .regex(/[0-9]/, "Must contain number")
      .regex(/[^A-Za-z0-9]/, "Must contain special character"),
    confirmPassword: z.string(),
    name: z.string().min(2).max(100).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof SignInSchema>;

// ─── Core Record (AGNOSTIC) ───────────────────────────────────
export const RecordStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "PENDING",
  "ARCHIVED",
]);

export const CreateRecordSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: RecordStatusSchema.default("ACTIVE"),
  metadata: z.record(JSONValueSchema).optional(),
  numericValue: z.number().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
});
export type CreateRecordInput = z.infer<typeof CreateRecordSchema>;

export const UpdateRecordSchema = CreateRecordSchema.partial();
export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>;

export const RecordFilterSchema = PaginationParamsSchema.extend({
  status: RecordStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  userId: IdSchema.optional(),
  organizationId: IdSchema.optional(),
  dateFrom: ISODateSchema.optional(),
  dateTo: ISODateSchema.optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});
export type RecordFilter = z.infer<typeof RecordFilterSchema>;

// ─── AI Inference ─────────────────────────────────────────────
export const InferenceRequestSchema = z.object({
  prompt: z.string().min(1).max(32000),
  sessionId: IdSchema.optional(),
  model: z
    .enum([
      "gpt-4o",
      "gpt-4o-mini",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ])
    .default("gpt-4o-mini"),
  maxTokens: z.number().int().min(1).max(16000).default(1000),
  temperature: z.number().min(0).max(2).default(0.7),
  stream: z.boolean().default(false),
  systemPrompt: z.string().max(8000).optional(),
});
export type InferenceRequest = z.infer<typeof InferenceRequestSchema>;

export const RAGQuerySchema = z.object({
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(20).default(5),
  filter: z.record(JSONValueSchema).optional(),
  namespace: z.string().optional(),
});
export type RAGQuery = z.infer<typeof RAGQuerySchema>;

// ─── File Upload ─────────────────────────────────────────────
export const UploadSchema = z.object({
  recordId: IdSchema.optional(),
  type: z.enum(["image", "document", "video"]),
  sizeBytes: z.number().int().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.string(),
  filename: z.string().max(255),
});
export type UploadInput = z.infer<typeof UploadSchema>;

// ─── Webhook payloads (Stripe, Clerk, etc.) ──────────────────
export const StripeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.record(JSONValueSchema),
  }),
  livemode: z.boolean(),
});

// ─── Notification ─────────────────────────────────────────────
export const CreateNotificationSchema = z.object({
  userId: IdSchema,
  type: z.enum(["info", "success", "warning", "error"]),
  title: z.string().max(200),
  message: z.string().max(1000),
  actionUrl: z.string().url().optional(),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

// ─── Organisation ─────────────────────────────────────────────
export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
