import { describe, expect, test } from "../../fixtures/claude.js";
import { createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findAllCodleInteractions,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("activity set-problems", () => {
  test("퀴즈 활동에 문제 연결", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 퀴즈 활동 "E2E Quiz"를 만들고, ` +
        `"E2E OX" 제목의 O/X 문제(O가 정답)를 만들어서 그 퀴즈 활동에 연결해줘.`,
    );

    expectCodleCommand(result, "activity create");
    expectCodleCommand(result, "problem create");
    expectCodleCommand(result, "activity set-problems");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });

  test("여러 문제를 퀴즈에 순서대로 연결", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 퀴즈 활동 "E2E Multi"를 만들고, ` +
        `다음 2개 문제를 만들어서 순서대로 연결해줘:\n` +
        `1번: "E2E Q1" (O/X, O가 정답)\n` +
        `2번: "E2E Q2" (객관식, 선택지: A정답/B/C/D)`,
    );

    expectCodleCommand(result, "activity create");
    expectCodleCommand(result, "problem create");
    expectCodleCommand(result, "activity set-problems");

    const problemCreates = findAllCodleInteractions(
      result.toolInteractions,
      "problem create",
    );
    expect(problemCreates.length).toBeGreaterThanOrEqual(2);

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });

  test("활동지에 문제 연결", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 활동지 활동 "E2E Sheet"를 만들고, ` +
        `"E2E Sheet Problem" 제목의 활동지(sheet) 문제를 만들어서 연결해줘.`,
    );

    expectCodleCommand(result, "activity create");
    expectCodleCommand(result, "problem create");
    expectCodleCommand(result, "activity set-problems");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });

  test("필수 답변 의도 → isRequired:true 로 전달", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 활동지 활동 "E2E Required"를 만들고, ` +
        `"E2E Q1"이라는 활동지 문제를 만들어서 연결해줘. ` +
        `이 문제는 학생이 반드시 답을 작성해야 하는 필수 문제로 설정해줘.`,
    );

    expectCodleCommand(result, "activity set-problems");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-problems",
    );
    expect(interaction!.result!.isError).toBe(false);

    // --problems JSON에 isRequired: true가 포함되어야 한다.
    const command = interaction!.call.input.command as string;
    const match = command.match(/--problems\s+'(\[.*?\])'/s);
    expect(match).not.toBeNull();
    const problems = JSON.parse(match![1]) as Array<{ isRequired?: boolean }>;
    expect(problems.length).toBeGreaterThanOrEqual(1);
    expect(problems[0].isRequired).toBe(true);
  });

  test("필수 아님 의도 → isRequired:false 로 전달 (활동지 기본값 override)", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);

    // 활동지 문제의 isRequired 기본값은 true이므로, "필수 아님" 의도를
    // LLM이 isRequired:false로 명시해야만 실제로 false가 전달된다.
    const result = await claude.run(
      `자료 ID "${material.id}"에 활동지 활동 "E2E Optional"을 만들고, ` +
        `"E2E Q1"이라는 활동지 문제를 만들어서 연결해줘. ` +
        `학생이 답을 작성하지 않고 넘어가도 되는 선택 응답 문제로 설정해줘.`,
    );

    expectCodleCommand(result, "activity set-problems");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-problems",
    );
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    const match = command.match(/--problems\s+'(\[.*?\])'/s);
    expect(match).not.toBeNull();
    const problems = JSON.parse(match![1]) as Array<{ isRequired?: boolean }>;
    expect(problems.length).toBeGreaterThanOrEqual(1);
    expect(problems[0].isRequired).toBe(false);
  });

  test("연결된 문제의 필수 여부 전환 → 기존 pcp update 경로", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);

    // 1) 선택형으로 연결 → 신규 pcp(isRequired:false) 생성
    // 2) 필수로 전환 → 기존 pcp의 is_required만 update
    // 최종 set-problems 호출이 create가 아닌 update 경로로 떨어지는지 검증한다.
    const result = await claude.run(
      `자료 ID "${material.id}"에 활동지 활동 "E2E Toggle"을 만들고, ` +
        `"E2E Q1"이라는 활동지 문제를 만들어서, 학생이 답을 작성하지 않아도 되는 ` +
        `선택 응답으로 먼저 연결해줘. ` +
        `연결이 끝난 뒤에, 같은 문제를 이번에는 학생이 반드시 답을 작성해야 하는 ` +
        `필수 문제로 다시 설정해줘.`,
    );

    const setProblemsCalls = findAllCodleInteractions(
      result.toolInteractions,
      "activity set-problems",
    );
    expect(setProblemsCalls.length).toBeGreaterThanOrEqual(2);

    // 마지막 set-problems 호출이 isRequired:true를 명시해야 하고,
    // 출력은 created:0 / updated:1 로 기존 pcp 수정 경로여야 한다.
    const last = setProblemsCalls[setProblemsCalls.length - 1];
    expect(last.result!.isError).toBe(false);

    const command = last.call.input.command as string;
    const match = command.match(/--problems\s+'(\[.*?\])'/s);
    expect(match).not.toBeNull();
    const problems = JSON.parse(match![1]) as Array<{ isRequired?: boolean }>;
    expect(problems[0].isRequired).toBe(true);

    const output = parseCodleOutput<{
      created?: number;
      updated?: number;
      destroyed?: number;
    }>(last.result!);
    expect(output.updated).toBe(1);
    expect(output.created ?? 0).toBe(0);
  });
});
