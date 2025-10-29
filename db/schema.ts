import { format } from "date-fns";
import { pgTable, text, timestamp, boolean, varchar, bigint, index, integer, jsonb, unique, uuid } from "drizzle-orm/pg-core";

// // AUTH SCHEMA
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const prompts = pgTable("prompts", {
    id: uuid("id").primaryKey().defaultRandom(),
    category: varchar("category", { length: 100 }).notNull(), // e.g. "tv_show"
    question: text("question").notNull(),
    frequency: varchar("frequency", { length: 50 }).default("single"), // e.g. "daily", "weekly", "monthly", "single"
    runs: integer("runs").default(1).notNull(),
    useWebSearchTool: boolean("use_web_search_tool").default(false), // null => both; true => web only; false => no-web only
    active: boolean("active").default(true),
    isHighlighted: boolean("is_highlighted").default(false),
    models: jsonb("models").notNull().$type<{ id: string }[]>(),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow(),
  });

export const models = pgTable("models", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(), // e.g. "gpt-5"
    provider: varchar("provider", { length: 100 }).notNull(), // e.g. "OpenAI"
    openWeights: boolean("open_weights").default(false),
    supportsObjectOutput: boolean("supports_object_output").default(false),
    reasoning: boolean("reasoning").default(false),
    hasWebAccess: boolean("has_web_access").default(false),
    nativeWebSearchTool: boolean("native_web_search_tool").default(false),
    temperature: boolean("temperature").default(false),
    knowledge: text("knowledge"),
    category: text("category").notNull()
}, (table) => [
  unique("idx_models_name_provider").on(table.name, table.provider),
]);

export const entities = pgTable(
    "entities",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      name: varchar("name", { length: 255 }).notNull().unique(), // e.g. "Breaking Bad"
      category: varchar("category", { length: 100 }),
      totalMentions: bigint("total_mentions", { mode: "number" }).default(0),
      lastMentionedAt: timestamp("last_mentioned_at"),
    },
    (table) => [
      index("idx_entities_category").on(table.category),
    ]
  );

  export const responses = pgTable(
    "responses",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      promptId: uuid("prompt_id")
        .references(() => prompts.id, { onDelete: "cascade" })
        .notNull(),
      modelId: uuid("model_id")
        .references(() => models.id, { onDelete: "cascade" })
        .notNull(),
      entityId: uuid("entity_id")
        .references(() => entities.id, { onDelete: "cascade" })
        .notNull(),
      webSearchSources: jsonb("web_search_sources"),
      responseText: text("response_text"),
      timestamp: timestamp("timestamp").defaultNow(),
    },
    (table) => [
      index("idx_responses_prompt_model_time").on(
        table.promptId,
        table.modelId,
        table.timestamp
      ),
      index("idx_responses_entity").on(table.entityId),
    ]
  );

  export const promptRuns = pgTable(
    "prompt_runs",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      promptId: uuid("prompt_id")
        .references(() => prompts.id, { onDelete: "cascade" })
        .notNull(),
      status: varchar("status", { length: 20 }).notNull().default("completed"), // processing | completed
      batchKey: varchar("batch_key", { length: 50 }).default(format(new Date(), 'yyyy-MM-dd')).notNull(),
      totalJobs: integer("total_jobs").notNull().default(0),
      successfulJobs: integer("successful_jobs").notNull().default(0),
      failedJobs: integer("failed_jobs").notNull().default(0),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    }
  )
  export const promptJobs = pgTable(
    "prompt_jobs",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      promptRunId: uuid("prompt_run_id")
        .references(() => promptRuns.id, { onDelete: "cascade" })
        .notNull(),
      modelId: uuid("model_id")
        .references(() => models.id, { onDelete: "cascade" })
        .notNull(),
      runIndex: bigint("run_index", { mode: "number" }).notNull(), // 0-based index for multiple runs
      usingWebSearch: boolean("used_web_search_tool").default(false),
      webSearchResults: jsonb("web_search_results"),
      status: varchar("status", { length: 20 }).notNull().default("queued"), // queued | processing | successful | failed | skipped
      errorMessage: text("error_message"),
      attemptCount: integer("attempt_count").default(0).notNull(),
      scheduledFor: timestamp("scheduled_for"),
      startedAt: timestamp("started_at"),
      finishedAt: timestamp("finished_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
      // Unique constraint to prevent duplicate jobs for same prompt/model/run/batch
      unique("idx_prompt_jobs_unique").on(table.promptRunId, table.modelId, table.runIndex, table.usingWebSearch),
      // Index for finding jobs to process
      index("idx_prompt_jobs_status").on(table.status, table.scheduledFor),
      index("idx_prompt_jobs_prompt").on(table.promptRunId, table.createdAt),
    ]
  );

export type Model = typeof models.$inferSelect
export type NewModel = typeof models.$inferInsert

export type Prompt = typeof prompts.$inferSelect
export type NewPrompt = typeof prompts.$inferInsert

export type Entity = typeof entities.$inferSelect
export type NewEntity = typeof entities.$inferInsert

export type Response = typeof responses.$inferSelect
export type NewResponse = typeof responses.$inferInsert

export type PromptJob = typeof promptJobs.$inferSelect
export type NewPromptJob = typeof promptJobs.$inferInsert