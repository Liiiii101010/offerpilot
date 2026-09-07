import assert from "node:assert/strict";
import test from "node:test";
import { parseModelJson } from "../lib/model-json.js";

test("repairs a missing comma between model-generated array items", () => {
  const result = parseModelJson('{"items":[{"name":"A"} {"name":"B"}],"score":80}');
  assert.equal(result.items.length, 2);
  assert.equal(result.score, 80);
});

test("extracts JSON when a model adds prose and a markdown fence", () => {
  const result = parseModelJson('分析结果如下：\n```json\n{"score":78,"strengths":["证据完整"]}\n```');
  assert.equal(result.score, 78);
  assert.deepEqual(result.strengths, ["证据完整"]);
});

test("returns a readable error when repair is impossible", () => {
  assert.throws(() => parseModelJson("这不是结构化结果"), /系统已尝试自动修复/);
});
