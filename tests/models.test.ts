import { describe, it, expect } from "vitest";
import {
  buildJsonApiPayload,
  extractAttributes,
  extractIncluded,
  extractList,
  extractSingle,
  formatMaterialSummary,
  snakeToPascal,
} from "../src/api/models.js";

describe("buildJsonApiPayload", () => {
  it("basic", () => {
    const result = buildJsonApiPayload("activities", { name: "test" });
    expect(result).toEqual({
      data: { type: "activities", attributes: { name: "test" } },
    });
  });

  it("null/undefined values excluded", () => {
    const result = buildJsonApiPayload("activities", {
      name: "test",
      depth: null,
    });
    const data = result.data as Record<string, unknown>;
    expect(data.attributes).toEqual({ name: "test" });
  });

  it("with id", () => {
    const result = buildJsonApiPayload("activities", { name: "test" }, "42");
    const data = result.data as Record<string, unknown>;
    expect(data.id).toBe("42");
  });

  it("without id", () => {
    const result = buildJsonApiPayload("activities", { name: "test" });
    const data = result.data as Record<string, unknown>;
    expect(data.id).toBeUndefined();
  });

  it("with relationships", () => {
    const rels = {
      activitiable: { data: { type: "quiz_activity", id: "99" } },
    };
    const result = buildJsonApiPayload(
      "activities",
      { name: "test" },
      undefined,
      rels,
    );
    const data = result.data as Record<string, unknown>;
    expect(data.relationships).toEqual(rels);
  });

  it("without relationships", () => {
    const result = buildJsonApiPayload("activities", { name: "test" });
    const data = result.data as Record<string, unknown>;
    expect(data.relationships).toBeUndefined();
  });

  it("false and zero preserved", () => {
    const result = buildJsonApiPayload("problems", {
      is_public: false,
      timeout: 0,
    });
    const data = result.data as Record<string, unknown>;
    expect(data.attributes).toEqual({ is_public: false, timeout: 0 });
  });
});

describe("extractAttributes", () => {
  it("basic", () => {
    const resource = { id: "1", attributes: { name: "test", depth: 0 } };
    const result = extractAttributes(resource);
    expect(result).toEqual({ id: "1", name: "test", depth: 0 });
  });

  it("missing attributes", () => {
    const resource = { id: "1" };
    const result = extractAttributes(resource);
    expect(result).toEqual({ id: "1" });
  });

  it("missing id", () => {
    const resource = { attributes: { name: "test" } };
    const result = extractAttributes(resource);
    expect(result).toEqual({ id: null, name: "test" });
  });
});

describe("extractSingle", () => {
  it("basic", () => {
    const response = {
      data: { id: "1", type: "activity", attributes: { name: "A" } },
    };
    const result = extractSingle(response);
    expect(result).toEqual({ id: "1", name: "A" });
  });

  it("empty data", () => {
    const result = extractSingle({ data: {} });
    expect(result).toEqual({ id: null });
  });

  it("missing data", () => {
    const result = extractSingle({});
    expect(result).toEqual({ id: null });
  });
});

describe("extractList", () => {
  it("basic", () => {
    const response = {
      data: [
        { id: "1", type: "activity", attributes: { name: "A" } },
        { id: "2", type: "activity", attributes: { name: "B" } },
      ],
    };
    const result = extractList(response);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "1", name: "A" });
    expect(result[1]).toEqual({ id: "2", name: "B" });
  });

  it("empty list", () => {
    const result = extractList({ data: [] });
    expect(result).toEqual([]);
  });

  it("missing data", () => {
    const result = extractList({});
    expect(result).toEqual([]);
  });
});

describe("extractIncluded", () => {
  it("filter by type", () => {
    const response = {
      included: [
        { id: "1", type: "activity", attributes: { name: "A" } },
        { id: "2", type: "tag", attributes: { name: "T" } },
        { id: "3", type: "activity", attributes: { name: "B" } },
      ],
    };
    const result = extractIncluded(response, "activity");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("B");
  });

  it("no matches", () => {
    const response = {
      included: [{ id: "1", type: "tag", attributes: {} }],
    };
    const result = extractIncluded(response, "activity");
    expect(result).toEqual([]);
  });

  it("missing included", () => {
    const result = extractIncluded({}, "activity");
    expect(result).toEqual([]);
  });
});

describe("snakeToPascal", () => {
  it("quiz_activity", () => {
    expect(snakeToPascal("quiz_activity")).toBe("QuizActivity");
  });

  it("html_activity", () => {
    expect(snakeToPascal("html_activity")).toBe("HtmlActivity");
  });

  it("single word", () => {
    expect(snakeToPascal("activity")).toBe("Activity");
  });

  it("three words", () => {
    expect(snakeToPascal("ai_recommend_quiz_activity")).toBe(
      "AiRecommendQuizActivity",
    );
  });
});

describe("formatSummaries", () => {
  it("material public", () => {
    const result = formatMaterialSummary({
      id: "1",
      name: "Test",
      is_public: true,
    });
    expect(result).toBe("- [1] Test (공개)");
  });

  it("material private", () => {
    const result = formatMaterialSummary({
      id: "1",
      name: "Test",
      is_public: false,
    });
    expect(result).toBe("- [1] Test (비공개)");
  });

  it("material no name", () => {
    const result = formatMaterialSummary({ id: "1" });
    expect(result).toContain("(무제)");
  });
});
