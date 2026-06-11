/** User-facing copy for common AI SDK / chat failures. */
export function formatChatError(error: string | Error): string {
  if (typeof error === "string") return error;
  const name = error.name ?? "";
  const message = error.message ?? "Something went wrong.";

  if (name === "AI_MissingToolResultsError") {
    return "The conversation hit an unresolved tool call. Refresh and try again — this usually means a palette or finalize step did not complete.";
  }

  if (/OPENROUTER|api key|401|403/i.test(message)) {
    return "The oracle could not reach the model. Check OPENROUTER_API_KEY in .env.local.";
  }

  if (/abort|timeout|timed out/i.test(message)) {
    return "The oracle took too long to respond. Try a shorter message or try again.";
  }

  return message;
}
