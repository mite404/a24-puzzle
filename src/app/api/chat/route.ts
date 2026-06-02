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
    messages = (body as { messages: OracleUIMessage[] }).messages;
  } catch (error) {
    return chatErrorResponse(error, 400);
  }

  try {
    const result = streamText({
      model: openrouter.chat(MODEL_ID),
      system: buildSystemPrompt(),
      messages: await convertToModelMessages(messages),
      tools: oracleTools,
      stopWhen: stepCountIs(1),
      onError: ({ error }) => {
        console.error("[api/chat] stream", error);
      },
    });

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
