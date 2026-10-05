/**
 * Plain-English messages for AI and image-API failures. Designers never see raw provider JSON;
 * the original error goes to the server log for whoever fixes it.
 */

export type AIService = "claude" | "image";

const WHO: Record<AIService, string> = { claude: "The AI service", image: "The flat-drawing (image) service" };

export function friendlyAIError(e: unknown, service: AIService, what: string): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const status = typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : Number(raw.match(/\b(4\d\d|5\d\d)\b/)?.[1] ?? 0);
  const t = raw.toLowerCase();
  console.error(`[${service}] ${what} failed:`, raw.slice(0, 2000));
  const who = WHO[service];
  if ((e as Error)?.name === "AIUnavailableError" || /not set|no api key/.test(t)) return `${what} isn't set up yet — the API key is missing. Ask an admin; meanwhile answer by hand.`;
  if (status === 401 || status === 403 || /api key|api_key|x-api-key|authentication|unauthori[sz]ed|permission|not scoped|workspace/.test(t))
    return `${who} rejected its API key, so ${what.toLowerCase()} didn't run. Ask an admin to check the key in Vercel; meanwhile answer by hand.`;
  if (/credit|billing|quota|insufficient|payment|balance/.test(t)) return `${who} account is out of credit, so ${what.toLowerCase()} didn't run. Ask an admin to top it up.`;
  if (status === 429 || /rate.?limit|too many requests/.test(t)) return `${who} is busy right now. Wait a minute and try again.`;
  if (status === 529 || status >= 500 || /overloaded|unavailable|timeout|timed out|econn|fetch failed|network|socket/.test(t))
    return `Couldn't reach ${who.replace(/^The /, "the ")} just now. Try again in a minute.`;
  if (/declined|refus|safety|moderation|content policy/.test(t)) return `${who} wouldn't process this image. Try a cleaner product shot on a plain background.`;
  if (status === 413 || /too large|size|dimensions|image.*(invalid|unsupported)|could not process image/.test(t))
    return `${who} couldn't read this image. Use a JPG or PNG under 5 MB.`;
  if (/cut off|max_tokens|json/.test(t)) return `${what} came back incomplete. Try again.`;
  return `${what} didn't work this time. Try again, or answer by hand.`;
}
