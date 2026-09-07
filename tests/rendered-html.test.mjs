import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the OfferPilot product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /OfferPilot/);
  assert.match(html, /拿到面试/);
  assert.match(html, /选择分析模型/);
  assert.match(html, /OpenAI/);
  assert.match(html, /火山方舟/);
  assert.match(html, /阿里云百炼/);
  assert.match(html, /最多 5 张 JD 截图/);
  assert.match(html, /multiple=""/);
  assert.doesNotMatch(html, /temporary-preview/);
  assert.doesNotMatch(html, /loading placeholder/i);
});

test("rejects an incomplete analysis request", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-api`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", model: "gpt-5.6-luna" }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /简历内容过短/);
});

test("requires a business or HR track for interview follow-up", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-followup`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "interview_followup",
        provider: "openai",
        model: "gpt-5.6-luna",
        apiKey: "test-key",
        resumeText: "这是一份用于接口校验的候选人简历。".repeat(8),
        jdText: "这是一份用于接口校验的完整岗位职责与任职要求。".repeat(8),
      }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /业务侧还是 HR 侧/);
});
