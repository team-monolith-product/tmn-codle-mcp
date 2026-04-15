import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

// Mock CodleClient constructor - must mock BEFORE importing commands
const mockClient = {
  getMe: vi.fn(),
  listMaterials: vi.fn(),
  getMaterial: vi.fn(),
  getActivity: vi.fn(),
  getHtmlActivity: vi.fn(),
  getSocroomActivity: vi.fn(),
  listBoards: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  duplicateMaterial: vi.fn(),
};
vi.mock("../src/api/client.js", () => ({
  CodleClient: vi.fn(() => mockClient),
}));
vi.mock("../src/auth/token-manager.js", () => ({
  load: () => ({
    access_token: "test-token",
    auth_server_url: "",
    client_id: "",
    refresh_token: "",
    scope: "public",
    created_at: 0,
    expires_in: 99999,
  }),
}));

// Import commands AFTER mock
import MaterialSearch from "../src/commands/material/search.js";
import MaterialGet from "../src/commands/material/get.js";
import MaterialCreate from "../src/commands/material/create.js";
import MaterialUpdate from "../src/commands/material/update.js";
import MaterialDuplicate from "../src/commands/material/duplicate.js";
import { runCommand } from "./run-command.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.getMe.mockResolvedValue({
    data: { id: "test-user-123", type: "user", attributes: {} },
  });
});

describe("material search", () => {
  it("basic search (my materials)", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "1", name: "테스트 자료", is_public: false },
      ]),
    );

    const output = await runCommand(MaterialSearch, [
      "--query",
      "테스트",
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    expect(output).toContain("테스트 자료");

    expect(mockClient.getMe).toHaveBeenCalled();
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[query]"]).toBe("테스트");
    expect(callParams["filter[user_id]"]).toBe("test-user-123");
    expect(callParams["filter[is_public]"]).toBeUndefined();
  });

  it("public search no user_id", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "2", name: "공개자료", is_public: true },
      ]),
    );

    await runCommand(MaterialSearch, [
      "--is-public",
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);

    expect(mockClient.getMe).not.toHaveBeenCalled();
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[is_public]"]).toBe("true");
    expect(callParams["filter[user_id]"]).toBeUndefined();
  });

  it("empty results", async () => {
    mockClient.listMaterials.mockResolvedValue({ data: [] });
    const output = await runCommand(MaterialSearch, [
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([]);
  });

  it("tag_ids filter", async () => {
    mockClient.listMaterials.mockResolvedValue({ data: [] });
    await runCommand(MaterialSearch, [
      "--tag-ids",
      "10",
      "--tag-ids",
      "20",
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[tag_ids]"]).toBe("10,20");
  });

  it("is-public omitted calls getMe and sends user_id", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "3", name: "내 자료", is_public: false },
      ]),
    );

    const output = await runCommand(MaterialSearch, [
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    expect(output).toContain("내 자료");

    expect(mockClient.getMe).toHaveBeenCalledOnce();
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[user_id]"]).toBe("test-user-123");
    expect(callParams["filter[is_public]"]).toBeUndefined();
  });
});

describe("material get", () => {
  it("basic with activities, activitiables, and transitions", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: {
          name: "테스트 자료",
          is_public: false,
          is_official: false,
          level: 0,
        },
      },
      included: [
        {
          id: "10",
          type: "activity",
          attributes: {
            name: "활동1",
            depth: 0,
            activitiable_type: "QuizActivity",
          },
          relationships: {
            activitiable: { data: { type: "quiz_activity", id: "q1" } },
          },
        },
        {
          id: "q1",
          type: "quiz_activity",
          attributes: { is_exam: false, is_study_room: true },
        },
        {
          id: "20",
          type: "activity",
          attributes: { name: "활동2", depth: 0 },
          relationships: {
            activitiable: { data: { type: "html_activity", id: "h1" } },
          },
        },
        {
          id: "h1",
          type: "html_activity",
          attributes: { html_activity_pages: [] },
        },
        {
          id: "t1",
          type: "activity_transition",
          attributes: {
            before_activity_id: "10",
            after_activity_id: "20",
          },
        },
        {
          id: "tag1",
          type: "tag",
          attributes: { name: "AI", domain: "category" },
        },
      ],
    });

    const output = await runCommand(MaterialGet, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.material.name).toBe("테스트 자료");
    expect(parsed.activities).toHaveLength(2);
    expect(parsed.tags).toHaveLength(1);
    expect(parsed.tags[0].name).toBe("AI");
    expect(parsed.transitions).toHaveLength(1);

    // activitiable nested in each activity
    const quiz = parsed.activities.find(
      (a: Record<string, unknown>) => a.activitiable_type === "QuizActivity",
    );
    expect(quiz.activitiable).toEqual({
      id: "q1",
      is_exam: false,
      is_study_room: true,
    });

    const html = parsed.activities.find(
      (a: Record<string, unknown>) => a.activitiable_type === "HtmlActivity",
    );
    expect(html.activitiable).toEqual({
      id: "h1",
      html_activity_pages: [],
    });
  });

  it("no activities", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "빈 자료", is_public: false, is_official: false },
      },
      included: [],
    });

    const output = await runCommand(MaterialGet, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.activities).toHaveLength(0);
  });

  it("activitiable not in included resolves to null", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "자료", is_public: false, is_official: false },
      },
      included: [
        {
          id: "10",
          type: "activity",
          attributes: { name: "활동1", depth: 0 },
          relationships: {
            activitiable: { data: { type: "video_activity", id: "v1" } },
          },
        },
      ],
    });

    const output = await runCommand(MaterialGet, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.activities[0].activitiable_type).toBe("VideoActivity");
    expect(parsed.activities[0].activitiable_id).toBe("v1");
    expect(parsed.activities[0].activitiable).toBeNull();
  });

  it("--detail fetches quiz problem_collections", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "자료", is_public: false, is_official: false },
      },
      included: [
        {
          id: "10",
          type: "activity",
          attributes: { name: "퀴즈", depth: 0 },
          relationships: {
            activitiable: { data: { type: "quiz_activity", id: "q1" } },
          },
        },
        {
          id: "q1",
          type: "quiz_activity",
          attributes: { is_exam: false },
        },
      ],
    });

    // getActivity returns the activity with nested problem_collections
    mockClient.getActivity.mockResolvedValue({
      data: {
        id: "10",
        type: "activity",
        attributes: { name: "퀴즈" },
        relationships: {
          problem_collections: {
            data: [{ type: "problem_collection", id: "pc1" }],
          },
        },
      },
      included: [
        {
          id: "pc1",
          type: "problem_collection",
          attributes: {},
          relationships: {
            pcps: {
              data: [{ type: "problem_collections_problem", id: "pcp1" }],
            },
          },
        },
        {
          id: "pcp1",
          type: "problem_collections_problem",
          attributes: { position: 0 },
          relationships: {
            problem: { data: { type: "problem", id: "p1" } },
          },
        },
        {
          id: "p1",
          type: "problem",
          attributes: { problem_type: "quiz", title: "문제1" },
          relationships: {
            problem_answers: {
              data: [{ type: "problem_answer", id: "pa1" }],
            },
          },
        },
        {
          id: "pa1",
          type: "problem_answer",
          attributes: { content: "정답", is_correct: true },
        },
      ],
    });

    const output = await runCommand(MaterialGet, ["1", "--detail"]);
    const parsed = JSON.parse(output);

    expect(mockClient.getActivity).toHaveBeenCalledWith("10", {
      include: expect.stringContaining("problem_collections.pcps.problem"),
    });

    const quiz = parsed.activities[0];
    expect(quiz.problem_collections).toHaveLength(1);
    expect(quiz.problem_collections[0].pcps[0].problem.title).toBe("문제1");
    expect(
      quiz.problem_collections[0].pcps[0].problem.problem_answers[0].content,
    ).toBe("정답");
  });

  it("--detail fetches html_activity_pages", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "자료", is_public: false, is_official: false },
      },
      included: [
        {
          id: "20",
          type: "activity",
          attributes: { name: "HTML", depth: 0 },
          relationships: {
            activitiable: { data: { type: "html_activity", id: "h1" } },
          },
        },
        {
          id: "h1",
          type: "html_activity",
          attributes: {},
        },
      ],
    });

    mockClient.getHtmlActivity.mockResolvedValue({
      data: {
        id: "h1",
        type: "html_activity",
        attributes: {},
        relationships: {
          html_activity_pages: {
            data: [{ type: "html_activity_page", id: "hp1" }],
          },
        },
      },
      included: [
        {
          id: "hp1",
          type: "html_activity_page",
          attributes: {
            url: "https://example.com/page1",
            width: 800,
            height: 600,
          },
        },
      ],
    });

    const output = await runCommand(MaterialGet, ["1", "--detail"]);
    const parsed = JSON.parse(output);

    expect(mockClient.getHtmlActivity).toHaveBeenCalledWith("h1", {
      include: "html_activity_pages",
    });

    const html = parsed.activities[0];
    expect(html.activitiable.html_activity_pages).toHaveLength(1);
    expect(html.activitiable.html_activity_pages[0].url).toBe(
      "https://example.com/page1",
    );
  });

  it("--detail fetches board data", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "자료", is_public: false, is_official: false },
      },
      included: [
        {
          id: "30",
          type: "activity",
          attributes: { name: "보드", depth: 0 },
          relationships: {
            activitiable: { data: { type: "board_activity", id: "b1" } },
          },
        },
        {
          id: "b1",
          type: "board_activity",
          attributes: {},
        },
      ],
    });

    mockClient.listBoards.mockResolvedValue({
      data: [
        {
          id: "board1",
          type: "board",
          attributes: { name: "토론 보드" },
          relationships: {
            board_columns: {
              data: [{ type: "board_column", id: "bc1" }],
            },
          },
        },
      ],
      included: [
        {
          id: "bc1",
          type: "board_column",
          attributes: { name: "첫번째 열" },
        },
      ],
    });

    const output = await runCommand(MaterialGet, ["1", "--detail"]);
    const parsed = JSON.parse(output);

    expect(mockClient.listBoards).toHaveBeenCalledWith({
      "filter[boardable_type]": "Activity",
      "filter[boardable_id]": "30",
      include: "board_columns.root_board_posts",
    });

    const board = parsed.activities[0];
    expect(board.boards).toHaveLength(1);
    expect(board.boards[0].board_columns[0].name).toBe("첫번째 열");
  });

  it("--detail fetches socroom threads", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "자료", is_public: false, is_official: false },
      },
      included: [
        {
          id: "40",
          type: "activity",
          attributes: { name: "소크룸", depth: 0 },
          relationships: {
            activitiable: { data: { type: "socroom_activity", id: "s1" } },
          },
        },
        {
          id: "s1",
          type: "socroom_activity",
          attributes: { max_turn_count: 5 },
        },
      ],
    });

    mockClient.getSocroomActivity.mockResolvedValue({
      data: {
        id: "s1",
        type: "socroom_activity",
        attributes: { max_turn_count: 5, topic: "AI 윤리" },
        relationships: {
          socroom_threads: {
            data: [{ type: "socroom_thread", id: "st1" }],
          },
        },
      },
      included: [
        {
          id: "st1",
          type: "socroom_thread",
          attributes: { status: "completed" },
        },
      ],
    });

    const output = await runCommand(MaterialGet, ["1", "--detail"]);
    const parsed = JSON.parse(output);

    expect(mockClient.getSocroomActivity).toHaveBeenCalledWith("s1", {
      include: "socroom_threads",
    });

    const socroom = parsed.activities[0];
    expect(socroom.activitiable.topic).toBe("AI 윤리");
    expect(socroom.activitiable.socroom_threads[0].status).toBe("completed");
  });

  it("without --detail does not make extra API calls", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "자료", is_public: false, is_official: false },
      },
      included: [
        {
          id: "10",
          type: "activity",
          attributes: { name: "퀴즈", depth: 0 },
          relationships: {
            activitiable: { data: { type: "quiz_activity", id: "q1" } },
          },
        },
        {
          id: "q1",
          type: "quiz_activity",
          attributes: { is_exam: false },
        },
      ],
    });

    await runCommand(MaterialGet, ["1"]);

    expect(mockClient.getActivity).not.toHaveBeenCalled();
    expect(mockClient.getHtmlActivity).not.toHaveBeenCalled();
    expect(mockClient.listBoards).not.toHaveBeenCalled();
    expect(mockClient.getSocroomActivity).not.toHaveBeenCalled();
  });
});

describe("material create", () => {
  it("create", async () => {
    mockClient.createMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "새 자료" }),
    );

    const output = await runCommand(MaterialCreate, ["--name", "새 자료"]);
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("새 자료");
  });

  it("create with body (markdown -> Lexical conversion)", async () => {
    mockClient.createMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "본문 자료" }),
    );

    const output = await runCommand(MaterialCreate, [
      "--name",
      "본문 자료",
      "--body",
      "본문 내용",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("본문 자료");

    const payload = mockClient.createMaterial.mock.calls[0][0];
    const body = payload.data.attributes.body;
    expect(body.root).toBeDefined();
    expect(body.root.type).toBe("root");
    // Lexical로 변환되어 paragraph > text 구조가 됨
    const paragraph = body.root.children[0];
    expect(paragraph.type).toBe("paragraph");
    const textNode = paragraph.children[0];
    expect(textNode.text).toBe("본문 내용");
  });

  it("create without name errors", async () => {
    // --name is required by oclif, so the command will fail before calling createMaterial
    await runCommand(MaterialCreate, []);
    expect(mockClient.createMaterial).not.toHaveBeenCalled();
  });
});

describe("material update", () => {
  it("update", async () => {
    mockClient.updateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "수정됨" }),
    );

    const output = await runCommand(MaterialUpdate, ["1", "--name", "수정됨"]);
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("수정됨");
  });

  it("update with body (markdown -> Lexical conversion)", async () => {
    mockClient.updateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "기존 자료" }),
    );

    const output = await runCommand(MaterialUpdate, [
      "1",
      "--body",
      "수정된 본문",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("1");

    const payload = mockClient.updateMaterial.mock.calls[0][1];
    const body = payload.data.attributes.body;
    expect(body.root).toBeDefined();
    expect(body.root.type).toBe("root");
  });

  it("update without id errors", async () => {
    // id is a required positional arg, so the command will fail before calling updateMaterial
    await runCommand(MaterialUpdate, ["--name", "수정됨"]);
    expect(mockClient.updateMaterial).not.toHaveBeenCalled();
  });

  it("update no changes", async () => {
    const output = await runCommand(MaterialUpdate, ["1"]);
    expect(output).toContain("수정할 항목이 없습니다");
  });
});

describe("material duplicate", () => {
  it("duplicate", async () => {
    mockClient.duplicateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "2", { name: "복제됨" }),
    );

    const output = await runCommand(MaterialDuplicate, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("2");
    expect(parsed.name).toBe("복제됨");
  });

  it("duplicate without id errors", async () => {
    // id is a required positional arg, so the command will fail before calling duplicateMaterial
    await runCommand(MaterialDuplicate, []);
    expect(mockClient.duplicateMaterial).not.toHaveBeenCalled();
  });
});
