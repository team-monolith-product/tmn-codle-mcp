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
  exitCode: number;
  stderr: string;
}

// ---------------------------------------------------------------------------
// CLI (bash) helpers
// ---------------------------------------------------------------------------

// AIDEV-NOTE: AI가 `codle`, `./bin/run.js`, `node bin/run.js` 등 다양한 경로로
// CLI를 호출할 수 있다. 모두 같은 oclif 엔트리포인트이므로 동일하게 매칭한다.
const CODLE_BIN_PATTERNS = ["codle", "bin/run.js", "bin/dev.js"];

/** Check whether a bash tool call's command invokes a codle subcommand. */
function isCodleBashCall(call: ToolCall): boolean {
  if (call.name !== "Bash") return false;
  const cmd = call.input.command as string | undefined;
  return !!cmd && CODLE_BIN_PATTERNS.some((p) => cmd.includes(p));
}

/** Check whether a bash command string matches a codle subcommand pattern. */
function matchesCodleSubcommand(command: string, subcommand: string): boolean {
  // "material search" -> matches "codle material search ..." or "codle material:search ..."
  // AIDEV-NOTE: oclif는 하이픈을 스페이스로 대체해도 라우팅한다.
  // AI가 "problem collection sync" (하이픈 없이)로 호출하는 경우도 매칭한다.
  const subcmdVariants = [
    subcommand,
    subcommand.replace(/ /g, ":"),
    subcommand.replace(/-/g, " "),
  ];
  return CODLE_BIN_PATTERNS.some((bin) =>
    subcmdVariants.some((v) => command.includes(`${bin} ${v}`)),
  );
}

/** Find last bash tool interaction where the command contains the given codle subcommand.
 *  Excludes --help calls to avoid matching exploration commands.
 *  AIDEV-NOTE: 마지막 호출을 반환한다. CLI는 자유 형식 bash 명령이므로
 *  첫 시도에서 잘못된 플래그를 사용하고 재시도하는 패턴이 발생할 수 있다.
 *  최종 시도의 결과를 검증해야 의미 있는 테스트가 된다. */
export function findCodleInteraction(
  interactions: ToolInteraction[],
  subcommand: string,
): ToolInteraction | undefined {
  return interactions.findLast((i) => {
    if (i.call.name !== "Bash") return false;
    const cmd = (i.call.input.command as string) ?? "";
    if (cmd.includes("--help")) return false;
    return matchesCodleSubcommand(cmd, subcommand);
  });
}

/** Find all bash tool interactions matching a codle subcommand.
 *  Excludes --help calls to avoid matching exploration commands. */
export function findAllCodleInteractions(
  interactions: ToolInteraction[],
  subcommand: string,
): ToolInteraction[] {
  return interactions.filter((i) => {
    if (i.call.name !== "Bash") return false;
    const cmd = (i.call.input.command as string) ?? "";
    if (cmd.includes("--help")) return false;
    return matchesCodleSubcommand(cmd, subcommand);
  });
}

/** Parse JSON output from a codle CLI result. */
export function parseCodleOutput<T = unknown>(result: ToolResult): T {
  // AIDEV-NOTE: CLI stdout에 oclif warning 등 non-JSON 행이 섞일 수 있다.
  // 마지막 유효한 JSON 행을 찾아서 파싱한다.
  const lines = result.content.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      return JSON.parse(line) as T;
    } catch {
      continue;
    }
  }
  return JSON.parse(result.content) as T;
}

/** Assert that at least one bash call invoked the given codle subcommand. */
export function expectCodleCommand(
  result: ClaudeResult,
  subcommand: string,
): void {
  const found = result.toolInteractions.some(
    (i) =>
      i.call.name === "Bash" &&
      matchesCodleSubcommand(
        (i.call.input.command as string) ?? "",
        subcommand,
      ),
  );
  if (!found) {
    throw new Error(
      `Expected a bash call containing "codle ${subcommand}" but none was found. ` +
        `Tool names seen: ${result.toolNames.join(", ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Legacy helpers (kept for backward compat)
// ---------------------------------------------------------------------------

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
 * tool result가 [{"type":"text","text":"..."}] 배열 형태로 올 수 있다.
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

// ---------------------------------------------------------------------------
// NDJSON parser
// ---------------------------------------------------------------------------

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

  // AIDEV-NOTE: codle CLI의 bash 호출 에러만 수집한다.
  // 다른 bash 도구 호출이나 Claude Code 플랫폼 도구의 에러는 우리 코드와 무관하므로 제외한다.
  const codleToolUseIds = new Set(
    toolCalls.filter((tc) => isCodleBashCall(tc)).map((tc) => tc.id),
  );
  const errors = toolResults
    .filter((r) => r.isError && codleToolUseIds.has(r.toolUseId))
    .map((r) => r.content);

  // call <-> result 매칭
  const resultMap = new Map(toolResults.map((r) => [r.toolUseId, r]));
  const toolInteractions: ToolInteraction[] = toolCalls.map((call) => ({
    call,
    result: resultMap.get(call.id),
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
    exitCode,
    stderr,
  };
}
