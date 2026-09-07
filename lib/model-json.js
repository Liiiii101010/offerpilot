import { jsonrepair } from "jsonrepair";

export function parseModelJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const hasObjectBoundary = start >= 0 && end > start;
  const objectCandidate = hasObjectBoundary ? cleaned.slice(start, end + 1) : cleaned;
  const candidates = [...new Set([cleaned, objectCandidate])];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // Try the next direct candidate before repairing anything.
    }
  }

  if (hasObjectBoundary) {
    try {
      // Models occasionally omit a comma, quote, or closing bracket in an
      // otherwise complete object. Repair syntax only; field normalization
      // and factual constraints are handled separately by the analysis route.
      const repaired = JSON.parse(jsonrepair(objectCandidate));
      if (repaired && typeof repaired === "object" && !Array.isArray(repaired)) return repaired;
    } catch {
      // Fall through to the stable user-facing error below.
    }
  }

  throw new Error("模型返回的结构化结果不完整，系统已尝试自动修复但仍无法读取。请重试；如果连续出现，请切换另一个模型。");
}
