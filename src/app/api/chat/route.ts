import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, stepCountIs } from "ai";
import { oracleTools, type OracleUIMessage } from "@/lib/oracle-tools";
import { buildSystemPrompt } from "@/lib/oracle-prompt";

export const maxDuration = 30;

// OpenRouter is OpenAI-compatible, so we use the official OpenAI provider with a
// custom baseURL rather than a vendor-specific module — swapping providers later
// is just a baseURL/key/model change.
const openrouter = createOpenAI({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL_ID = process.env.OPENROUTER_MODEL ?? "moonshotai/kimi-k2.6";

export async function POST(req: Request) {
  const { messages }: { messages: OracleUIMessage[] } = await req.json();

  const result = streamText({
    model: openrouter.chat(MODEL_ID),
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools: oracleTools,
    // The oracle calls client-side tools (no execute); one model step per turn.
    stopWhen: stepCountIs(1),
  });

  return result.toUIMessageStreamResponse();
}
