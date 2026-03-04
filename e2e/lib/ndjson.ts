export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeResult {
  toolCalls: ToolCall[];
  toolNames: string[];
  errors: string[];
  text: string;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  mcpServers: Array<{ name: string; status: string }>;
  exitCode: number;
  stderr: string;
}

export function parseNdjson(raw: string, exitCode: number, stderr: string): ClaudeResult {
  const lines = raw.split("\n").filter(Boolean);
  const entries = lines.map((l) => JSON.parse(l));

  const result = entries.findLast((e: Record<string, unknown>) => e.type === "result") as
    | Record<string, unknown>
    | undefined;
  const init = entries.find((e: Record<string, unknown>) => e.subtype === "init") as
    | Record<string, unknown>
    | undefined;

  const toolCalls: ToolCall[] = entries
    .filter((e: Record<string, unknown>) => e.type === "assistant")
    .flatMap((e: Record<string, unknown>) => {
      const msg = e.message as Record<string, unknown> | undefined;
      return (msg?.content as Array<Record<string, unknown>>) ?? [];
    })
    .filter((c: Record<string, unknown>) => c.type === "tool_use")
    .map((c: Record<string, unknown>) => ({
      name: c.name as string,
      input: c.input as Record<string, unknown>,
    }));

  const errors: string[] = entries
    .filter((e: Record<string, unknown>) => e.type === "user")
    .flatMap((e: Record<string, unknown>) => {
      const msg = e.message as Record<string, unknown> | undefined;
      return (msg?.content as Array<Record<string, unknown>>) ?? [];
    })
    .filter(
      (c: Record<string, unknown>) =>
        c.type === "tool_result" && c.is_error === true,
    )
    .map((c: Record<string, unknown>) => {
      const content = c.content as string | Array<Record<string, unknown>>;
      if (typeof content === "string") return content;
      return JSON.stringify(content);
    });

  const mcpServers = ((init?.mcp_servers as Array<Record<string, unknown>>) ?? []).map(
    (s) => ({
      name: s.name as string,
      status: (s.status as string) ?? "unknown",
    }),
  );

  return {
    toolCalls,
    toolNames: toolCalls.map((tc) => tc.name),
    errors,
    text: (result?.result as string) ?? "",
    costUsd: (result?.total_cost_usd as number) ?? 0,
    durationMs: (result?.duration_ms as number) ?? 0,
    numTurns: (result?.num_turns as number) ?? 0,
    mcpServers,
    exitCode,
    stderr,
  };
}
