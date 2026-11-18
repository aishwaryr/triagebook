import "server-only";

import { createGroq } from "@ai-sdk/groq";
import {
  APICallError,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  RetryError,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { and, count, eq, gte, ne } from "drizzle-orm";
import type { z } from "zod";

import { db } from "@/db";
import { aiCalls } from "@/db/schema";
import {
  AI_APP_DAILY_LIMIT,
  AI_FAILURE_MESSAGES,
  AI_USER_DAILY_LIMIT,
  type AiFailureReason,
  type AiFeature,
  type AiResult,
} from "@/lib/ai";

/** Groq model used by every AI feature: free tier, strict JSON Schema output. */
export const AI_MODEL_ID = "openai/gpt-oss-20b";

/** A model call that takes longer than this is aborted and reported as "timeout". */
const AI_TIMEOUT_MS = 20_000;

/** Model id written to `ai_calls` when the mock model answers. */
const MOCK_MODEL_ID = "mock";

/**
 * Type: one structured-output AI task.
 * `schema` must be a `z.object` with every field required: Groq's strict mode
 * rejects optional fields, so use `.nullable()` for "may be missing".
 */
export type AiTask<T> = {
  feature: AiFeature;
  userId: string;
  /** Bump when the prompt or schema changes; stored on every call. */
  promptVersion: string;
  schema: z.ZodType<T>;
  /** Instructions. User text never goes here, only in `prompt`. */
  system: string;
  /** The user's text, delimited by the caller. */
  prompt: string;
  /**
   * The answer the mock model gives when `AI_MOCK=1` (Playwright, CI).
   * Return an object for a valid answer, or a string to send raw text (e.g. broken JSON).
   */
  mock: (prompt: string) => unknown;
};

/** True when tests asked for the mock model; never in a Vercel production deploy. */
function isMockMode() {
  return process.env.AI_MOCK === "1" && process.env.VERCEL_ENV !== "production";
}

/** Start of the current UTC day; quotas reset at this moment. */
function startOfUtcDay(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** A mock model that answers with `task.mock(prompt)` and fixed token usage. */
function mockModel(task: AiTask<unknown>): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const answer = task.mock(task.prompt);
      const text = typeof answer === "string" ? answer : JSON.stringify(answer);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 100,
            noCache: 100,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 50, text: 50, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}

/** The model for a task: the mock in tests, Groq otherwise, or null when no key is set. */
function pickModel(
  task: AiTask<unknown>,
): { model: LanguageModel; modelId: string } | null {
  if (isMockMode()) {
    return { model: mockModel(task), modelId: MOCK_MODEL_ID };
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }
  return { model: createGroq({ apiKey })(AI_MODEL_ID), modelId: AI_MODEL_ID };
}

/**
 * Reserves a quota slot: inserts a pending `ai_calls` row, then counts today's rows.
 * Insert-then-count, not count-then-insert: two parallel requests both see each
 * other's rows, so the quota can't be overshot (at worst both are rejected).
 * Returns the row id, or null when over a quota (the row is marked "rejected").
 */
async function reserveCall(
  task: AiTask<unknown>,
  modelId: string,
): Promise<string | null> {
  const [call] = await db
    .insert(aiCalls)
    .values({
      userId: task.userId,
      feature: task.feature,
      model: modelId,
      promptVersion: task.promptVersion,
    })
    .returning({ id: aiCalls.id });

  // Rejected rows never reached the model, so they don't use up the quota.
  const countsToday = and(
    gte(aiCalls.createdAt, startOfUtcDay()),
    ne(aiCalls.status, "rejected"),
  );
  const [[forUser], [forApp]] = await Promise.all([
    db
      .select({ n: count() })
      .from(aiCalls)
      .where(and(countsToday, eq(aiCalls.userId, task.userId))),
    db.select({ n: count() }).from(aiCalls).where(countsToday),
  ]);

  if (forUser.n > AI_USER_DAILY_LIMIT || forApp.n > AI_APP_DAILY_LIMIT) {
    await db
      .update(aiCalls)
      .set({ status: "rejected", errorCode: "quota" })
      .where(eq(aiCalls.id, call.id));
    return null;
  }
  return call.id;
}

/** Writes the outcome of a reserved call. A logging failure never hides the AI result. */
async function finishCall(
  callId: string,
  outcome: {
    status: "ok" | "error";
    errorCode?: AiFailureReason;
    usage?: LanguageModelUsage;
    latencyMs: number;
  },
) {
  try {
    await db
      .update(aiCalls)
      .set({
        status: outcome.status,
        errorCode: outcome.errorCode ?? null,
        inputTokens: outcome.usage?.inputTokens ?? null,
        outputTokens: outcome.usage?.outputTokens ?? null,
        latencyMs: Math.round(outcome.latencyMs),
      })
      .where(eq(aiCalls.id, callId));
  } catch (error) {
    console.error("ai_calls update failed", error);
  }
}

/** Maps an AI SDK error to a failure reason. */
function classifyError(error: unknown): AiFailureReason {
  // After the retries run out, the SDK wraps the last error in a RetryError.
  const cause = RetryError.isInstance(error) ? error.lastError : error;

  if (
    NoObjectGeneratedError.isInstance(cause) ||
    NoOutputGeneratedError.isInstance(cause)
  ) {
    return "invalid_output";
  }
  if (APICallError.isInstance(cause) && cause.statusCode === 429) {
    return "busy";
  }
  if (
    cause instanceof Error &&
    (cause.name === "TimeoutError" || cause.name === "AbortError")
  ) {
    return "timeout";
  }
  return "error";
}

/** Builds a failure result with its user-facing message. */
function fail(reason: AiFailureReason): {
  ok: false;
  reason: AiFailureReason;
  message: string;
} {
  return { ok: false, reason, message: AI_FAILURE_MESSAGES[reason] };
}

/**
 * Runs one structured-output AI task: pick model → reserve quota → call → Zod check → log.
 * Never throws for AI problems; returns `{ ok: false, reason }` so callers can degrade.
 * Call it only after `requireUser()`, and pass that user's id.
 */
export async function runAiTask<T>(task: AiTask<T>): Promise<AiResult<T>> {
  const picked = pickModel(task);
  if (picked === null) {
    return fail("unavailable");
  }

  const callId = await reserveCall(task, picked.modelId);
  if (callId === null) {
    return fail("quota");
  }

  const startedAt = performance.now();
  try {
    const result = await generateText({
      model: picked.model,
      system: task.system,
      prompt: task.prompt,
      output: Output.object({ schema: task.schema }),
      timeout: AI_TIMEOUT_MS,
      // One retry for network errors and 5xx; more would burn the free quota.
      maxRetries: 1,
      providerOptions: {
        groq: {
          reasoningEffort: "low", // short reasoning: faster and fewer tokens
          structuredOutputs: true,
          strictJsonSchema: true, // constrained decoding: the JSON always fits the schema
        },
      },
    });
    const output = result.output;

    await finishCall(callId, {
      status: "ok",
      usage: result.usage,
      latencyMs: performance.now() - startedAt,
    });
    return { ok: true, output, callId };
  } catch (error) {
    const reason = classifyError(error);
    // Log the reason and ids only: never the prompt, the user's text or the provider body.
    console.error("AI task failed", {
      feature: task.feature,
      callId,
      reason,
      name: error instanceof Error ? error.name : typeof error,
    });
    await finishCall(callId, {
      status: "error",
      errorCode: reason,
      latencyMs: performance.now() - startedAt,
    });
    return fail(reason);
  }
}
