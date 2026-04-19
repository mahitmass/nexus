/**
 * @nexus/types — Shared TypeScript types
 * Agnostic primitives — rename per theme at the app layer only.
 * NEVER import from app-specific packages here.
 */

// ─── Utility ─────────────────────────────────────────────────
export type Nullable<T> = T | null;
export type Maybe<T> = T | undefined;
export type ID = string;
export type ISODateString = string;
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// ─── API Envelope ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: ApiError;
  requestId?: string;
  timestamp: ISODateString;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

// ─── Auth & Users ─────────────────────────────────────────────
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "VIEWER";
export type Plan = "FREE" | "PRO" | "ENTERPRISE";

export interface User {
  id: ID;
  externalId: Nullable<string>;
  email: string;
  name: Nullable<string>;
  role: UserRole;
  organizationId: Nullable<ID>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Organization {
  id: ID;
  name: string;
  slug: string;
  plan: Plan;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresAt: ISODateString;
}

// ─── Core Domain (AGNOSTIC) ───────────────────────────────────
// Rename at the frontend display layer only — not here.
export type RecordStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "ARCHIVED";

export interface NexusRecord {
  id: ID;
  title: string;
  description: Nullable<string>;
  status: RecordStatus;
  metadata: Nullable<Record<string, JSONValue>>;
  numericValue: Nullable<number>;
  tags: string[];
  userId: ID;
  organizationId: Nullable<ID>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RecordEvent {
  id: ID;
  recordId: ID;
  type: string;
  payload: Nullable<Record<string, JSONValue>>;
  createdAt: ISODateString;
}

export interface Attachment {
  id: ID;
  recordId: ID;
  url: string;
  publicId: string;
  type: "image" | "document" | "video";
  size: number;
  createdAt: ISODateString;
}

// ─── AI & LLM ─────────────────────────────────────────────────
export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface AiMessage {
  id: ID;
  sessionId: ID;
  role: MessageRole;
  content: string;
  metadata: Nullable<{
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    toolCalls?: ToolCall[];
  }>;
  createdAt: ISODateString;
}

export interface AiSession {
  id: ID;
  userId: ID;
  title: Nullable<string>;
  messages: AiMessage[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, JSONValue>;
  output?: JSONValue;
}

export interface InferenceRequest {
  prompt: string;
  sessionId?: ID;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface InferenceResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  toolCalls?: ToolCall[];
}

// ─── RAG ─────────────────────────────────────────────────────
export interface RAGDocument {
  id: string;
  content: string;
  metadata: Record<string, JSONValue>;
  score?: number;
}

export interface RAGQuery {
  query: string;
  topK?: number;
  filter?: Record<string, JSONValue>;
  namespace?: string;
}

// ─── Analytics / Dashboard ───────────────────────────────────
export interface KPIMetric {
  id: string;
  label: string;           // Theme-specific label set at app layer
  value: number;
  previousValue?: number;
  unit?: string;
  trend?: "up" | "down" | "flat";
  changePercent?: number;
}

export interface TimeSeriesPoint {
  timestamp: ISODateString;
  value: number;
  label?: string;
}

export interface ChartDataset {
  id: string;
  label: string;
  data: TimeSeriesPoint[];
  color?: string;
}

// ─── Real-time / WebSocket events ────────────────────────────
export type WebSocketEventType =
  | "record:created"
  | "record:updated"
  | "record:deleted"
  | "metric:update"
  | "ai:stream_chunk"
  | "ai:stream_end"
  | "notification:new";

export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  userId?: ID;
  organizationId?: ID;
  timestamp: ISODateString;
}

// ─── Notifications ────────────────────────────────────────────
export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: ISODateString;
}

// ─── Billing ─────────────────────────────────────────────────
export interface Subscription {
  id: ID;
  organizationId: ID;
  plan: Plan;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodEnd: Nullable<ISODateString>;
}
