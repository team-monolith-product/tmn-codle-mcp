import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  expectCodleCommand,
  findAllCodleInteractions,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

// ===== problem create =====

describe("problem create", () => {
  test("O/X 퀴즈 문제 생성 (이미지 선택지)", async ({ claude }) => {
    const result = await claude.run(
      `"E2E OX" 제목으로 퀴즈 문제를 만들어줘. O가 정답이고 X가 오답인 O/X 문제야.`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("quiz");
    expect(command).toMatch(/--choices/);

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });

  test("객관식 퀴즈 문제 생성 (4지선다)", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 객관식" 제목으로 퀴즈 문제를 만들어줘. ` +
        `질문은 "스팸 메일 필터가 사용하는 데이터는?"이고, ` +
        `선택지는 이미지, 텍스트(정답), 소리, 수치야.`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("quiz");
    expect(command).toMatch(/--choices/);

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });

  test("주관식 퀴즈 문제 생성", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 주관식" 제목으로 주관식 퀴즈 문제를 만들어줘. ` +
        `질문은 "AI가 스스로 패턴을 찾는 학습 방식은?"이고, 정답은 "비지도학습"이야.`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("비지도학습");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });

  test("서술형 문제 생성 (모범답안 + 채점기준)", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 서술형" 제목으로 서술형 문제를 만들어줘.\n` +
        `질문: "지도학습과 비지도학습의 차이를 설명하세요."\n` +
        `모범답안: "지도학습은 정답이 있는 데이터로 학습하고, 비지도학습은 정답 없이 패턴을 찾는다."\n` +
        `평가 요소: "차이점 설명, 예시"\n` +
        `채점기준 상(1.0): "차이를 정확히 설명하고 예시를 들었다."\n` +
        `채점기준 중(0.7): "차이를 설명했으나 예시가 부족하다."\n` +
        `채점기준 하(0.3): "설명이 부족하다."`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("descriptive");
    expect(command).toMatch(/--sample-answer/);

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });

  test("서술형 문제 생성 (채점기준 없이)", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 서술형 기본" 제목으로 서술형 문제를 만들어줘.\n` +
        `질문: "인공지능의 활용 사례를 서술하세요."\n` +
        `채점기준은 넣지 마.`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("descriptive");
    expect(command).not.toMatch(/--criteria/);

    const output = parseCodleOutput<{ id: string; warnings?: string[] }>(
      interaction!.result!,
    );
    expect(output).toHaveProperty("id");
    expect(output.warnings).toBeUndefined();
  });

  test("활동지(sheet) 문제 생성", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 활동지" 제목으로 활동지(sheet) 문제를 만들어줘. 내용은 "다음을 설명하시오"야.`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("sheet");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });
});

// ===== activity set-problems =====

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

// ===== activitiable update =====

describe("activitiable update", () => {
  test("보드 안내문 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 보드 활동 "E2E Board"를 만들고, ` +
        `안내문을 "여러분의 경험을 적어 보세요."로 설정해줘.`,
    );

    expectCodleCommand(result, "activitiable update");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activitiable update",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });

  test("EmbeddedActivity URL 및 학습목표 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 외부URL 활동 "E2E Embed"를 만들고, ` +
        `URL을 "https://example.com/embed"로, ` +
        `학습목표를 "목표 1: 개념 이해", "목표 2: 실습"으로 설정해줘.`,
    );

    // url may be passed via activity create or activitiable update
    const allInteractions = [
      ...result.toolInteractions.filter(
        (i) =>
          i.call.name === "Bash" &&
          ((i.call.input.command as string) ?? "").includes("codle"),
      ),
    ];

    const urlPassed = allInteractions.some((i) =>
      (i.call.input.command as string).includes("https://example.com/embed"),
    );
    expect(urlPassed).toBe(true);

    // goals should be passed via activitiable update
    const activitiableInteraction = findCodleInteraction(
      result.toolInteractions,
      "activitiable update",
    );
    expect(activitiableInteraction).toBeDefined();
    const command = activitiableInteraction!.call.input.command as string;
    expect(command).toMatch(/--goals/);

    expect(activitiableInteraction!.result).toBeDefined();
    expect(activitiableInteraction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(activitiableInteraction!.result!);
    expect(output).toBeDefined();
  });

  test("활동지 설명 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 활동지 활동 "E2E Sheet Desc"를 만들고, ` +
        `활동지 설명을 "다음 AI 서비스를 분류하세요."로 설정해줘.`,
    );

    expectCodleCommand(result, "activitiable update");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activitiable update",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });
});
