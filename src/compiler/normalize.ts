import { normalizedTraceSchema, type NormalizedTrace, type NormalizedTraceStep } from "../contracts.js";
import { isRecord } from "../utils/json.js";

type NormalizeOptions = {
  source?: string;
  title?: string;
};

export function normalizeTrace(raw: unknown, options: NormalizeOptions = {}): NormalizedTrace {
  if (isRecord(raw) && "objective" in raw && "steps" in raw) {
    const trace = normalizedTraceSchema.parse(raw);
    return normalizedTraceSchema.parse({
      ...trace,
      metadata: {
        ...trace.metadata,
        source: options.source ?? trace.metadata.source,
        title: options.title ?? trace.metadata.title,
      },
    });
  }

  if (isRecord(raw) && Array.isArray(raw.messages)) {
    const steps = raw.messages
      .map((message) => normalizeEvent(message))
      .filter((step): step is NormalizedTraceStep => step !== null);

    return normalizedTraceSchema.parse({
      metadata: {
        source: options.source ?? inferString(raw, "source") ?? "messages",
        title: options.title ?? inferString(raw, "title"),
      },
      objective: inferObjective(raw, steps),
      steps,
    });
  }

  if (Array.isArray(raw)) {
    const steps = raw.map((event) => normalizeEvent(event)).filter((step): step is NormalizedTraceStep => step !== null);

    return normalizedTraceSchema.parse({
      metadata: {
        source: options.source ?? "events",
        title: options.title,
      },
      objective: inferObjective({}, steps),
      steps,
    });
  }

  if (isRecord(raw)) {
    const eventCollection = Array.isArray(raw.events)
      ? raw.events
      : Array.isArray(raw.entries)
        ? raw.entries
        : Array.isArray(raw.trace)
          ? raw.trace
          : null;

    if (eventCollection) {
      const steps = eventCollection
        .map((event) => normalizeEvent(event))
        .filter((step): step is NormalizedTraceStep => step !== null);

      return normalizedTraceSchema.parse({
        metadata: {
          source: options.source ?? inferString(raw, "source") ?? "events",
          title: options.title ?? inferString(raw, "title"),
        },
        objective: inferObjective(raw, steps),
        steps,
      });
    }
  }

  throw new Error("Unsupported trace format. Expected normalized trace JSON, messages, or an event array.");
}

function normalizeEvent(event: unknown): NormalizedTraceStep | null {
  if (!event) {
    return null;
  }

  if (isRecord(event) && typeof event.kind === "string") {
    if (
      event.kind === "message" ||
      event.kind === "tool" ||
      event.kind === "approval" ||
      event.kind === "artifact"
    ) {
      return event as NormalizedTraceStep;
    }
  }

  if (isRecord(event) && typeof event.role === "string" && typeof event.content === "string") {
    return {
      kind: "message",
      role: normalizeRole(event.role),
      content: event.content,
    };
  }

  if (isRecord(event) && typeof event.type === "string" && event.type.toLowerCase().includes("approval")) {
    return {
      kind: "approval",
      reason: inferString(event, "reason") ?? inferString(event, "message") ?? "Manual approval captured in trace.",
    };
  }

  if (isRecord(event) && (typeof event.tool === "string" || typeof event.name === "string")) {
    const toolName = (typeof event.tool === "string" ? event.tool : event.name) as string;
    return {
      kind: "tool",
      tool: toolName,
      input: inferObjectField(event, ["input", "arguments", "args", "params"]) ?? extractToolInput(event),
      output: inferObjectField(event, ["output", "result", "response"]),
      summary: inferString(event, "summary"),
    };
  }

  if (isRecord(event) && typeof event.command === "string") {
    return {
      kind: "tool",
      tool: "bash",
      input: {
        command: event.command,
      },
      output: inferObjectField(event, ["output", "result"]),
      summary: inferString(event, "summary"),
    };
  }

  if (isRecord(event) && typeof event.path === "string" && typeof event.summary === "string") {
    return {
      kind: "artifact",
      path: event.path,
      summary: event.summary,
    };
  }

  return null;
}

function inferObjective(raw: Record<string, unknown>, steps: NormalizedTraceStep[]): string {
  const direct = inferString(raw, "objective")
    ?? inferString(raw, "goal")
    ?? inferString(raw, "task")
    ?? inferString(raw, "prompt");

  if (direct) {
    return direct;
  }

  const firstUserMessage = steps.find((step) => step.kind === "message" && step.role === "user");
  if (firstUserMessage?.kind === "message") {
    return firstUserMessage.content;
  }

  const firstTool = steps.find((step) => step.kind === "tool");
  if (firstTool) {
    return `Replay a successful ${firstTool.tool} workflow.`;
  }

  return "Replay an agent workflow.";
}

function normalizeRole(role: string): "system" | "user" | "assistant" {
  if (role === "system" || role === "assistant" || role === "user") {
    return role;
  }

  if (role.includes("assistant")) {
    return "assistant";
  }

  if (role.includes("system")) {
    return "system";
  }

  return "user";
}

function inferString(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function inferObjectField(value: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in value) {
      return value[key];
    }
  }

  return undefined;
}

function extractToolInput(value: Record<string, unknown>): Record<string, unknown> {
  const knownKeys = new Set(["tool", "name", "type", "output", "result", "response", "summary"]);
  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (!knownKeys.has(key)) {
      acc[key] = entry;
    }
    return acc;
  }, {});
}
