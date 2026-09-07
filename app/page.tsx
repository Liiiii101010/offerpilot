"use client";

import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Copy,
  FileCheck2,
  FileText,
  Gauge,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  providers,
  sampleJd,
  sampleResult,
  sampleResume,
  type AnalysisResult,
  type EvidenceAnswer,
  type GapType,
  type InterviewFollowUpReport,
  type InterviewTrack,
  type ProviderId,
} from "@/lib/analysis";

type ViewId = "workspace" | "jobs" | "profile";
type ReportTab = "match" | "resume" | "messages" | "interview";

interface SavedAnalysis {
  id: string;
  createdAt: string;
  provider: ProviderId | "demo";
  model: string;
  resumeText: string;
  jdText: string;
  companyContext?: string;
  evidenceAnswers?: EvidenceAnswer[];
  comparisonBaseline?: AnalysisComparisonBaseline;
  interviewFollowUps?: Partial<Record<InterviewTrack, InterviewFollowUpRecord>>;
  result: AnalysisResult;
}

interface InterviewFollowUpRecord {
  track: InterviewTrack;
  createdAt: string;
  previousRoundContext?: string;
  nextRoundContext?: string;
  report: InterviewFollowUpReport;
}

interface JdImagePreview {
  id: string;
  name: string;
  url: string;
  text: string;
}

interface AnalysisComparisonBaseline {
  score: number;
  evidenceMatrix: AnalysisResult["evidenceMatrix"];
}

interface AnalysisRunOptions {
  evidenceAnswers?: EvidenceAnswer[];
  profileOverride?: CandidateProfile;
  comparisonBaseline?: AnalysisComparisonBaseline;
}

const storageKey = "offerpilot-analyses-v1";
const profileStorageKey = "offerpilot-candidate-profile-v1";

interface CandidateProfile {
  baseResume: string;
  baseResumeFileName: string;
  baseResumeUpdatedAt: string;
  targetRoles: string;
  targetIndustries: string;
  preferredLocations: string;
  availability: string;
  coreSkills: string;
  evidenceNotes: string;
}

const emptyProfile: CandidateProfile = {
  baseResume: "",
  baseResumeFileName: "",
  baseResumeUpdatedAt: "",
  targetRoles: "",
  targetIndustries: "",
  preferredLocations: "",
  availability: "",
  coreSkills: "",
  evidenceNotes: "",
};

const navItems: Array<{
  id: ViewId;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "workspace", label: "分析工作台", icon: LayoutDashboard },
  { id: "jobs", label: "岗位档案", icon: BriefcaseBusiness },
  { id: "profile", label: "我的求职", icon: UserRound },
];

const analysisStages = [
  { title: "正在解析岗位要求", detail: "拆分核心职责、加分项与硬性条件" },
  { title: "正在定位经历证据", detail: "逐项核对简历，避免补写不存在的经历" },
  { title: "正在交叉验证缺口", detail: "结合岗位要求与公司业务背景判断优先级" },
  { title: "正在生成完整分析报告", detail: "模型正在组织改写建议、投递文案和10道面试题，这一阶段通常最久" },
];

const followUpAnalysisStages = [
  { title: "正在读取原岗位报告", detail: "提取已经验证过的优势、风险和经历证据" },
  { title: "正在对齐本轮复试重点", detail: "根据业务侧或 HR 侧重新确定考察目标" },
  { title: "正在生成深度追问", detail: "结合简历、JD与可选补充信息准备10道针对性问题" },
  { title: "正在整理复试准备方案", detail: "组织作答框架、反向提问和本轮行动清单，这一阶段通常最久" },
];

function estimateModelProgress(seconds: number) {
  if (seconds <= 3) return 8 + seconds * 4;
  if (seconds <= 10) return 20 + Math.round((seconds - 3) * 3);
  if (seconds <= 25) return 41 + Math.round((seconds - 10) * 2);
  return Math.min(98, Math.round(71 + 27 * (1 - Math.exp(-(seconds - 25) / 70))));
}

function formatElapsedTime(seconds: number) {
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

const reportTabs: Array<{
  id: ReportTab;
  label: string;
  icon: typeof Target;
}> = [
  { id: "match", label: "匹配报告", icon: Target },
  { id: "resume", label: "简历优化", icon: FileCheck2 },
  { id: "messages", label: "投递文案", icon: MessageSquareText },
  { id: "interview", label: "面试准备", icon: BookOpenCheck },
];

const gapTone: Record<GapType, string> = {
  表达缺口: "amber",
  信息缺口: "blue",
  准备缺口: "violet",
  硬性门槛: "red",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function copyText(text: string, setCopied: (value: string) => void, key: string) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1600);
  });
}

function extractEmailAddresses(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((email) => email.replace(/\s/g, "").toLowerCase()))];
}

function recommendationTone(recommendation: AnalysisResult["recommendation"]) {
  if (recommendation === "建议投递") return "recommended";
  if (recommendation === "优化后投递") return "optimize";
  return "low-priority";
}

function interviewFollowUpStatus(item: SavedAnalysis) {
  const businessReady = Boolean(item.interviewFollowUps?.business);
  const hrReady = Boolean(item.interviewFollowUps?.hr);
  if (businessReady && hrReady) return "业务复试与 HR 面试准备已完成";
  if (businessReady) return "已生成业务复试准备";
  if (hrReady) return "已生成 HR 面试准备";
  return "尚未跟进复试";
}

const maxJdImageCount = 5;

function createDemoFollowUp(item: SavedAnalysis, track: InterviewTrack): InterviewFollowUpReport {
  const isBusiness = track === "business";
  const sourceQuestions = item.result.interview.questions;
  return {
    title: isBusiness ? "业务复试 · 深度准备报告" : "HR 面试 · 专项准备报告",
    roundGoal: isBusiness
      ? "把一面的经历陈述继续推进到判断依据、落地细节与岗位迁移能力。"
      : "让岗位动机、现实约束与个人经历保持真实、一致且可被信任。",
    strategy: {
      coreNarrative: isBusiness
        ? `以“${item.result.strengths[0] || "最相关项目经历"}”为主案例，围绕问题定义、方案取舍、推进和复盘形成证据链。`
        : `从真实经历解释为什么选择${item.result.meta.company}的${item.result.meta.role}，同时清楚交代到岗与长期方向。`,
      opening: isBusiness
        ? "60秒说明你对岗位的理解、最相关项目和希望重点展开的专业能力。"
        : "60秒说明个人背景、求职动机、最相关证据与明确的现实安排。",
      questionsToAsk: isBusiness
        ? ["这个岗位当前最优先解决的业务问题是什么？", "团队如何判断方案优先级与成功标准？", "入职前三个月最期待看到什么产出？"]
        : ["后续面试与决策流程如何安排？", "团队最看重候选人的哪些长期特质？", "岗位的反馈与培养机制是怎样的？"],
      riskReminder: item.result.biggestRisk,
    },
    questions: sourceQuestions.map((question, index) => ({
      ...question,
      category: isBusiness ? question.category : ["岗位动机", "职业规划", "稳定性", "到岗约束", "价值观", "沟通成熟度", "自我认知", "团队匹配", "风险核验", "反向提问"][index] || "HR追问",
      question: isBusiness ? question.question : [
        `为什么选择${item.result.meta.company}的${item.result.meta.role}？`,
        "这份岗位与你未来两到三年的职业规划如何连接？",
        "你当前还在推进哪些机会，做选择时最看重什么？",
        "你的到岗时间、持续周期和现实安排是什么？",
        "讲一次你在结果压力和正确做法之间进行取舍的经历。",
        "面对负面反馈或误解时，你如何回应并推动解决？",
        "你当前最需要补齐的能力是什么，如何验证进步？",
        "你在哪种管理和协作方式下表现最好？",
        `针对“${item.result.biggestRisk}”，请说明真实情况和解决计划。`,
        "你希望通过哪些信息判断这份岗位是否真正适合你？",
      ][index] || question.question,
      whyAsked: isBusiness ? question.whyAsked : "验证求职动机、现实约束与候选人表述是否真实一致。",
    })).slice(0, 10),
    tasks: item.result.interview.tasks.map((task, index) => ({
      ...task,
      task: isBusiness ? task.task : ["统一简历、口述与时间线", "准备岗位动机与选择标准", "明确到岗与持续周期", "准备3个HR反向问题", "完成一次HR压力追问模拟"][index] || task.task,
    })).slice(0, 5),
  };
}

async function extractText(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt" || file.type.startsWith("text/")) return file.text();

  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }

  if (extension === "pdf") {
    // Load the worker handler on the page before PDF.js. vinext currently wraps
    // Vite workers with page-only runtime code, so PDF.js runs its compatible
    // in-page worker fallback for the relatively small resume files we accept.
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
    const pdfjs = await import("pdfjs-dist");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" "),
      );
    }
    return pages.join("\n");
  }

  throw new Error("暂时支持 PDF、DOCX 和 TXT 文件");
}

export default function Home() {
  const [view, setView] = useState<ViewId>("workspace");
  const [reportTab, setReportTab] = useState<ReportTab>("match");
  const [provider, setProvider] = useState<ProviderId>("doubao");
  const [model, setModel] = useState(providers.doubao.defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [jdImagePreviews, setJdImagePreviews] = useState<JdImagePreview[]>([]);
  const [previewingJdImage, setPreviewingJdImage] = useState<JdImagePreview | null>(null);
  const [isReadingJdImage, setIsReadingJdImage] = useState(false);
  const [jdOcrProgress, setJdOcrProgress] = useState(0);
  const [jdOcrBatchSize, setJdOcrBatchSize] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>(emptyProfile);
  const [savedNotice, setSavedNotice] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const [accepted, setAccepted] = useState<number[]>([]);
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, string>>({});
  const [comparisonBaseline, setComparisonBaseline] = useState<AnalysisComparisonBaseline | null>(null);
  const [evidenceActionError, setEvidenceActionError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jdImageInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const analysisTimersRef = useRef<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // Reading browser-only history after hydration keeps the server render deterministic.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSaved(JSON.parse(raw) as SavedAnalysis[]);
    } catch {
      localStorage.removeItem(storageKey);
    }
    try {
      const rawProfile = localStorage.getItem(profileStorageKey);
      if (rawProfile) {
        const storedProfile = { ...emptyProfile, ...(JSON.parse(rawProfile) as CandidateProfile) };
        setCandidateProfile(storedProfile);
        if (storedProfile.baseResume) {
          setResumeText(storedProfile.baseResume);
          setResumeFileName(storedProfile.baseResumeFileName || "我的求职 · 基础简历");
        }
      }
    } catch {
      localStorage.removeItem(profileStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!previewingJdImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewingJdImage(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [previewingJdImage]);

  const activeProvider = providers[provider];
  const modelIsPreset = activeProvider.models.some((item) => item.id === model);
  const activeModel = activeProvider.models.find((item) => item.id === model);
  const canAnalyze = resumeText.trim().length >= 80 && jdText.trim().length >= 80;

  const completion = useMemo(() => {
    if (!result) return 0;
    const base = 62;
    const resume = accepted.length > 0 ? 14 : 0;
    const materials = copied ? 12 : 0;
    return Math.min(100, base + resume + materials);
  }, [accepted.length, copied, result]);

  const estimatedAnalysisProgress = useMemo(() => estimateModelProgress(analysisElapsed), [analysisElapsed]);

  function changeProvider(next: ProviderId) {
    setProvider(next);
    setModel(providers[next].defaultModel);
    setApiKey("");
  }

  function clearJdImagePreviews() {
    setJdImagePreviews((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
    setPreviewingJdImage(null);
  }

  async function onFile(file?: File) {
    if (!file) return;
    setError("");
    setIsParsing(true);
    try {
      const text = await extractText(file);
      if (text.trim().length < 40) throw new Error("没有读取到足够的文字，请上传文字版简历");
      setResumeText(text.trim());
      setResumeFileName(file.name);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "简历读取失败");
    } finally {
      setIsParsing(false);
    }
  }

  async function onJdImages(files?: FileList | File[]) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;
    if (isReadingJdImage) {
      setError("上一批 JD 图片仍在识别，请完成后再继续上传");
      return;
    }
    if (jdImagePreviews.length + selectedFiles.length > maxJdImageCount) {
      setError(`JD 图片最多上传 ${maxJdImageCount} 张；当前已有 ${jdImagePreviews.length} 张，本次最多还能上传 ${maxJdImageCount - jdImagePreviews.length} 张`);
      if (jdImageInputRef.current) jdImageInputRef.current.value = "";
      return;
    }
    const unsupportedFile = selectedFiles.find((file) => !file.type.startsWith("image/"));
    if (unsupportedFile) {
      setError("JD 图片仅支持 PNG、JPG、JPEG 或 WebP 格式");
      return;
    }
    const oversizedFile = selectedFiles.find((file) => file.size > 10 * 1024 * 1024);
    if (oversizedFile) {
      setError(`JD 图片“${oversizedFile.name}”超过 10 MB，请压缩后重试`);
      return;
    }
    setError("");
    setIsReadingJdImage(true);
    setJdOcrProgress(0);
    setJdOcrBatchSize(selectedFiles.length);
    try {
      const { recognize } = await import("tesseract.js");
      const recognized: Array<{ file: File; name: string; text: string }> = [];
      const failedNames: string[] = [];
      for (const [index, file] of selectedFiles.entries()) {
        try {
          const recognition = await recognize(file, "chi_sim+eng", {
            logger: (message: { status: string; progress: number }) => {
              if (message.status === "recognizing text") {
                const batchProgress = ((index + message.progress) / selectedFiles.length) * 100;
                setJdOcrProgress(Math.round(batchProgress));
              }
            },
          });
          const text = recognition.data.text
            .trim()
            .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n");
          if (text.length < 20) throw new Error("没有识别到足够文字");
          recognized.push({ file, name: file.name, text });
        } catch {
          failedNames.push(file.name);
        }
      }
      if (recognized.length === 0) {
        throw new Error("没有从这批图片中识别到足够文字，请上传更清晰、方向正确的截图");
      }
      const startIndex = jdImagePreviews.length;
      const recognizedSections = recognized
        .map((item, index) => `【JD 截图 ${startIndex + index + 1}】\n${item.text}`)
        .join("\n\n");
      setJdText((current) => current.trim() ? `${current.trim()}\n\n${recognizedSections}` : recognizedSections);
      setJdImagePreviews((current) => [
        ...current,
        ...recognized.map((item) => ({
          id: crypto.randomUUID(),
          name: item.name,
          url: URL.createObjectURL(item.file),
          text: item.text,
        })),
      ]);
      setJdOcrProgress(100);
      if (failedNames.length > 0) {
        setError(`已识别 ${recognized.length} 张；${failedNames.join("、")} 未识别到足够文字，请更换清晰图片`);
      }
    } catch (imageError) {
      setError(imageError instanceof Error ? `JD 图片读取失败：${imageError.message}` : "JD 图片读取失败，请重试");
    } finally {
      setIsReadingJdImage(false);
      setJdOcrBatchSize(0);
      if (jdImageInputRef.current) jdImageInputRef.current.value = "";
    }
  }

  function removeJdImage(imageId: string) {
    if (isReadingJdImage) return;
    const imageIndex = jdImagePreviews.findIndex((image) => image.id === imageId);
    if (imageIndex < 0) return;
    const image = jdImagePreviews[imageIndex];
    const section = `【JD 截图 ${imageIndex + 1}】\n${image.text}`;
    URL.revokeObjectURL(image.url);
    setJdImagePreviews((current) => current.filter((item) => item.id !== imageId));
    setPreviewingJdImage((current) => current?.id === imageId ? null : current);
    setJdText((current) => {
      let nextIndex = 0;
      return current
        .replace(section, "")
        .replace(/【JD 截图 \d+】/g, () => `【JD 截图 ${nextIndex += 1}】`)
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    });
  }

  function loadSample() {
    setResumeText(sampleResume);
    setJdText(sampleJd);
    setResumeFileName("林晓_产品实习生简历.pdf");
    clearJdImagePreviews();
    setError("");
  }

  function startNewAnalysis() {
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    analysisTimersRef.current.forEach(window.clearTimeout);
    analysisTimersRef.current = [];
    setView("workspace");
    setReportTab("match");
    setResumeText(candidateProfile.baseResume);
    setJdText("");
    setCompanyContext("");
    setResumeFileName(candidateProfile.baseResume ? candidateProfile.baseResumeFileName || "我的求职 · 基础简历" : "");
    clearJdImagePreviews();
    setIsReadingJdImage(false);
    setJdOcrProgress(0);
    setApiKey("");
    setResult(null);
    setError("");
    setCopied("");
    setAccepted([]);
    setEvidenceDrafts({});
    setComparisonBaseline(null);
    setEvidenceActionError("");
    setIsParsing(false);
    setIsAnalyzing(false);
    setAnalysisStep(0);
    setAnalysisElapsed(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (jdImageInputRef.current) jdImageInputRef.current.value = "";
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveCandidateProfile(nextProfile: CandidateProfile) {
    setCandidateProfile(nextProfile);
    localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
    setProfileSavedNotice(true);
    window.setTimeout(() => setProfileSavedNotice(false), 1800);
  }

  function useProfileForAnalysis(nextProfile: CandidateProfile) {
    saveCandidateProfile(nextProfile);
    startNewAnalysis();
    setResumeText(nextProfile.baseResume);
    setResumeFileName(nextProfile.baseResume ? nextProfile.baseResumeFileName || "我的求职 · 基础简历" : "");
  }

  function profileWithEvidenceAnswers(answers: EvidenceAnswer[]) {
    const newEntries = answers.filter(({ question, answer }) => {
      const entry = `问题：${question}\n回答：${answer}`;
      return !candidateProfile.evidenceNotes.includes(entry);
    });
    if (newEntries.length === 0) return candidateProfile;
    const heading = `【岗位证据补全 · ${result?.meta.company || "目标公司"} · ${result?.meta.role || "目标岗位"}】`;
    const evidenceBlock = [heading, ...newEntries.map(({ question, answer }) => `问题：${question}\n回答：${answer}`)].join("\n");
    return {
      ...candidateProfile,
      evidenceNotes: [candidateProfile.evidenceNotes.trim(), evidenceBlock].filter(Boolean).join("\n\n"),
    };
  }

  function saveEvidenceAnswers(answers: EvidenceAnswer[]) {
    const nextProfile = profileWithEvidenceAnswers(answers);
    saveCandidateProfile(nextProfile);
    return nextProfile;
  }

  async function reanalyzeWithEvidence(answers: EvidenceAnswer[]) {
    if (!result) return;
    const nextProfile = saveEvidenceAnswers(answers);
    await analyze(false, {
      evidenceAnswers: answers,
      profileOverride: nextProfile,
      comparisonBaseline: { score: result.score, evidenceMatrix: result.evidenceMatrix },
    });
  }

  function persistAnalysis(nextResult: AnalysisResult, usedProvider: ProviderId | "demo", options?: AnalysisRunOptions) {
    const item: SavedAnalysis = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      provider: usedProvider,
      model: usedProvider === "demo" ? "内置示例" : model,
      resumeText,
      jdText,
      companyContext,
      evidenceAnswers: options?.evidenceAnswers,
      comparisonBaseline: options?.comparisonBaseline,
      result: nextResult,
    };
    const next = [item, ...saved].slice(0, 100);
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  }

  async function analyze(useDemo = false, options?: AnalysisRunOptions) {
    if (!canAnalyze) {
      setError("请先提供完整简历和岗位描述");
      return;
    }
    const isEvidenceRerun = Boolean(options?.evidenceAnswers?.length);
    setError("");
    setEvidenceActionError("");
    if (!isEvidenceRerun) {
      setResult(null);
      setComparisonBaseline(null);
      setEvidenceDrafts({});
    }
    setReportTab("match");
    setAccepted([]);
    setIsAnalyzing(true);
    setAnalysisStep(0);
    setAnalysisElapsed(0);

    const controller = new AbortController();
    analysisControllerRef.current = controller;

    const timers = [
      window.setTimeout(() => setAnalysisStep(1), 3_000),
      window.setTimeout(() => setAnalysisStep(2), 10_000),
      window.setTimeout(() => setAnalysisStep(3), 25_000),
    ];
    analysisTimersRef.current = timers;
    const elapsedTimer = window.setInterval(() => setAnalysisElapsed((seconds) => seconds + 1), 1_000);

    try {
      if (useDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        if (controller.signal.aborted) return;
        setResult(sampleResult);
        persistAnalysis(sampleResult, "demo", options);
      } else {
        const profileForRun = options?.profileOverride ?? candidateProfile;
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            model,
            apiKey,
            resumeText,
            jdText,
            companyContext,
            evidenceAnswers: options?.evidenceAnswers ?? [],
            profileContext: [
              profileForRun.targetRoles && `求职方向：${profileForRun.targetRoles}`,
              profileForRun.targetIndustries && `目标行业：${profileForRun.targetIndustries}`,
              profileForRun.preferredLocations && `期望地点：${profileForRun.preferredLocations}`,
              profileForRun.availability && `求职约束：${profileForRun.availability}`,
              profileForRun.coreSkills && `核心能力：${profileForRun.coreSkills}`,
              profileForRun.evidenceNotes && `候选人补充证据：${profileForRun.evidenceNotes}`,
            ].filter(Boolean).join("\n"),
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { result?: AnalysisResult; error?: string };
        if (!response.ok || !data.result) throw new Error(data.error || "分析失败，请重试");
        setResult(data.result);
        setComparisonBaseline(options?.comparisonBaseline ?? null);
        setEvidenceDrafts({});
        persistAnalysis(data.result, provider, options);
      }
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (analysisError) {
      if (!(analysisError instanceof Error && analysisError.name === "AbortError")) {
        const message = analysisError instanceof Error ? analysisError.message : "分析失败，请重试";
        setError(message);
        if (isEvidenceRerun) setEvidenceActionError(message);
      }
    } finally {
      timers.forEach(window.clearTimeout);
      window.clearInterval(elapsedTimer);
      analysisTimersRef.current = [];
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null;
      setIsAnalyzing(false);
      setAnalysisStep(0);
      setAnalysisElapsed(0);
      setApiKey("");
    }
  }

  function openSaved(item: SavedAnalysis) {
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    analysisTimersRef.current.forEach(window.clearTimeout);
    analysisTimersRef.current = [];
    setIsAnalyzing(false);
    setAnalysisStep(0);
    setAnalysisElapsed(0);
    setResumeText(item.resumeText);
    setJdText(item.jdText);
    setCompanyContext(item.companyContext ?? "");
    setResumeFileName("");
    clearJdImagePreviews();
    setResult(item.result);
    setComparisonBaseline(item.comparisonBaseline ?? null);
    setEvidenceDrafts({});
    setEvidenceActionError("");
    setView("workspace");
    setReportTab("match");
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
  }

  function removeSaved(id: string) {
    const next = saved.filter((item) => item.id !== id);
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function saveInterviewFollowUp(id: string, followUp: InterviewFollowUpRecord) {
    setSaved((current) => {
      const next = current.map((item) => item.id === id
        ? { ...item, interviewFollowUps: { ...item.interviewFollowUps, [followUp.track]: followUp } }
        : item);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  }

  return (
    <div className="app-shell">
      <aside className={cx("sidebar", mobileNavOpen && "open")}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={18} strokeWidth={2.4} /></div>
          <div>
            <strong>OfferPilot</strong>
            <span>求职行动 Copilot</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="关闭导航"><X size={20} /></button>
        </div>

        <button className="sidebar-new-analysis" onClick={startNewAnalysis}>
          <Plus size={18} />
          <span>新建分析</span>
        </button>

        <nav className="main-nav" aria-label="主导航">
          <span className="nav-eyebrow">工作空间</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cx("nav-item", view === item.id && "active")}
                onClick={() => {
                  setView(item.id);
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "jobs" && saved.length > 0 && <b>{saved.length}</b>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-guide">
          <div className="guide-icon"><ShieldCheck size={18} /></div>
          <div>
            <strong>本地优先</strong>
            <p>档案仅保存在当前设备。模型密钥不会写入浏览器。</p>
          </div>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>开源自托管版</span>
          <span>v0.8.0</span>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="关闭导航遮罩" />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="打开导航"><LayoutDashboard size={20} /></button>
          <div className="topbar-context">
            <span>{view === "workspace" ? "分析工作台" : navItems.find((item) => item.id === view)?.label}</span>
            <ChevronRight size={14} />
            <strong>{result ? result.meta.role : "新建分析"}</strong>
          </div>
          <div className="topbar-actions">
            <span className="privacy-chip"><LockKeyhole size={14} /> 密钥不持久化</span>
          </div>
        </header>

        {view === "workspace" && (
          <div className="page-content">
            <section className="hero-section">
              <div>
                <span className="section-kicker"><WandSparkles size={15} /> EVIDENCE-FIRST CAREER COPILOT</span>
                <h1>把一份 JD，变成一条<br /><em>拿到面试</em>的行动路径。</h1>
                <p>不只给匹配分。OfferPilot 会逐项找到经历证据，识别真正缺口，并生成可信的投递材料。</p>
              </div>
              <div className="hero-metric">
                <div className="metric-orbit"><span>{result?.score ?? "—"}</span><small>岗位匹配</small></div>
                <div className="metric-copy">
                  <strong>{result ? result.recommendation : "等待分析"}</strong>
                  <span>{result ? `置信度 ${result.confidence}` : "先上传简历和目标岗位"}</span>
                </div>
              </div>
            </section>

            <section className="setup-card">
              <div className="card-heading">
                <div>
                  <span className="step-label">STEP 01</span>
                  <h2>准备你的材料</h2>
                  <p>简历负责说明你做过什么，JD 负责定义这次分析的标准。</p>
                </div>
                <button className="text-button" onClick={loadSample}><Sparkles size={15} /> 填入示例材料</button>
              </div>

              <div className="material-grid">
                <div className="material-column">
                  <div className="field-label"><span>01</span> 候选人简历 <b>必填</b></div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,text/plain,application/pdf"
                    hidden
                    onChange={(event) => onFile(event.target.files?.[0])}
                  />
                  <button
                    className={cx("upload-zone", resumeText && "has-file")}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      onFile(event.dataTransfer.files?.[0]);
                    }}
                  >
                    {isParsing ? (
                      <><LoaderCircle className="spin" size={25} /><strong>正在读取简历…</strong></>
                    ) : resumeText ? (
                      <>
                        <span className="upload-success"><FileCheck2 size={22} /></span>
                        <strong>{resumeFileName || "已粘贴简历内容"}</strong>
                        <small>{resumeText.length.toLocaleString()} 个字符 · 点击重新上传</small>
                      </>
                    ) : (
                      <>
                        <span className="upload-icon"><UploadCloud size={24} /></span>
                        <strong>拖拽简历到这里，或点击上传</strong>
                        <small>支持 PDF、DOCX、TXT · 最大 10 MB</small>
                      </>
                    )}
                  </button>
                  <details className="paste-details" open={Boolean(resumeText && !resumeFileName)}>
                    <summary>也可以直接粘贴简历文字</summary>
                    <textarea
                      value={resumeText}
                      onChange={(event) => {
                        setResumeText(event.target.value);
                        setResumeFileName("");
                      }}
                      placeholder="粘贴教育、实习、项目和技能经历…"
                    />
                  </details>
                </div>

                <div className="material-column">
                  <div className="field-label"><span>02</span> 目标岗位 JD <b>必填</b></div>
                  <input
                    ref={jdImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    multiple
                    hidden
                    onChange={(event) => onJdImages(event.target.files ?? undefined)}
                  />
                  <div
                    className={cx("textarea-wrap", "jd-drop-zone", isReadingJdImage && "reading")}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      onJdImages(event.dataTransfer.files);
                    }}
                  >
                    <div className="jd-image-toolbar">
                      <div>
                        {isReadingJdImage ? <LoaderCircle className="spin" size={17} /> : <ImagePlus size={17} />}
                        <span>{isReadingJdImage ? `正在本地识别 ${jdOcrBatchSize} 张图片 · ${jdOcrProgress}%` : jdImagePreviews.length > 0 ? `已识别 ${jdImagePreviews.length}/${maxJdImageCount} 张` : `支持粘贴文字，可拖入最多 ${maxJdImageCount} 张 JD 截图`}</span>
                      </div>
                      <button type="button" disabled={isReadingJdImage || jdImagePreviews.length >= maxJdImageCount} onClick={() => jdImageInputRef.current?.click()}>{isReadingJdImage ? "识别中" : jdImagePreviews.length >= maxJdImageCount ? "已达上限" : jdImagePreviews.length > 0 ? "继续上传" : "上传图片"}</button>
                    </div>
                    {jdImagePreviews.length > 0 && (
                      <div className="jd-attachment-strip" aria-label={`已上传 ${jdImagePreviews.length} 张 JD 截图`}>
                        {jdImagePreviews.map((image, index) => (
                          <div key={image.id} className="jd-attachment">
                            <button type="button" className="jd-attachment-preview" title={image.name} aria-label={`预览 JD 截图 ${index + 1}`} onClick={() => setPreviewingJdImage(image)}>
                              {/* Blob URLs are local previews and should not be sent through an image optimizer. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={image.url} alt="" />
                              <span>{index + 1}</span>
                            </button>
                            <button type="button" className="jd-attachment-remove" disabled={isReadingJdImage} aria-label={`删除 JD 截图 ${index + 1}`} onClick={() => removeJdImage(image.id)}><X size={12} strokeWidth={2.8} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      className="jd-textarea"
                      value={jdText}
                      onChange={(event) => setJdText(event.target.value)}
                      placeholder="粘贴完整的岗位职责与任职要求…"
                    />
                    <div className="textarea-footer">
                      <span>{jdText.length.toLocaleString()} 字符</span>
                      {jdText && <button onClick={() => { setJdText(""); clearJdImagePreviews(); }}><Trash2 size={14} /> 清空</button>}
                    </div>
                  </div>
                </div>
              </div>
              <details className="company-context-details">
                <summary><BriefcaseBusiness size={16} /> 补充公司 / 业务背景 <span>建议填写，可让面试问题更有针对性</span></summary>
                <textarea
                  value={companyContext}
                  onChange={(event) => setCompanyContext(event.target.value)}
                  placeholder="例如：公司核心产品、目标用户、商业模式、近期重点业务，或招聘页面中的公司介绍。若留空，AI只会根据JD谨慎推断。"
                />
              </details>
            </section>

            <section className="model-card">
              <div className="card-heading compact">
                <div>
                  <span className="step-label">STEP 02</span>
                  <h2>选择分析模型</h2>
                  <p>你使用自己的模型账户，费用由对应供应商直接结算。</p>
                </div>
                <span className="byok-badge"><KeyRound size={15} /> BYOK</span>
              </div>

              <div className="model-config-grid">
                <label>
                  <span>模型供应商</span>
                  <select value={provider} onChange={(event) => changeProvider(event.target.value as ProviderId)}>
                    {(Object.keys(providers) as ProviderId[]).map((id) => <option key={id} value={id}>{providers[id].shortName} · {providers[id].name}</option>)}
                  </select>
                  <small>{activeProvider.description}</small>
                </label>
                <label>
                  <span>常用模型</span>
                  <select
                    value={modelIsPreset ? model : "__custom__"}
                    onChange={(event) => setModel(event.target.value === "__custom__" ? "" : event.target.value)}
                  >
                    {activeProvider.models.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.note}</option>)}
                    <option value="__custom__">自定义模型 ID…</option>
                  </select>
                  <small>{activeModel?.note ?? "使用供应商控制台中可调用的模型 ID"}</small>
                </label>
                <label>
                  <span>临时 API Key <i>可留空使用部署环境密钥</i></span>
                  <div className="key-input"><LockKeyhole size={16} /><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={activeProvider.keyHint} /></div>
                </label>
              </div>
              {!modelIsPreset && (
                <label className="custom-model-field">
                  <span>自定义模型 ID</span>
                  <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={`例如：${activeProvider.defaultModel}`} />
                </label>
              )}
              <div className="credential-note"><ShieldCheck size={16} /><span>临时密钥仅随本次请求发送到你部署的服务端，分析结束后立即从页面清除，不写入本地存储。</span></div>

              {error && <div className="error-banner"><CircleAlert size={17} /><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}

              <div className="analyze-actions">
                <button className="secondary-action" disabled={!canAnalyze || isAnalyzing} onClick={() => analyze(true)}><Sparkles size={17} /> 用示例结果演示</button>
                <button className="primary-action" disabled={!canAnalyze || isAnalyzing} onClick={() => analyze(false)}>
                  {isAnalyzing ? <><LoaderCircle className="spin" size={18} /> 正在分析</> : <>开始真实分析 <ArrowRight size={18} /></>}
                </button>
              </div>
            </section>

            {isAnalyzing && (
              <section className="analysis-progress" aria-live="polite">
                <div className="progress-copy"><span className="analysis-mark"><Sparkles size={20} /></span><div><strong>{analysisStages[analysisStep].title}</strong><p>{analysisStages[analysisStep].detail}</p></div><span className="elapsed-time"><b>{estimatedAnalysisProgress}%</b><small><Clock3 size={12} /> {formatElapsedTime(analysisElapsed)}</small></span></div>
                <div className="progress-track estimated"><span style={{ width: `${estimatedAnalysisProgress}%` }} /></div>
                <div className="progress-steps">
                  {["解析岗位要求", "定位经历证据", "交叉验证缺口", "生成完整报告"].map((step, index) => <span key={step} className={cx(index < analysisStep && "done", index === analysisStep && "current")}><i>{index < analysisStep ? <Check size={12} /> : index + 1}</i>{step}</span>)}
                </div>
                <div className="progress-wait-note"><Clock3 size={15} /><span>百分比根据处理阶段与已用时动态估算，实际完成以报告成功生成为准；复杂模型在最后阶段会增长得更慢。</span></div>
              </section>
            )}

            {result && (
              <div ref={resultRef} className="report-shell">
                <section className="report-hero">
                  <div className="report-score"><div className="score-ring" style={{ "--score": result.score } as React.CSSProperties}><span>{result.score}</span><small>/ 100</small></div><div><span className="recommendation-tag"><BadgeCheck size={15} /> {result.recommendation}</span><h2>{result.meta.company} · {result.meta.role}</h2><p>{result.verdict}</p></div></div>
                  <div className="report-progress"><span>准备完成度</span><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div><small>再处理关键缺口，即可形成完整投递包</small></div>
                </section>

                <div className="report-tabs" role="tablist">
                  {reportTabs.map((tab) => {
                    const Icon = tab.icon;
                    return <button key={tab.id} role="tab" aria-selected={reportTab === tab.id} className={cx(reportTab === tab.id && "active")} onClick={() => setReportTab(tab.id)}><Icon size={17} />{tab.label}</button>;
                  })}
                </div>

                {reportTab === "match" && <MatchReport result={result} comparisonBaseline={comparisonBaseline} evidenceDrafts={evidenceDrafts} setEvidenceDrafts={setEvidenceDrafts} onSaveEvidence={saveEvidenceAnswers} onReanalyze={reanalyzeWithEvidence} isAnalyzing={isAnalyzing} evidenceActionError={evidenceActionError} providerName={activeProvider.name} />}
                {reportTab === "resume" && <ResumeReport result={result} accepted={accepted} setAccepted={setAccepted} copied={copied} setCopied={setCopied} />}
                {reportTab === "messages" && <MessageReport result={result} jdText={jdText} copied={copied} setCopied={setCopied} />}
                {reportTab === "interview" && <InterviewReport result={result} />}
              </div>
            )}
          </div>
        )}

        {view === "jobs" && <JobsView saved={saved} openSaved={openSaved} removeSaved={removeSaved} startNewAnalysis={startNewAnalysis} saveInterviewFollowUp={saveInterviewFollowUp} />}
        {view === "profile" && <ProfileView profile={candidateProfile} setProfile={setCandidateProfile} onSave={saveCandidateProfile} onUse={useProfileForAnalysis} />}
      </main>

      {previewingJdImage && (
        <div className="jd-preview-backdrop" role="dialog" aria-modal="true" aria-label="JD 截图预览">
          <button className="jd-preview-dismiss" type="button" aria-label="关闭 JD 截图预览" onClick={() => setPreviewingJdImage(null)} />
          <div className="jd-preview-dialog">
            <header>
              <span>JD 截图预览</span>
              <button type="button" onClick={() => setPreviewingJdImage(null)} aria-label="关闭预览"><X size={19} /></button>
            </header>
            {/* Blob URLs are local previews and should not be sent through an image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewingJdImage.url} alt="已上传的 JD 截图预览" />
          </div>
        </div>
      )}
      {savedNotice && <div className="toast"><Check size={16} /> 已保存到本机岗位档案</div>}
      {profileSavedNotice && <div className="toast"><Check size={16} /> 求职画像已保存到当前设备</div>}
    </div>
  );
}

function MatchReport({
  result,
  comparisonBaseline,
  evidenceDrafts,
  setEvidenceDrafts,
  onSaveEvidence,
  onReanalyze,
  isAnalyzing,
  evidenceActionError,
  providerName,
}: {
  result: AnalysisResult;
  comparisonBaseline: AnalysisComparisonBaseline | null;
  evidenceDrafts: Record<string, string>;
  setEvidenceDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveEvidence: (answers: EvidenceAnswer[]) => CandidateProfile;
  onReanalyze: (answers: EvidenceAnswer[]) => Promise<void>;
  isAnalyzing: boolean;
  evidenceActionError: string;
  providerName: string;
}) {
  const evidenceAnswers = result.followUpQuestions
    .map((question) => ({ question, answer: evidenceDrafts[question]?.trim() ?? "" }))
    .filter((item) => item.answer.length >= 8);
  const currentProven = result.evidenceMatrix.filter((item) => item.status === "已充分证明").length;
  const currentUnresolved = result.evidenceMatrix.filter((item) => item.status === "信息不足" || item.status === "当前缺失").length;
  const previousProven = comparisonBaseline?.evidenceMatrix.filter((item) => item.status === "已充分证明").length ?? 0;
  const previousUnresolved = comparisonBaseline?.evidenceMatrix.filter((item) => item.status === "信息不足" || item.status === "当前缺失").length ?? 0;
  const scoreDelta = comparisonBaseline ? result.score - comparisonBaseline.score : 0;

  return (
    <div className="report-content">
      {comparisonBaseline && (
        <section className="evidence-change-card" aria-label="证据补全前后变化">
          <div><span><BadgeCheck size={19} /></span><div><small>证据补全结果</small><strong>AI 已重新核对岗位要求与新增事实</strong></div></div>
          <dl>
            <div><dt>匹配分</dt><dd><span>{comparisonBaseline.score}</span><ArrowRight size={14} /><b>{result.score}</b><em className={scoreDelta >= 0 ? "positive" : "negative"}>{scoreDelta >= 0 ? "+" : ""}{scoreDelta}</em></dd></div>
            <div><dt>充分证明</dt><dd><span>{previousProven} 项</span><ArrowRight size={14} /><b>{currentProven} 项</b></dd></div>
            <div><dt>待补证据</dt><dd><span>{previousUnresolved} 项</span><ArrowRight size={14} /><b>{currentUnresolved} 项</b></dd></div>
          </dl>
        </section>
      )}

      {(result.evidenceReview?.length ?? 0) > 0 && (
        <section className="panel evidence-review-panel">
          <div className="panel-title"><div><span>AI</span><h3>本轮补充证据审核</h3></div><small>{result.evidenceReview?.filter((item) => item.status === "证据充分").length ?? 0} / {result.evidenceReview?.length ?? 0} 条可采用</small></div>
          <div className="evidence-review-list">
            {result.evidenceReview?.map((review, index) => (
              <article key={`${review.question}-${index}`} className={cx("evidence-review-item", review.status === "证据充分" && "approved", review.status === "需要补充" && "partial", review.status === "无法采用" && "rejected")}>
                <div><b>{index + 1}</b><span><small>{review.question}</small><strong>{review.status}</strong></span></div>
                <blockquote>{review.answer}</blockquote>
                {review.usableEvidence && <p><BadgeCheck size={15} /><span><b>已采用事实</b>{review.usableEvidence}</span></p>}
                <footer><Lightbulb size={15} /><span>{review.feedback}</span></footer>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="report-grid">
        <section className="panel dimension-panel">
          <div className="panel-title"><div><span>01</span><h3>能力匹配画像</h3></div><small>置信度 {result.confidence}</small></div>
          <div className="dimension-list">
            {result.dimensions.map((dimension) => (
              <div className="dimension-row" key={dimension.name}>
                <div><strong>{dimension.name}</strong><span>权重 {dimension.weight}%</span></div>
                <div className="dimension-bar"><i style={{ width: `${dimension.score}%` }} /></div>
                <b>{dimension.score}</b>
                <p>{dimension.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel signal-panel">
          <div className="panel-title"><div><span>02</span><h3>投递信号</h3></div></div>
          <div className="signal-block positive"><span><BadgeCheck size={17} /></span><div><strong>最强证据</strong>{result.strengths.map((item) => <p key={item}>{item}</p>)}</div></div>
          <div className="signal-block risk"><span><CircleAlert size={17} /></span><div><strong>最大风险</strong><p>{result.biggestRisk}</p></div></div>
        </section>
      </div>

      <section className="panel evidence-panel">
        <div className="panel-title"><div><span>03</span><h3>岗位要求 × 经历证据</h3></div><small>{result.evidenceMatrix.length} 项要求已核对</small></div>
        <div className="evidence-table">
          <div className="evidence-head"><span>岗位要求</span><span>当前状态</span><span>简历证据</span><span>下一步</span></div>
          {result.evidenceMatrix.map((item, index) => (
            <div className="evidence-row" key={`${item.requirement}-${index}`}>
              <div><span className={cx("importance", item.importance)}>{item.importance}</span><strong>{item.requirement}</strong></div>
              <div><span className={cx("status-label", item.status)}>{item.status}</span><small>证据 {item.strength}</small></div>
              <p>{item.evidence}</p>
              <p>{item.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel gap-panel">
        <div className="panel-title"><div><span>04</span><h3>优先处理的经历缺口</h3></div><small>缺口不等于不适合</small></div>
        <div className="gap-grid">
          {result.gaps.map((gap) => (
            <article className={cx("gap-card", gapTone[gap.type])} key={`${gap.type}-${gap.title}`}>
              <span>{gap.type}</span><h4>{gap.title}</h4><p>{gap.description}</p><div><Lightbulb size={15} />{gap.action}</div>
            </article>
          ))}
        </div>
      </section>

      {result.followUpQuestions.length > 0 && (
        <section className="panel evidence-completion-panel">
          <div className="panel-title"><div><span>05</span><h3>补全真实经历证据</h3></div><small>{evidenceAnswers.length} / {result.followUpQuestions.length} 题已填写</small></div>
          <div className="evidence-completion-intro"><span><MessageSquareText size={20} /></span><div><strong>回答后让 AI 重新判断，而不是直接把文字当作能力证明</strong><p>尽量写清场景、你的具体动作、职责边界和可核验结果。AI 会逐条判断“证据充分、需要补充或无法采用”。</p></div></div>
          <div className="evidence-question-list">
            {result.followUpQuestions.map((question, index) => {
              const answer = evidenceDrafts[question] ?? "";
              return (
                <label key={question}>
                  <span><b>{String(index + 1).padStart(2, "0")}</b><strong>{question}</strong></span>
                  <textarea value={answer} onChange={(event) => setEvidenceDrafts((current) => ({ ...current, [question]: event.target.value }))} placeholder="用真实经历回答；不知道或没有相关经历，也可以如实说明……" />
                  <small className={answer.trim().length >= 8 ? "ready" : undefined}>{answer.trim().length} 字 · 至少填写 8 个字后可提交</small>
                </label>
              );
            })}
          </div>
          {evidenceActionError && <div className="evidence-action-error"><CircleAlert size={16} /><span>{evidenceActionError}</span></div>}
          <div className="evidence-completion-actions">
            <p><ShieldCheck size={15} /><span>回答将保存到“我的求职”的项目细节中。重新分析使用 <b>{providerName}</b>；如部署环境没有密钥，请先在上方 Step 2 输入临时 API Key。</span></p>
            <div>
              <button className="secondary-action" disabled={evidenceAnswers.length === 0 || isAnalyzing} onClick={() => onSaveEvidence(evidenceAnswers)}><Check size={16} /> 仅保存证据</button>
              <button className="primary-action" disabled={evidenceAnswers.length === 0 || isAnalyzing} onClick={() => onReanalyze(evidenceAnswers)}>{isAnalyzing ? <><LoaderCircle className="spin" size={17} /> 正在重新核对</> : <><Sparkles size={17} /> 保存并重新分析</>}</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ResumeReport({ result, accepted, setAccepted, copied, setCopied }: { result: AnalysisResult; accepted: number[]; setAccepted: React.Dispatch<React.SetStateAction<number[]>>; copied: string; setCopied: (value: string) => void }) {
  return (
    <div className="report-content narrow-content">
      <div className="section-intro"><div><span className="section-kicker"><FileCheck2 size={15} /> GROUNDED REWRITES</span><h3>只改表达，不改事实。</h3><p>每一条改写都能追溯到你的原始经历。接受前请再次确认语义准确。</p></div><span className="safety-stamp"><ShieldCheck size={18} /> 事实约束已开启</span></div>
      {result.resumeSuggestions.map((suggestion, index) => {
        const isAccepted = accepted.includes(index);
        return (
          <article className={cx("rewrite-card", isAccepted && "accepted")} key={`${suggestion.original}-${index}`}>
            <div className="rewrite-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="rewrite-main">
              <span className="rewrite-label">原始表述</span><p className="original-copy">{suggestion.original}</p>
              <div className="rewrite-arrow"><ArrowRight size={16} /><span>针对岗位优化</span></div>
              <span className="rewrite-label strong">建议版本</span><p className="rewritten-copy">{suggestion.rewrite}</p>
              <div className="reason-box"><Lightbulb size={16} /><div><strong>为什么这样改</strong><p>{suggestion.reason}</p><small>事实来源：{suggestion.source}</small></div></div>
            </div>
            <div className="rewrite-actions"><button className={cx("accept-button", isAccepted && "done")} onClick={() => setAccepted((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}>{isAccepted ? <><Check size={16} /> 已接受</> : "接受建议"}</button><button className="icon-copy" onClick={() => copyText(suggestion.rewrite, setCopied, `resume-${index}`)}>{copied === `resume-${index}` ? <Check size={16} /> : <Copy size={16} />}</button></div>
          </article>
        );
      })}
    </div>
  );
}

function MessageReport({ result, jdText, copied, setCopied }: { result: AnalysisResult; jdText: string; copied: string; setCopied: (value: string) => void }) {
  const detectedEmails = extractEmailAddresses(jdText);
  const platformMessage = result.messages.platformMessage || [result.messages.recruiterGreeting, result.messages.applicationReason].filter(Boolean).join(" ");
  return (
    <div className="report-content narrow-content">
      <div className="section-intro"><div><span className="section-kicker"><Mail size={15} /> APPLICATION KIT</span><h3>按投递渠道，生成真正能直接发送的文案。</h3><p>招聘平台强调快速建立相关性，邮件投递则保留完整信息与正式结构。</p></div></div>

      <section className="message-channel">
        <header><span>01</span><div><h4>招聘平台沟通文案</h4><p>BOSS直聘式短消息：身份、岗位证据与沟通意愿合并表达。</p></div><b>适合即时沟通</b></header>
        <article className="copy-card platform-message-card">
          <div><span>可直接发送</span><button onClick={() => copyText(platformMessage, setCopied, "platform-message")}>{copied === "platform-message" ? <><Check size={15} /> 已复制</> : <><Copy size={15} /> 复制文案</>}</button></div>
          <p>{platformMessage}</p>
          <footer><span>身份与目标岗位</span><span>最相关经历证据</span><span>轻量沟通邀请</span></footer>
        </article>
      </section>

      <section className="message-channel email-channel">
        <header><span>02</span><div><h4>邮箱投递文案</h4><p>自动检查 JD 中的收件邮箱，并生成主题与完整正文。</p></div><b>适合正式投递</b></header>
        <div className={cx("detected-email-card", detectedEmails.length === 0 && "empty")}>
          <div><Mail size={17} /><span><small>JD 中识别到的投递邮箱</small><strong>{detectedEmails.length > 0 ? `${detectedEmails.length} 个地址` : "未识别到邮箱地址"}</strong></span></div>
          {detectedEmails.length > 0 ? <div className="email-address-list">{detectedEmails.map((email, index) => <span key={email}><code>{email}</code><button onClick={() => copyText(email, setCopied, `email-address-${index}`)}>{copied === `email-address-${index}` ? <Check size={14} /> : <Copy size={14} />} {copied === `email-address-${index}` ? "已复制" : "复制"}</button></span>)}</div> : <p>你仍可复制下方邮件文案，再手动填写收件人。</p>}
        </div>
        <article className="copy-card email-card"><div><span>正式投递邮件</span><button onClick={() => copyText(`${result.messages.emailSubject}\n\n${result.messages.emailBody}`, setCopied, "email")}>{copied === "email" ? <><Check size={15} /> 已复制</> : <><Copy size={15} /> 复制主题和正文</>}</button></div><strong>主题：{result.messages.emailSubject}</strong><p>{result.messages.emailBody}</p></article>
      </section>
    </div>
  );
}

function InterviewReport({ result }: { result: AnalysisResult }) {
  return (
    <div className="report-content narrow-content">
      <div className="interview-heading">
        <div><span className="section-kicker"><BookOpenCheck size={15} /> INTERVIEW PLAYBOOK</span><h3>不背答案，建立可追问的作答逻辑。</h3><p>每道题都连接你的简历证据、岗位要求和公司业务，帮助你应对连续追问。</p></div>
        <span className="interview-count"><strong>{result.interview.questions.length}</strong> 道深度问题 · <strong>{result.interview.tasks.length}</strong> 项准备</span>
      </div>
      <div className="interview-insight"><span><Gauge size={22} /></span><div><small>本岗位的面试验证主线</small><p>{result.interview.roleInsight}</p></div></div>
      <div className="interview-layout">
        <section className="panel question-list">
          <div className="panel-title"><div><span>01</span><h3>针对性面试问题</h3></div><small>{result.interview.questions.length} 道</small></div>
          {result.interview.questions.map((item, index) => (
            <details key={`${item.question}-${index}`} open={index === 0}>
              <summary><span>{String(index + 1).padStart(2, "0")}</span><div><small>{item.category}</small><strong>{item.question}</strong></div><Plus size={18} /></summary>
              <div className="interview-guidance">
                <div><b>考察意图</b><p>{item.whyAsked || "验证岗位相关能力与经历真实性。"}</p></div>
                <div className="framework"><b>作答框架</b><p>{item.answerFramework || item.preparation}</p></div>
                <div><b>简历证据</b><p>{item.evidenceAnchor || "从简历中选择可核验的真实经历。"}</p></div>
                <div><b>业务连接</b><p>{item.businessConnection || `结合${result.meta.company}与${result.meta.role}的业务场景作答。`}</p></div>
                <div className="prep-tip"><Lightbulb size={16} /><span><b>准备动作</b>{item.preparation}</span></div>
              </div>
            </details>
          ))}
        </section>
        <section className="panel task-list"><div className="panel-title"><div><span>02</span><h3>准备清单</h3></div><small>{result.interview.tasks.length} 项</small></div>{result.interview.tasks.map((item, index) => <div className="task-item" key={`${item.task}-${index}`}><input type="checkbox" aria-label={`完成任务：${item.task}`} /><span><small className={cx(item.priority === "必须" && "must")}>{item.priority}</small><strong>{item.task}</strong><p>{item.reason}</p></span></div>)}</section>
      </div>
    </div>
  );
}

function InterviewFollowUpReportView({ record }: { record: InterviewFollowUpRecord }) {
  const { report } = record;
  return (
    <div className="followup-report">
      <section className="followup-report-hero">
        <span>{record.track === "business" ? "业务侧" : "HR 侧"}</span>
        <h2>{report.title}</h2>
        <p>{report.roundGoal}</p>
      </section>
      <section className="followup-strategy-grid">
        <article><small>核心叙事</small><p>{report.strategy.coreNarrative}</p></article>
        <article><small>开场策略</small><p>{report.strategy.opening}</p></article>
        <article className="risk"><small>风险提醒</small><p>{report.strategy.riskReminder}</p></article>
        <article className="questions-to-ask"><small>建议反问</small><ol>{report.strategy.questionsToAsk.map((question) => <li key={question}>{question}</li>)}</ol></article>
      </section>
      <section className="followup-question-section">
        <header><div><span>01</span><h3>10 道深度追问</h3></div><small>逐题展开查看准备思路</small></header>
        {report.questions.map((item, index) => (
          <details key={`${item.question}-${index}`} open={index === 0}>
            <summary><b>{String(index + 1).padStart(2, "0")}</b><span><small>{item.category}</small><strong>{item.question}</strong></span><Plus size={17} /></summary>
            <div className="followup-question-guide">
              <p><b>考察意图</b>{item.whyAsked}</p>
              <p className="framework"><b>作答框架</b>{item.answerFramework}</p>
              <p><b>简历证据</b>{item.evidenceAnchor}</p>
              <p><b>业务连接</b>{item.businessConnection}</p>
              <p className="prep"><b>准备动作</b>{item.preparation}</p>
            </div>
          </details>
        ))}
      </section>
      <section className="followup-task-section">
        <header><div><span>02</span><h3>本轮准备清单</h3></div><small>5 项</small></header>
        <div>{report.tasks.map((task, index) => <label key={`${task.task}-${index}`}><input type="checkbox" aria-label={`完成任务：${task.task}`} /><span><small className={task.priority === "必须" ? "must" : undefined}>{task.priority}</small><strong>{task.task}</strong><p>{task.reason}</p></span></label>)}</div>
      </section>
    </div>
  );
}

function JobsView({ saved, openSaved, removeSaved, startNewAnalysis, saveInterviewFollowUp }: { saved: SavedAnalysis[]; openSaved: (item: SavedAnalysis) => void; removeSaved: (id: string) => void; startNewAnalysis: () => void; saveInterviewFollowUp: (id: string, followUp: InterviewFollowUpRecord) => void }) {
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [followUpJobId, setFollowUpJobId] = useState("");
  const [followUpTrack, setFollowUpTrack] = useState<InterviewTrack>("business");
  const [previousRoundContext, setPreviousRoundContext] = useState("");
  const [nextRoundContext, setNextRoundContext] = useState("");
  const [followUpApiKey, setFollowUpApiKey] = useState("");
  const [followUpError, setFollowUpError] = useState("");
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [followUpElapsed, setFollowUpElapsed] = useState(0);
  const [viewingFollowUp, setViewingFollowUp] = useState<InterviewFollowUpRecord | null>(null);
  const totalPages = Math.max(1, Math.ceil(saved.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const pageItems = saved.slice(pageStart, pageStart + pageSize);
  const followUpJob = saved.find((item) => item.id === followUpJobId) ?? null;
  const followUpProgress = useMemo(() => estimateModelProgress(followUpElapsed), [followUpElapsed]);
  const followUpStage = followUpElapsed < 3 ? 0 : followUpElapsed < 10 ? 1 : followUpElapsed < 25 ? 2 : 3;
  const pageNumbers = useMemo<Array<number | "ellipsis-left" | "ellipsis-right">>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const items: Array<number | "ellipsis-left" | "ellipsis-right"> = [1];
    if (activePage > 4) items.push("ellipsis-left");
    const rangeStart = Math.max(2, activePage - 1);
    const rangeEnd = Math.min(totalPages - 1, activePage + 1);
    for (let page = rangeStart; page <= rangeEnd; page += 1) items.push(page);
    if (activePage < totalPages - 3) items.push("ellipsis-right");
    items.push(totalPages);
    return items;
  }, [activePage, totalPages]);

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openFollowUp(item: SavedAnalysis) {
    const nextTrack: InterviewTrack = !item.interviewFollowUps?.business ? "business" : !item.interviewFollowUps?.hr ? "hr" : "business";
    setFollowUpJobId(item.id);
    setFollowUpTrack(nextTrack);
    setViewingFollowUp(item.interviewFollowUps?.[nextTrack] ?? null);
    setPreviousRoundContext("");
    setNextRoundContext("");
    setFollowUpApiKey("");
    setFollowUpError("");
  }

  function chooseFollowUpTrack(track: InterviewTrack) {
    if (isGeneratingFollowUp) return;
    setFollowUpTrack(track);
    setViewingFollowUp(followUpJob?.interviewFollowUps?.[track] ?? null);
    setFollowUpError("");
  }

  function closeFollowUp() {
    if (isGeneratingFollowUp) return;
    setFollowUpJobId("");
    setViewingFollowUp(null);
    setFollowUpApiKey("");
    setFollowUpError("");
  }

  async function generateFollowUp() {
    if (!followUpJob) return;
    if (followUpJob.interviewFollowUps?.[followUpTrack]) {
      setViewingFollowUp(followUpJob.interviewFollowUps[followUpTrack] ?? null);
      return;
    }
    const requestedTrack = followUpTrack;
    setFollowUpError("");
    setFollowUpElapsed(0);
    setIsGeneratingFollowUp(true);
    const elapsedTimer = window.setInterval(() => setFollowUpElapsed((seconds) => seconds + 1), 1_000);
    try {
      let report: InterviewFollowUpReport;
      if (followUpJob.provider === "demo") {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        report = createDemoFollowUp(followUpJob, requestedTrack);
      } else {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "interview_followup",
            provider: followUpJob.provider,
            model: followUpJob.model,
            apiKey: followUpApiKey,
            resumeText: followUpJob.resumeText,
            jdText: followUpJob.jdText,
            companyContext: followUpJob.companyContext,
            originalResult: followUpJob.result,
            interviewTrack: requestedTrack,
            previousRoundContext,
            nextRoundContext,
          }),
        });
        const data = (await response.json()) as { report?: InterviewFollowUpReport; error?: string };
        if (!response.ok || !data.report) throw new Error(data.error || "专项面试报告生成失败，请重试");
        report = data.report;
      }
      const record: InterviewFollowUpRecord = {
        track: requestedTrack,
        createdAt: new Date().toISOString(),
        previousRoundContext: previousRoundContext.trim() || undefined,
        nextRoundContext: nextRoundContext.trim() || undefined,
        report,
      };
      saveInterviewFollowUp(followUpJob.id, record);
      setViewingFollowUp(record);
      setFollowUpApiKey("");
    } catch (generationError) {
      setFollowUpError(generationError instanceof Error ? generationError.message : "专项面试报告生成失败，请重试");
    } finally {
      window.clearInterval(elapsedTimer);
      setIsGeneratingFollowUp(false);
      setFollowUpElapsed(0);
      setFollowUpApiKey("");
    }
  }

  return (
    <div className="standalone-page">
      <div className="standalone-heading">
        <div><span className="section-kicker"><BriefcaseBusiness size={15} /> JOB ARCHIVE</span><h1>岗位档案</h1><p>分析结果只保存在这台设备的浏览器中，最多保留最近 100 份。</p></div>
        <button className="primary-action" onClick={startNewAnalysis}><Plus size={17} /> 新建分析</button>
      </div>
      {saved.length === 0 ? (
        <div className="empty-state"><span><ClipboardCheck size={28} /></span><h2>还没有岗位档案</h2><p>完成一次示例或真实分析后，结果会自动出现在这里。</p><button onClick={startNewAnalysis}>开始第一次分析 <ArrowRight size={16} /></button></div>
      ) : (
        <>
          <div className="archive-summary"><span>共 <strong>{saved.length}</strong> 份岗位档案</span><span>当前显示第 {pageStart + 1}–{Math.min(pageStart + pageSize, saved.length)} 份</span></div>
          <div className="jobs-list">{pageItems.map((item) => {
            const completedFollowUps = Object.keys(item.interviewFollowUps ?? {}).length;
            return (
              <article key={item.id}>
                <div className="job-score">{item.result.score}</div>
                <div className="job-main"><span>{item.result.meta.company}</span><h3>{item.result.meta.role}</h3><p>{item.result.verdict}</p></div>
                <div className="job-meta">
                  <span className={cx("recommendation-tag", "small", recommendationTone(item.result.recommendation))}>{item.result.recommendation}</span>
                  <small><Clock3 size={13} />{new Date(item.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
                  <small>{item.provider === "demo" ? "示例模式" : providers[item.provider].name} · {interviewFollowUpStatus(item)}</small>
                </div>
                <div className="job-actions">
                  <button className="follow-job" onClick={() => openFollowUp(item)}><Sparkles size={15} />{completedFollowUps === 0 ? "跟进复试" : completedFollowUps === 2 ? "查看复试准备" : "继续跟进复试"}</button>
                  <button className="open-job" onClick={() => openSaved(item)}>查看岗位分析 <ArrowRight size={15} /></button>
                </div>
                <button className="delete-job" aria-label={`删除${item.result.meta.company}${item.result.meta.role}岗位档案`} onClick={() => removeSaved(item.id)}><Trash2 size={16} /></button>
              </article>
            );
          })}</div>
          {totalPages > 1 && (
            <nav className="archive-pagination" aria-label="岗位档案分页">
              <span>第 {activePage} / {totalPages} 页</span>
              <div>
                <button aria-label="上一页" disabled={activePage === 1} onClick={() => goToPage(activePage - 1)}><ChevronLeft size={17} /></button>
                {pageNumbers.map((page) => typeof page === "number" ? <button key={page} className={page === activePage ? "active" : undefined} aria-current={page === activePage ? "page" : undefined} onClick={() => goToPage(page)}>{page}</button> : <i key={page}>…</i>)}
                <button aria-label="下一页" disabled={activePage === totalPages} onClick={() => goToPage(activePage + 1)}><ChevronRight size={17} /></button>
              </div>
            </nav>
          )}
        </>
      )}
      {followUpJob && (
        <div className="followup-modal-backdrop" role="dialog" aria-modal="true" aria-label="跟进复试">
          <button type="button" className="followup-modal-dismiss" aria-label="关闭复试跟进" onClick={closeFollowUp} />
          <section className="followup-modal">
            <header className="followup-modal-header">
              <div><span>INTERVIEW FOLLOW-UP</span><h2>跟进复试 · {followUpJob.result.meta.company}</h2><p>选择下一轮面试类型，为{followUpJob.result.meta.role}生成更有针对性的专项准备。</p></div>
              <button type="button" disabled={isGeneratingFollowUp} onClick={closeFollowUp} aria-label="关闭"><X size={20} /></button>
            </header>
            <div className="followup-track-picker" aria-label="选择下一轮面试类型">
              {(["business", "hr"] as InterviewTrack[]).map((track) => {
                const existing = followUpJob.interviewFollowUps?.[track];
                return <button key={track} type="button" disabled={isGeneratingFollowUp} className={cx(followUpTrack === track && "active", existing && "completed")} onClick={() => chooseFollowUpTrack(track)}><span>{track === "business" ? <BriefcaseBusiness size={18} /> : <UserRound size={18} />}</span><div><strong>{track === "business" ? "业务复试" : "HR 面试"}</strong><small>{existing ? "报告已生成，可随时查看" : "可生成 1 份专项准备"}</small></div>{existing && <Check size={17} />}</button>;
              })}
            </div>
            {viewingFollowUp ? (
              <div className="followup-modal-body report-mode"><InterviewFollowUpReportView record={viewingFollowUp} /></div>
            ) : (
              <div className="followup-modal-body">
                <div className="followup-form-intro"><Sparkles size={20} /><div><strong>{followUpTrack === "business" ? "生成业务复试深度准备" : "生成 HR 面试专项准备"}</strong><p>只生成本轮面试内容，不重复匹配报告、简历优化或投递文案。</p></div></div>
                {isGeneratingFollowUp ? (
                  <section className="analysis-progress followup-generation-progress" aria-live="polite">
                    <div className="progress-copy"><span className="analysis-mark"><Sparkles size={20} /></span><div><strong>{followUpAnalysisStages[followUpStage].title}</strong><p>{followUpAnalysisStages[followUpStage].detail}</p></div><span className="elapsed-time"><b>{followUpProgress}%</b><small><Clock3 size={12} /> {formatElapsedTime(followUpElapsed)}</small></span></div>
                    <div className="progress-track estimated"><span style={{ width: `${followUpProgress}%` }} /></div>
                    <div className="progress-steps">
                      {["读取原报告", "对齐复试重点", "生成深度追问", "整理准备方案"].map((step, index) => <span key={step} className={cx(index < followUpStage && "done", index === followUpStage && "current")}><i>{index < followUpStage ? <Check size={12} /> : index + 1}</i>{step}</span>)}
                    </div>
                    <div className="progress-wait-note"><Clock3 size={15} /><span>百分比根据处理阶段和已用时估算。生成10道针对性问题与完整作答框架通常需要更长时间，请等待报告自动打开。</span></div>
                  </section>
                ) : (
                  <>
                    <label className="followup-field"><span>上一轮情况 <b>可选</b></span><textarea value={previousRoundContext} onChange={(event) => setPreviousRoundContext(event.target.value)} placeholder="例如：整体交流感受、对方重点关注的能力、你认为没有讲清楚的部分。无需填写上一轮具体问题。" /><small>上一轮问题将来会进入独立的“面试复盘”功能，本页不强制收集。</small></label>
                    <label className="followup-field"><span>下一轮已知信息 <b>可选</b></span><textarea value={nextRoundContext} onChange={(event) => setNextRoundContext(event.target.value)} placeholder={followUpTrack === "business" ? "例如：面试官可能是业务负责人、将重点讨论某项业务或作品。" : "例如：已知是HRBP沟通、可能确认到岗时间或薪资范围。"} /></label>
                    {followUpJob.provider !== "demo" && <label className="followup-field"><span>临时 API Key <b>可留空使用部署密钥</b></span><input type="password" autoComplete="off" value={followUpApiKey} onChange={(event) => setFollowUpApiKey(event.target.value)} placeholder={providers[followUpJob.provider].keyHint} /><small>沿用原分析的 {providers[followUpJob.provider].name} · {followUpJob.model}，密钥不会写入本地档案。</small></label>}
                    {followUpError && <div className="followup-error"><CircleAlert size={16} />{followUpError}</div>}
                    <footer className="followup-form-actions"><p><LockKeyhole size={15} />每种面试类型可生成一次；报告完成后会自动保存到当前岗位档案。</p><button type="button" className="primary-action" onClick={generateFollowUp}>生成{followUpTrack === "business" ? "业务复试" : "HR面试"}准备 <ArrowRight size={17} /></button></footer>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ProfileView({ profile, setProfile, onSave, onUse }: { profile: CandidateProfile; setProfile: React.Dispatch<React.SetStateAction<CandidateProfile>>; onSave: (profile: CandidateProfile) => void; onUse: (profile: CandidateProfile) => void }) {
  const completedFields = [profile.baseResume, profile.targetRoles, profile.targetIndustries, profile.preferredLocations, profile.availability, profile.coreSkills, profile.evidenceNotes].filter((value) => value.trim()).length;
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const profileResumeInputRef = useRef<HTMLInputElement>(null);
  const update = (field: keyof CandidateProfile, value: string) => setProfile((current) => ({ ...current, [field]: value }));

  async function uploadProfileResume(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setResumeError("简历文件不能超过 10 MB");
      return;
    }
    setResumeError("");
    setIsParsingResume(true);
    try {
      const text = (await extractText(file)).trim();
      if (text.length < 40) throw new Error("没有读取到足够文字，请上传文字版简历");
      const nextProfile = {
        ...profile,
        baseResume: text,
        baseResumeFileName: file.name,
        baseResumeUpdatedAt: new Date().toISOString(),
      };
      onSave(nextProfile);
    } catch (fileError) {
      setResumeError(fileError instanceof Error ? fileError.message : "简历读取失败，请重试");
    } finally {
      setIsParsingResume(false);
      if (profileResumeInputRef.current) profileResumeInputRef.current.value = "";
    }
  }

  function saveProfileDraft() {
    onSave({
      ...profile,
      baseResumeFileName: profile.baseResume ? profile.baseResumeFileName || "手动粘贴版本" : "",
      baseResumeUpdatedAt: profile.baseResume ? new Date().toISOString() : "",
    });
  }

  function deleteProfileResume() {
    if (!window.confirm("确定删除已保存的基础简历吗？其他求职画像信息不会受影响。")) return;
    onSave({ ...profile, baseResume: "", baseResumeFileName: "", baseResumeUpdatedAt: "" });
  }

  return (
    <div className="standalone-page">
      <div className="standalone-heading"><div><span className="section-kicker"><UserRound size={15} /> MY CAREER PROFILE</span><h1>我的求职画像</h1><p>集中维护求职方向、真实经历和可验证能力，让每次分析都从你的长期背景出发。</p></div></div>
      <section className="profile-editor">
        <aside className="profile-sidebar">
          <span><FileText size={22} /></span><h3>求职资料完整度</h3><p>已完善 {completedFields} / 7 项 · {profile.baseResume.length.toLocaleString()} 个简历字符</p>
          <div className="profile-completion"><i style={{ width: `${Math.round(completedFields / 7 * 100)}%` }} /></div>
          <ul><li><Check size={14} /> 跨岗位复用求职偏好</li><li><Check size={14} /> 用真实事实约束 AI</li><li><Check size={14} /> 为投递与面试提供素材</li></ul>
          <div><ShieldCheck size={15} /> 仅保存在当前设备</div>
        </aside>
        <div className="profile-main">
          <div className="profile-explainer"><Sparkles size={18} /><p><strong>这不是普通的个人中心</strong><span>这里填写的行业、地点、到岗约束、能力和项目故事会直接进入岗位匹配、投递文案与面试准备；基础简历也可一键带入新分析。</span></p></div>
          <div className="profile-section-label"><span>01</span><div><strong>求职目标与边界</strong><small>帮助 AI 判断“适不适合”和“是否值得投”</small></div></div>
          <div className="profile-field-grid">
            <label><span>目标岗位 / 求职方向</span><input value={profile.targetRoles} onChange={(event) => update("targetRoles", event.target.value)} placeholder="例如：AI 产品经理、增长产品实习生" /></label>
            <label><span>目标行业 / 业务方向</span><input value={profile.targetIndustries} onChange={(event) => update("targetIndustries", event.target.value)} placeholder="例如：AI 应用、内容社区、企业服务" /></label>
            <label><span>期望地点</span><input value={profile.preferredLocations} onChange={(event) => update("preferredLocations", event.target.value)} placeholder="例如：上海、杭州；可接受远程" /></label>
            <label><span>时间与硬性约束</span><input value={profile.availability} onChange={(event) => update("availability", event.target.value)} placeholder="例如：每周 4 天，连续 6 个月，可线下" /></label>
          </div>
          <div className="profile-section-label"><span>02</span><div><strong>长期能力与事实材料</strong><small>帮助 AI 选择证据，而不是编造看似匹配的经历</small></div></div>
          <label htmlFor="profile-resume"><span>基础简历</span><small>上传后自动保存，并在新建分析时默认使用</small></label>
          <input ref={profileResumeInputRef} type="file" accept=".pdf,.docx,.txt,text/plain,application/pdf" hidden onChange={(event) => uploadProfileResume(event.target.files?.[0])} />
          <div className="profile-resume-manager">
            <button
              type="button"
              className={cx("profile-resume-upload", profile.baseResume && "has-resume")}
              onClick={() => profileResumeInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                uploadProfileResume(event.dataTransfer.files?.[0]);
              }}
            >
              {isParsingResume ? <><LoaderCircle className="spin" size={24} /><span><strong>正在读取并保存简历…</strong><small>请保持当前页面开启</small></span></> : profile.baseResume ? <><span className="profile-resume-status"><FileCheck2 size={22} /></span><span><strong>{profile.baseResumeFileName || "已保存的基础简历"}</strong><small>{profile.baseResume.length.toLocaleString()} 个字符{profile.baseResumeUpdatedAt ? ` · 更新于 ${new Date(profile.baseResumeUpdatedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}</small></span><b>点击或拖入文件替换</b></> : <><span className="profile-resume-status"><UploadCloud size={22} /></span><span><strong>拖入简历，或点击上传</strong><small>支持 PDF、DOCX、TXT · 最大 10 MB</small></span><b>上传后自动保存</b></>}
            </button>
            {profile.baseResume && <button type="button" className="profile-resume-delete" onClick={deleteProfileResume}><Trash2 size={15} /> 删除简历</button>}
          </div>
          {resumeError && <div className="profile-resume-error"><CircleAlert size={15} /> {resumeError}</div>}
          <div className="profile-resume-paste-heading"><span>也可以粘贴或直接编辑简历文字</span><small>编辑后点击页面底部“保存求职画像”</small></div>
          <textarea className="profile-resume" id="profile-resume" value={profile.baseResume} onChange={(event) => setProfile((current) => ({ ...current, baseResume: event.target.value, baseResumeFileName: event.target.value ? "手动编辑版本" : "", baseResumeUpdatedAt: "" }))} placeholder="粘贴教育、实习、项目、技能等完整经历…" />
          <label htmlFor="profile-skills"><span>核心能力与工具</span><small>每项能力尽量附上使用场景或结果</small></label>
          <textarea className="profile-skills" id="profile-skills" value={profile.coreSkills} onChange={(event) => update("coreSkills", event.target.value)} placeholder="例如：用户访谈——完成12名目标用户访谈并形成需求清单；Figma——独立完成两轮高保真原型。" />
          <label htmlFor="profile-evidence"><span>项目细节与面试故事</span><small>记录简历放不下，但能经得起连续追问的真实细节</small></label>
          <textarea className="profile-evidence" id="profile-evidence" value={profile.evidenceNotes} onChange={(event) => update("evidenceNotes", event.target.value)} placeholder="例如：某次项目中的具体分工、关键取舍、失败复盘、协作冲突、数据口径和最终结果。建议用 STAR / CAR 结构记录。" />
          <div className="profile-actions"><button className="secondary-action" onClick={() => setProfile({ ...emptyProfile, baseResume: sampleResume, baseResumeFileName: "示例基础简历.txt", targetRoles: "产品经理 / AI 产品实习生", targetIndustries: "AI 应用 / 内容社区", preferredLocations: "上海 / 杭州" })}>载入示例</button><button className="secondary-action" onClick={saveProfileDraft}><Check size={17} /> 保存求职画像</button><button className="primary-action" disabled={profile.baseResume.trim().length < 80} onClick={() => onUse({ ...profile, baseResumeUpdatedAt: new Date().toISOString() })}>带入新的岗位分析 <ArrowRight size={17} /></button></div>
        </div>
      </section>
    </div>
  );
}
