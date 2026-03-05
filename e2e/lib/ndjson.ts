export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface ToolInteraction {
  call: ToolCall;
  result: ToolResult | undefined;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface ClaudeResult {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  toolInteractions: ToolInteraction[];
  toolNames: string[];
  errors: string[];
  text: string;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  usage: UsageStats;
  mcpServers: Array<{ name: string; status: string }>;
  exitCode: number;
  stderr: string;
}

/** name으로 첫 번째 매칭되는 tool interaction을 찾는다. */
export function findToolResult(
  interactions: ToolInteraction[],
  toolName: string,
): ToolInteraction | undefined {
  return interactions.find((i) => i.call.name === toolName);
}

/** name으로 매칭되는 모든 tool interactions를 찾는다. */
export function findAllToolResults(
  interactions: ToolInteraction[],
  toolName: string,
): ToolInteraction[] {
  return interactions.filter((i) => i.call.name === toolName);
}

/**
 * tool result content에서 텍스트를 추출한다.
 * MCP tool result는 [{"type":"text","text":"..."}] 배열 형태로 올 수 있다.
 */
export function extractText(result: ToolResult): string {
  const content = result.content;
  try {
    const parsed = JSON.parse(content) as Array<{ type: string; text: string }>;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    }
  } catch {
    // 이미 plain text
  }
  return content;
}

export function parseNdjson(
  raw: string,
  exitCode: number,
  stderr: string,
): ClaudeResult {
  const lines = raw.split("\n").filter(Boolean);
  const entries = lines.map((l) => JSON.parse(l));

  const resultEntry = [...entries]
    .reverse()
    .find((e: Record<string, unknown>) => e.type === "result") as
    | Record<string, unknown>
    | undefined;
  const init = entries.find(
    (e: Record<string, unknown>) => e.subtype === "init",
  ) as Record<string, unknown> | undefined;

  // tool_use 블록 추출
  const toolCalls: ToolCall[] = entries
    .filter((e: Record<string, unknown>) => e.type === "assistant")
    .flatMap((e: Record<string, unknown>) => {
      const msg = e.message as Record<string, unknown> | undefined;
      return (msg?.content as Array<Record<string, unknown>>) ?? [];
    })
    .filter((c: Record<string, unknown>) => c.type === "tool_use")
    .map((c: Record<string, unknown>) => ({
      id: c.id as string,
      name: c.name as string,
      input: c.input as Record<string, unknown>,
    }));

  // tool_result 블록 추출
  const allToolResults: Array<Record<string, unknown>> = entries
    .filter((e: Record<string, unknown>) => e.type === "user")
    .flatMap((e: Record<string, unknown>) => {
      const msg = e.message as Record<string, unknown> | undefined;
      return (msg?.content as Array<Record<string, unknown>>) ?? [];
    })
    .filter((c: Record<string, unknown>) => c.type === "tool_result");

  const toolResults: ToolResult[] = allToolResults.map((c) => {
    const content = c.content as string | Array<Record<string, unknown>>;
    return {
      toolUseId: c.tool_use_id as string,
      content: typeof content === "string" ? content : JSON.stringify(content),
      isError: (c.is_error as boolean) ?? false,
    };
  });

  const errors = toolResults.filter((r) => r.isError).map((r) => r.content);

  // call ↔ result 매칭
  const resultMap = new Map(toolResults.map((r) => [r.toolUseId, r]));
  const toolInteractions: ToolInteraction[] = toolCalls.map((call) => ({
    call,
    result: resultMap.get(call.id),
  }));

  const mcpServers = (
    (init?.mcp_servers as Array<Record<string, unknown>>) ?? []
  ).map((s) => ({
    name: s.name as string,
    status: (s.status as string) ?? "unknown",
  }));

  const rawUsage = (resultEntry?.usage as Record<string, unknown>) ?? {};

  return {
    toolCalls,
    toolResults,
    toolInteractions,
    toolNames: toolCalls.map((tc) => tc.name),
    errors,
    text: (resultEntry?.result as string) ?? "",
    costUsd: (resultEntry?.total_cost_usd as number) ?? 0,
    durationMs: (resultEntry?.duration_ms as number) ?? 0,
    numTurns: (resultEntry?.num_turns as number) ?? 0,
    usage: {
      inputTokens: (rawUsage.input_tokens as number) ?? 0,
      outputTokens: (rawUsage.output_tokens as number) ?? 0,
      cacheReadInputTokens: (rawUsage.cache_read_input_tokens as number) ?? 0,
      cacheCreationInputTokens:
        (rawUsage.cache_creation_input_tokens as number) ?? 0,
    },
    mcpServers,
    exitCode,
    stderr,
  };
}
