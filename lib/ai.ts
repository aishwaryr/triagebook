import { aiFeature } from "@/db/schema";

// Features

/** All AI features, in database enum order. */
export const AI_FEATURES = aiFeature.enumValues;

/**
 * Type: union of all AI feature values (`"bulk_issues" | "triage"`).
 * Derived from the database enum, so it updates when the enum changes.
 */
export type AiFeature = (typeof AI_FEATURES)[number];

// Quotas

/** Model calls one user may start per UTC day, across all AI features. */
export const AI_USER_DAILY_LIMIT = 20;

/** Model calls the whole app may start per UTC day; keeps the public demo inside the free provider tier. */
export const AI_APP_DAILY_LIMIT = 100;

// Results

/** Type: why an AI task returned no output. */
export type AiFailureReason =
  | "unavailable" // no API key configured
  | "quota" // over a daily quota in this app
  | "busy" // the provider rate-limited us (HTTP 429)
  | "timeout"
  | "invalid_output" // the model's answer failed the Zod schema
  | "error";

/** Message shown to the user for each failure reason. */
export const AI_FAILURE_MESSAGES: Record<AiFailureReason, string> = {
  unavailable: "AI is not set up on this server.",
  quota: "Daily AI limit reached. Try again tomorrow.",
  busy: "The AI service is busy. Try again in a minute.",
  timeout: "The AI took too long to answer. Try again.",
  invalid_output: "The AI returned an answer we could not use. Try again.",
  error: "Something went wrong with the AI. Try again.",
};

/**
 * Type: result of one AI task — the schema-checked output, or why there is none.
 * Callers branch on `ok`; a failure never throws, so the page keeps working without AI.
 */
export type AiResult<T> =
  | { ok: true; output: T; callId: string }
  | { ok: false; reason: AiFailureReason; message: string };
