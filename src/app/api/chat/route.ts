import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  APICallError,
  AISDKError,
} from "ai";
import { oracleTools, type OracleUIMessage } from "@/lib/oracle-tools";
import { buildSystemPrompt } from "@/lib/oracle-prompt";
import { resolvePersonaId } from "@/lib/oracle-personas";
import {
  logOpenRouter,
  summarizeIncomingMessages,
} from "@/lib/openrouter-dev-log";

export const maxDuration = 30;

const openrouter = createOpenAI({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL_ID = process.env.OPENROUTER_MODEL ?? "moonshotai/kimi-k2.6";

function chatErrorResponse(error: unknown, status = 500): Response {
  const err = error instanceof Error ? error : new Error(String(error));
  const name = err instanceof AISDKError ? err.name : err.name;

  if (process.env.NODE_ENV === "development") {
    console.error("[api/chat]", name, err.message, err);
  } else {
    console.error("[api/chat]", name, err.message);
  }

  let message = err.message || "Chat request failed.";
  let httpStatus = status;

  if (name === "AI_MissingToolResultsError") {
    message =
      "Conversation history has an unresolved tool call. Refresh the page and start again.";
    httpStatus = 400;
  } else if (!process.env.OPENROUTER_API_KEY) {
    message = "OPENROUTER_API_KEY is not configured.";
    httpStatus = 503;
  } else if (error instanceof APICallError) {
    httpStatus = error.statusCode ?? 502;
    message =
      error.statusCode === 401
        ? "OpenRouter rejected the API key. Check OPENROUTER_API_KEY."
        : `Model provider error (${error.statusCode ?? "unknown"}).`;
  }

  return Response.json({ error: message, code: name }, { status: httpStatus });
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return chatErrorResponse(
      new Error("OPENROUTER_API_KEY is not configured."),
      503,
    );
  }

  let messages: OracleUIMessage[];
  let personaId = resolvePersonaId(undefined);
  try {
    const body: unknown = await req.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("messages" in body) ||
      !Array.isArray((body as { messages: unknown }).messages)
    ) {
      return Response.json(
        { error: "Invalid request: expected { messages: UIMessage[] }." },
        { status: 400 },
      );
    }
    const parsed = body as { messages: OracleUIMessage[]; personaId?: unknown };
    messages = parsed.messages;
    personaId = resolvePersonaId(parsed.personaId);
  } catch (error) {
    return chatErrorResponse(error, 400);
  }

  logOpenRouter("client → api/chat", {
    model: MODEL_ID,
    personaId,
    ...summarizeIncomingMessages(messages),
  });

  try {
    let receivedFromProvider = false;

    const result = streamText({
      model: openrouter.chat(MODEL_ID),
      system: buildSystemPrompt(personaId),
      messages: await convertToModelMessages(messages),
      tools: oracleTools,
      stopWhen: stepCountIs(1),
      experimental_onStepStart: () => {
        logOpenRouter("request → OpenRouter (step starting)");
      },
      onChunk: ({ chunk }) => {
        if (receivedFromProvider) return;
        receivedFromProvider = true;
        logOpenRouter("OpenRouter → api (first stream chunk)", {
          chunkType: chunk.type,
        });
      },
      onStepFinish: ({ finishReason, usage }) => {
        logOpenRouter("OpenRouter step finished", {
          finishReason,
          usage,
        });
      },
      onFinish: ({ finishReason, totalUsage, text, toolCalls }) => {
        logOpenRouter("OpenRouter stream complete", {
          finishReason,
          usage: totalUsage,
          textLength: text.length,
          toolCallCount: toolCalls.length,
          toolNames: toolCalls.map((t) => t.toolName),
        });
      },
      onError: ({ error }) => {
        console.error("[api/chat] stream", error);
        logOpenRouter("OpenRouter error", {
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });

    logOpenRouter("api → client (UI message stream opened)");

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[api/chat] ui stream", error);
        }
        return error instanceof Error ? error.message : "Stream failed.";
      },
    });
  } catch (error) {
    return chatErrorResponse(error);
  }
}
