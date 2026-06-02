import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, stepCountIs } from "ai";
import { oracleTools, type OracleUIMessage } from "@/lib/oracle-tools";
import { buildSystemPrompt } from "@/lib/oracle-prompt";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: OracleUIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: buildSystemPrompt(),
    messages: convertToModelMessages(messages),
    tools: oracleTools,
    // The oracle calls client-side tools (no execute); one model step per turn.
    stopWhen: stepCountIs(1),
  });

  return result.toUIMessageStreamResponse();
}
