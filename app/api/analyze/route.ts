import { clampScore, type AnalysisResult, type EvidenceAnswer, type EvidenceReviewStatus, type InterviewFollowUpReport, type InterviewTrack, type ProviderId } from "@/lib/analysis";
import { parseModelJson } from "@/lib/model-json.js";

export const runtime = "edge";

const providerConfig: Record<
  ProviderId,
  { baseUrl: string; envKey: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
  },
  doubao: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    envKey: "ARK_API_KEY",
  },
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    envKey: "DASHSCOPE_API_KEY",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
  },
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    envKey: "ZHIPU_API_KEY",
  },
};

const systemPrompt = `你是一名谨慎、可解释的初级岗位求职分析师。请分析中文简历与岗位描述，输出严格JSON，禁止Markdown围栏或额外文字。

最高优先级规则：
1. 不得编造简历中不存在的数字、工具、职责、公司或成果。
2. 所有关键判断都要引用简历中的具体证据；没有证据就写“未发现”。
3. 区分表达缺口、信息缺口、准备缺口、硬性门槛。
4. 硬性条件单独判断，不要用普通能力得分掩盖。
5. 建议要具体、可执行；未知信息标记为未知。
6. 简历改写只能重组已有事实，不能把“参与”改成“主导”。
7. 匹配分数0-100，同时给出高/中/低置信度。
8. 输出必须是可直接解析的标准JSON：数组元素之间必须有逗号，字符串内部的双引号和换行必须正确转义，禁止尾随逗号、注释或省略号。

请返回以下完整JSON结构：
{
  "meta":{"company":"","role":"","summary":""},
  "score":0,
  "confidence":"高|中|低",
  "recommendation":"建议投递|优化后投递|低优先级投递",
  "verdict":"",
  "strengths":["","",""],
  "biggestRisk":"",
  "dimensions":[{"name":"核心能力","score":0,"weight":30,"note":""},{"name":"相关经历","score":0,"weight":25,"note":""},{"name":"技能工具","score":0,"weight":20,"note":""},{"name":"成果证据","score":0,"weight":15,"note":""},{"name":"加分项","score":0,"weight":10,"note":""}],
  "evidenceMatrix":[{"requirement":"","importance":"核心|重要|加分","status":"已充分证明|表达不足|信息不足|当前缺失","evidence":"","strength":"强|中|弱|无","gapType":"表达缺口|信息缺口|准备缺口|硬性门槛|无","action":""}],
  "gaps":[{"type":"表达缺口|信息缺口|准备缺口|硬性门槛","title":"","description":"","action":""}],
  "followUpQuestions":[""],
  "evidenceReview":[{"question":"","answer":"","status":"证据充分|需要补充|无法采用","feedback":"","usableEvidence":""}],
  "resumeSuggestions":[{"original":"必须逐字引用简历中的原句","rewrite":"","reason":"","source":""}],
  "messages":{"platformMessage":"","emailSubject":"","emailBody":""},
  "interview":{"roleInsight":"","questions":[{"category":"","question":"","whyAsked":"","answerFramework":"","evidenceAnchor":"","businessConnection":"","preparation":""}],"tasks":[{"priority":"必须|建议","task":"","reason":""}]}
}

面试准备专项规则：
1. interview.roleInsight 要结合候选人经历、JD核心职责和公司/业务背景，指出面试官最可能验证的能力链路。
2. interview.questions 必须恰好10道，不多不少；覆盖项目深挖、岗位核心能力、业务理解、数据分析、协作推进、方案设计、成果复盘、岗位动机和能力缺口。
3. 每道题必须针对本候选人和本岗位，禁止只替换公司名的通用问题。
4. whyAsked 说明考察意图；answerFramework 给出3-6步严谨作答结构；evidenceAnchor 指向简历中的真实证据或明确写“简历未发现可用证据”；businessConnection 连接JD和公司业务，若材料未提供公司信息必须标注“基于岗位描述推断”；preparation 给出面试前可执行的准备动作。
5. interview.tasks 必须恰好5项，按优先级覆盖个人案例、业务研究、数据/工具、硬性条件与模拟演练；每项都说明为什么对本岗位重要。
6. 公司业务信息只能来自用户提供的公司背景、JD或普遍稳定事实；无法确认时明确写“基于材料推断”，禁止编造最新战略、指标或产品数据。

投递文案专项规则：
1. messages.platformMessage 是一条完整的招聘平台沟通文案，不再拆成问候语和申请理由。
2. platformMessage 参考 BOSS直聘即时沟通场景，控制在100-180个中文字符：先说明身份和目标岗位，紧接着给出“为什么值得回复”的核心价值。
3. 核心价值必须来自简历真实事实：优先选择1项最贴合JD的经历，写清候选人的具体动作、可核验结果与对岗位的直接价值；可再补充1项互补证据，但不要堆砌技能。
4. 结尾使用一个低压力、便于对方回复的明确邀请，例如询问是否方便进一步沟通，或表示可立即补充作品材料；不要用“期待您的回复”等模板尾句。
5. platformMessage 要像真人即时消息，避免“贵司”“兹申请”“附件请查收”等邮件腔；禁止空泛自夸、复述整份简历、虚构数字或承诺材料中没有的到岗条件。
6. emailSubject 要包含目标岗位和候选人姓名或身份，并可加入1个最有区分度的真实标签，不得标题党。
7. emailBody 使用正式但简洁的邮件结构，正文约180-320个中文字符：开头直接说明申请岗位和候选人定位；中间用2段呈现与JD最相关的事实证据、个人动作、结果和可迁移价值；结尾说明已附简历/作品集并邀请进一步沟通。
8. 邮件正文不得主动列出电话、手机号或微信，不生成联系方式签名；联系信息以附件简历为准。
9. 不得生成或猜测收件邮箱。收件邮箱由产品从JD原文中独立识别。

输出数量要求：evidenceMatrix 5-8项；gaps 2-4项；followUpQuestions最多5个；resumeSuggestions 2-4项；interview.questions恰好10项；interview.tasks恰好5项。`;

const evidenceReviewPrompt = `\n\n证据补全专项规则：
1. 如果用户提供了“本轮证据补全回答”，必须逐条审核，并在 evidenceReview 中按原问题顺序返回同样数量的结果；没有回答则返回空数组。
2. 只有包含可核验场景、候选人具体动作、职责边界或结果信息，并且与问题和JD相关的回答，才能标记为“证据充分”。这类回答可进入证据矩阵并影响评分。
3. 只有态度、结论、自我评价或模糊描述的回答标记为“需要补充”，指出还缺少什么；不得因为用户填写了文字就提高分数。
4. 与问题无关、明显自相矛盾、要求模型替用户编造，或无法作为候选人经历事实使用的回答标记为“无法采用”。
5. usableEvidence 只提炼用户确实提供的事实；证据不足时留空。feedback 要给出下一次可直接回答的具体追问。
6. 新分析必须同时体现补全前后的真实变化：充分证据可改善对应要求状态；不足证据继续保留为缺口。`;

const interviewFollowUpPrompt = `你是一名谨慎、严谨的资深面试教练。你的唯一任务是基于候选人简历、岗位JD、原始匹配报告和用户补充信息，生成下一轮面试的深度准备报告。

最高优先级规则：
1. 只输出严格JSON，禁止Markdown围栏、注释或额外文字。
2. 不生成匹配分、简历优化或投递文案，只处理下一轮面试准备。
3. 不得编造候选人经历、公司业务、面试安排、面试官身份或上一轮问题；材料没有提供的信息必须明确写“未知”或“基于材料推断”。
4. 上一轮信息和下一轮已知信息都是可选背景；没有填写时不得擅自补全，也不得降低报告完整度。
5. 每道题都必须结合简历中的真实证据或明确指出证据缺口，并连接JD职责与公司业务背景。
6. 如果面试类型是“业务复试”，重点验证专业判断、项目深挖、业务理解、方法论、协作与复盘；如果是“HR面试”，重点验证动机、稳定性、价值观、沟通成熟度、到岗约束、职业规划与风险一致性。
7. questions必须恰好10道，tasks必须恰好5项，questionsToAsk必须恰好3项。

请返回以下结构：
{
  "title":"",
  "roundGoal":"",
  "strategy":{"coreNarrative":"","opening":"","questionsToAsk":["","",""],"riskReminder":""},
  "questions":[{"category":"","question":"","whyAsked":"","answerFramework":"","evidenceAnchor":"","businessConnection":"","preparation":""}],
  "tasks":[{"priority":"必须|建议","task":"","reason":""}]
}`;

function buildFollowUpFallback(track: InterviewTrack, company: string, role: string, strongestEvidence: string, biggestRisk: string): InterviewFollowUpReport {
  const isBusiness = track === "business";
  const commonQuestions: Array<[string, string]> = isBusiness
    ? [
        ["项目深挖", "请选择与岗位最相关的项目，说明你做出的最关键判断及依据。"],
        ["职责边界", "这段项目中哪些结果由你直接推动，哪些来自团队共同完成？"],
        ["业务理解", `你如何理解${company}该岗位当前要解决的核心业务问题？`],
        ["方案取舍", "如果资源只能支持一个方向，你会如何排序并验证？"],
        ["数据分析", "你会用哪些结果指标、过程指标和护栏指标判断方案有效？"],
        ["协作推进", "关键协作方不同意你的判断时，你如何形成可执行的共识？"],
        ["复杂场景", "面对信息不足且时间有限的问题，你会如何推进第一步？"],
        ["失败复盘", "讲一个结果不及预期的经历，你后来改变了什么判断？"],
        ["能力迁移", `你的已有经历如何迁移到${role}的真实工作场景？`],
        ["入职计划", "如果进入团队，前30天你会如何建立业务理解并产生第一个可验证产出？"],
      ]
    : [
        ["求职动机", `为什么是${company}和${role}，而不是相近公司或岗位？`],
        ["职业规划", "这份岗位与你未来两到三年的职业方向如何连接？"],
        ["稳定性", "你当前还在推进哪些机会，做选择时最看重哪些因素？"],
        ["到岗约束", "你的到岗时间、持续周期和现实安排是什么？"],
        ["价值观", "请讲一次你在结果压力和正确做法之间进行取舍的经历。"],
        ["沟通成熟度", "面对负面反馈或误解时，你通常如何回应并推动问题解决？"],
        ["自我认知", "你当前最需要补齐的能力是什么，正在用什么方式验证进步？"],
        ["团队匹配", "你在哪种管理和协作方式下表现最好？不适应时会怎么调整？"],
        ["风险核验", `针对“${biggestRisk}”，请说明真实情况和你的解决计划。`],
        ["反向提问", "你希望通过哪些信息判断这份岗位是否真正适合你？"],
      ];
  const questions = commonQuestions.map(([category, question]) => ({
    category,
    question,
    whyAsked: isBusiness ? "验证专业能力能否形成真实、可迁移的工作闭环。" : "验证候选人的动机、约束和表述是否真实一致。",
    answerFramework: "先给结论 → 补充真实背景 → 说明个人动作与依据 → 给出结果或约束 → 连接目标岗位。",
    evidenceAnchor: strongestEvidence,
    businessConnection: `围绕${company}的${role}岗位要求作答；公司信息不足处应明确为基于材料推断。`,
    preparation: "准备90秒主版本，并核对时间、角色、动作和结果是否与简历一致。",
  }));
  return {
    title: isBusiness ? "业务复试 · 深度准备报告" : "HR 面试 · 专项准备报告",
    roundGoal: isBusiness ? "把已有经历从“做过”讲到“为什么这样判断、如何落地、能否迁移”。" : "让求职动机、现实约束与个人经历保持真实、一致且可被信任。",
    strategy: {
      coreNarrative: `${strongestEvidence}。以这条真实证据作为主线，主动连接${role}的核心要求。`,
      opening: isBusiness ? "用60秒交代岗位理解、最相关证据和希望在本轮重点展开的能力。" : "用60秒说明个人背景、岗位动机、最相关证据与明确的到岗安排。",
      questionsToAsk: isBusiness
        ? ["这个岗位当前最需要解决的业务问题是什么？", "团队判断方案优先级时最重视哪些指标？", "优秀候选人在入职前三个月通常会交付什么结果？"]
        : ["这个岗位后续的面试与决策流程如何安排？", "团队最看重候选人的哪些长期特质？", "岗位的工作节奏、协作方式和培养反馈机制是怎样的？"],
      riskReminder: biggestRisk,
    },
    questions,
    tasks: [
      { priority: "必须", task: "统一简历、口述与时间线", reason: "避免深度追问中出现事实边界不一致。" },
      { priority: "必须", task: isBusiness ? "准备3个可连续追问的项目案例" : "准备岗位动机与选择标准的真实版本", reason: "让回答有事实证据，而不是通用话术。" },
      { priority: "必须", task: `处理最大风险：${biggestRisk}`, reason: "下一轮通常会集中核验尚未闭环的疑点。" },
      { priority: "建议", task: `准备3个针对${company}的反向问题`, reason: "体现判断力，也用于核验岗位是否适合自己。" },
      { priority: "建议", task: "完成一次30分钟高压追问模拟", reason: "检验回答在连续追问下仍然具体、可信且一致。" },
    ],
  };
}

function normalizeFollowUpReport(raw: Partial<InterviewFollowUpReport>, track: InterviewTrack, original: AnalysisResult): InterviewFollowUpReport {
  const fallback = buildFollowUpFallback(track, original.meta.company, original.meta.role, original.strengths?.[0] || "简历中最相关的真实经历", original.biggestRisk || "当前报告中的最大证据缺口");
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = [...rawQuestions, ...fallback.questions]
    .map((item) => ({
      category: item.category || "深度追问",
      question: item.question || "请结合真实经历回答这道问题。",
      whyAsked: item.whyAsked || "验证岗位相关能力与经历真实性。",
      answerFramework: item.answerFramework || "结论 → 背景 → 行动 → 结果 → 岗位连接。",
      evidenceAnchor: item.evidenceAnchor || "简历未发现可用证据",
      businessConnection: item.businessConnection || `结合${original.meta.company}与${original.meta.role}作答。`,
      preparation: item.preparation || "准备真实案例并核对事实边界。",
    }))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.question === item.question) === index)
    .slice(0, 10);
  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const tasks = [...rawTasks, ...fallback.tasks]
    .map((item) => ({
      priority: item.priority === "建议" ? "建议" as const : "必须" as const,
      task: item.task || "完成下一轮面试准备",
      reason: item.reason || "确保回答具体、可信且与岗位相关。",
    }))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.task === item.task) === index)
    .slice(0, 5);
  const questionsToAsk = [...(Array.isArray(raw.strategy?.questionsToAsk) ? raw.strategy.questionsToAsk : []), ...fallback.strategy.questionsToAsk]
    .filter((item, index, all) => typeof item === "string" && item.trim() && all.indexOf(item) === index)
    .slice(0, 3);
  return {
    title: raw.title?.trim() || fallback.title,
    roundGoal: raw.roundGoal?.trim() || fallback.roundGoal,
    strategy: {
      coreNarrative: raw.strategy?.coreNarrative?.trim() || fallback.strategy.coreNarrative,
      opening: raw.strategy?.opening?.trim() || fallback.strategy.opening,
      questionsToAsk,
      riskReminder: raw.strategy?.riskReminder?.trim() || fallback.strategy.riskReminder,
    },
    questions,
    tasks,
  };
}

function getTextContent(payload: unknown) {
  const data = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text ?? "").join("");
  }
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output)) {
    const outputText = data.output
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || typeof item.text === "string")
      .map((item) => item.text ?? "")
      .join("");
    if (outputText) return outputText;
  }
  throw new Error("模型没有返回可读取的文本结果");
}

function modelOutputWasTruncated(payload: unknown) {
  const data = payload as {
    status?: string;
    incomplete_details?: { reason?: string };
    choices?: Array<{ finish_reason?: string }>;
  };
  return data.status === "incomplete"
    || data.incomplete_details?.reason === "max_output_tokens"
    || data.choices?.[0]?.finish_reason === "length";
}

function removeProactiveContactDetails(value: string) {
  return value
    .split("\n")
    .filter((line) => !/^\s*(?:电话|手机|联系电话|联系方式|微信|wechat|mobile|tel)\s*[:：]/i.test(line))
    .join("\n")
    .replace(/(?:\+?86[-\s]?)?1[3-9](?:[-\s]?\d){9}\b/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeResult(raw: AnalysisResult, evidenceAnswers: EvidenceAnswer[] = []): AnalysisResult {
  const company = raw.meta?.company || "目标公司";
  const role = raw.meta?.role || "目标岗位";
  const roleSummary = raw.meta?.summary || "岗位核心职责";
  const strongestEvidence = raw.strengths?.[0] || "简历中的最相关项目经历";
  const mainRisk = raw.biggestRisk || "当前简历中证据最薄弱的岗位要求";
  const rawMessages = raw.messages ?? {};
  const legacyPlatformMessage = [rawMessages.recruiterGreeting, rawMessages.applicationReason]
    .filter(Boolean)
    .join(" ");
  const messages: AnalysisResult["messages"] = {
    platformMessage: rawMessages.platformMessage?.trim() || legacyPlatformMessage || `您好，我想应聘${company}的${role}。与岗位最相关的经历是：${strongestEvidence}。这段经历能直接对应${roleSummary}。如果方便，我想进一步了解团队对该岗位的核心期待，也可以随时补充项目材料。`,
    recruiterGreeting: rawMessages.recruiterGreeting,
    applicationReason: rawMessages.applicationReason,
    emailSubject: rawMessages.emailSubject?.trim() || `应聘${role}｜候选人简历`,
    emailBody: removeProactiveContactDetails(rawMessages.emailBody?.trim() || `您好，\n\n我希望申请${company}的${role}。我与该岗位最相关的证据是：${strongestEvidence}。这段经历让我能够将已验证的方法迁移到${roleSummary}中，并尽快产生可检验的工作产出。\n\n附件为我的简历；如果我的经历符合团队当前需求，希望有机会进一步交流具体的项目思路。\n\n谢谢！`),
  };
  const fallbackQuestions: AnalysisResult["interview"]["questions"] = [
    { category: "项目深挖", question: "请完整复盘一段与岗位最相关的项目，你承担了什么关键责任？", whyAsked: "验证经历真实性、职责边界与项目闭环。", answerFramework: "背景与目标 → 你的职责 → 关键判断 → 具体行动 → 结果 → 反思。", evidenceAnchor: strongestEvidence, businessConnection: `说明这段经历如何迁移到${roleSummary}。`, preparation: "准备3分钟主版本和60秒精简版本，所有结果都能回溯到简历事实。" },
    { category: "岗位能力", question: `你认为胜任${role}最重要的三项能力是什么？你分别如何证明？`, whyAsked: "验证你是否理解岗位，并能用证据完成自我匹配。", answerFramework: "拆解JD → 排序三项能力 → 每项给出证据 → 承认缺口 → 补齐计划。", evidenceAnchor: strongestEvidence, businessConnection: `将能力排序与${company}在JD中呈现的业务目标对应。`, preparation: "为每项能力准备一个真实例子和一个可量化结果。" },
    { category: "业务理解", question: `你如何理解${company}这类业务的核心用户价值与增长约束？`, whyAsked: "验证业务研究深度，排除只会复述岗位描述的回答。", answerFramework: "目标用户 → 核心场景 → 用户价值 → 业务价值 → 关键矛盾 → 风险。", evidenceAnchor: "如简历没有行业经历，明确从相邻项目经验进行迁移。", businessConnection: `基于用户提供的公司背景和JD分析${company}；材料不足处明确标注推断。`, preparation: "完成一页业务拆解，并准备一个竞品或替代方案的同维度比较。" },
    { category: "需求分析", question: "面对一句模糊的用户反馈，你会如何判断它是否值得进入需求池？", whyAsked: "考察从反馈到问题定义、再到验证的完整方法。", answerFramework: "澄清用户与场景 → 还原行为 → 判断频次/严重度 → 提出假设 → 选择验证方法。", evidenceAnchor: strongestEvidence, businessConnection: `用${role}的一个核心场景说明验证过程。`, preparation: "准备访谈、行为数据和可用性测试三种方法的适用边界。" },
    { category: "数据分析", question: "如果方案上线，你会用哪些指标判断它真的有效？", whyAsked: "验证能否把产品动作连接到可观测的业务结果。", answerFramework: "业务目标 → 核心结果指标 → 过程漏斗 → 用户分群 → 护栏指标 → 观察周期。", evidenceAnchor: "优先使用简历中的真实复盘或数据分析案例；没有则诚实说明。", businessConnection: `围绕${roleSummary}设计指标，避免只说DAU等泛化指标。`, preparation: "画出一棵指标树，并解释每个指标异常时的排查路径。" },
    { category: "方案设计", question: "如果资源只能支持一个改进方向，你会如何排序并验证方案？", whyAsked: "验证资源约束下的判断、取舍与风险意识。", answerFramework: "明确目标 → 建立评价维度 → 比较方案 → 选择MVP → 设定成功/停止标准。", evidenceAnchor: strongestEvidence, businessConnection: `把取舍标准连接到${company}的用户价值与业务约束。`, preparation: "准备一次真实取舍案例，解释被放弃方案及原因。" },
    { category: "协作推进", question: "当设计、研发或运营不同意你的方案时，你会如何推动决策？", whyAsked: "验证没有正式权力时的协作与推进能力。", answerFramework: "识别分歧类型 → 对齐共同目标 → 补充证据 → 小范围验证 → 明确决策与责任。", evidenceAnchor: "引用简历中多人协作、团队项目或活动推进的真实经历。", businessConnection: `${role}需要跨角色推动方案落地，回答应体现业务与技术约束。`, preparation: "准备一个真实冲突案例，明确各方观点和你采取的具体动作。" },
    { category: "成果复盘", question: "你最相关的项目中，哪个判断后来证明不够好？如果重做会怎么改？", whyAsked: "通过反思判断候选人是否真正拥有项目，而不是背诵成功故事。", answerFramework: "原判断 → 当时依据 → 新证据 → 问题影响 → 新方案 → 可迁移原则。", evidenceAnchor: strongestEvidence, businessConnection: `说明这次学习如何降低未来在${role}中的决策风险。`, preparation: "选择一个具体且可改进的判断，不回避问题，也不要否定整个项目。" },
    { category: "岗位动机", question: `为什么选择${company}的${role}，而不是相近岗位？`, whyAsked: "判断动机是否来自长期兴趣和经历积累，而非通用话术。", answerFramework: "经历触发 → 能力积累 → 业务兴趣 → 岗位匹配 → 下一阶段目标。", evidenceAnchor: strongestEvidence, businessConnection: `引用JD中的具体职责和公司业务场景，材料不足处说明为推断。`, preparation: "准备90秒版本，删除“平台大、能学到东西”等可替换表述。" },
    { category: "能力缺口", question: "目前你与岗位要求之间最大的能力缺口是什么？入职前后如何补齐？", whyAsked: "验证自我认知、诚实度与学习计划的可执行性。", answerFramework: "明确缺口 → 说明影响 → 已采取动作 → 里程碑 → 求助与校验机制。", evidenceAnchor: mainRisk, businessConnection: `解释该缺口对${roleSummary}的实际风险。`, preparation: "准备一个两周到四周的补齐计划，并明确可验收产出。" },
  ];

  const generatedQuestions = Array.isArray(raw.interview?.questions)
    ? raw.interview.questions.map((item) => ({
        category: item.category || "岗位追问",
        question: item.question || "请结合真实经历回答这道岗位问题。",
        whyAsked: item.whyAsked || "验证岗位相关能力与经历真实性。",
        answerFramework: item.answerFramework || "背景 → 判断 → 行动 → 结果 → 反思。",
        evidenceAnchor: item.evidenceAnchor || "从简历中选择可核验的真实经历。",
        businessConnection: item.businessConnection || `结合${company}与${role}的业务场景作答。`,
        preparation: item.preparation || "准备具体案例并核对事实边界。",
      }))
    : [];
  const questions = [...generatedQuestions, ...fallbackQuestions]
    .filter((item, index, all) => all.findIndex((other) => other.question === item.question) === index)
    .slice(0, 10);

  const fallbackTasks: AnalysisResult["interview"]["tasks"] = [
    { priority: "必须", task: "准备3个岗位相关STAR案例", reason: "覆盖项目判断、协作推进和结果复盘三类高频追问。" },
    { priority: "必须", task: `完成一页${company}业务与${role}职责拆解`, reason: "让回答能够连接公司业务，而不是停留在个人经历复述。" },
    { priority: "必须", task: "补齐JD中的硬性条件与最大证据缺口", reason: mainRisk },
    { priority: "建议", task: "准备岗位指标树或专业工具实操样例", reason: "用可展示产出证明数据与工具能力。" },
    { priority: "建议", task: "完成一次45分钟模拟面试并复盘", reason: "检验10道问题能否在限定时间内形成结构化、可信的回答。" },
  ];
  const generatedTasks = Array.isArray(raw.interview?.tasks) ? raw.interview.tasks : [];
  const tasks = [...generatedTasks, ...fallbackTasks]
    .filter((item, index, all) => all.findIndex((other) => other.task === item.task) === index)
    .slice(0, 5);
  const validReviewStatuses: EvidenceReviewStatus[] = ["证据充分", "需要补充", "无法采用"];
  const rawReviews = Array.isArray(raw.evidenceReview) ? raw.evidenceReview : [];
  const evidenceReview = evidenceAnswers.map((submitted) => {
    const matched = rawReviews.find((review) => review?.question?.trim() === submitted.question);
    const status = matched && validReviewStatuses.includes(matched.status) ? matched.status : "需要补充";
    return {
      question: submitted.question,
      answer: submitted.answer,
      status,
      feedback: matched?.feedback?.trim() || "模型没有给出完整审核结论，请补充更具体的场景、个人动作和可核验结果后重试。",
      usableEvidence: status === "证据充分" ? matched?.usableEvidence?.trim() || submitted.answer : "",
    };
  });

  return {
    ...raw,
    score: clampScore(raw.score),
    strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 3) : [],
    dimensions: Array.isArray(raw.dimensions)
      ? raw.dimensions.map((item) => ({ ...item, score: clampScore(item.score) }))
      : [],
    evidenceMatrix: Array.isArray(raw.evidenceMatrix) ? raw.evidenceMatrix : [],
    gaps: Array.isArray(raw.gaps) ? raw.gaps : [],
    followUpQuestions: Array.isArray(raw.followUpQuestions)
      ? raw.followUpQuestions.slice(0, 5)
      : [],
    evidenceReview,
    resumeSuggestions: Array.isArray(raw.resumeSuggestions)
      ? raw.resumeSuggestions
      : [],
    messages,
    interview: {
      roleInsight: raw.interview?.roleInsight ?? "",
      questions,
      tasks,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider?: ProviderId;
      model?: string;
      apiKey?: string;
      resumeText?: string;
      jdText?: string;
      companyContext?: string;
      profileContext?: string;
      evidenceAnswers?: EvidenceAnswer[];
      mode?: "full" | "interview_followup";
      interviewTrack?: InterviewTrack;
      previousRoundContext?: string;
      nextRoundContext?: string;
      originalResult?: AnalysisResult;
    };

    const provider = body.provider;
    if (!provider || !providerConfig[provider]) {
      return Response.json({ error: "请选择受支持的模型供应商" }, { status: 400 });
    }

    const resumeText = body.resumeText?.trim() ?? "";
    const jdText = body.jdText?.trim() ?? "";
    const model = body.model?.trim() ?? "";
    if (resumeText.length < 80) {
      return Response.json({ error: "简历内容过短，请补充后再分析" }, { status: 400 });
    }
    if (jdText.length < 80) {
      return Response.json({ error: "岗位描述过短，请粘贴完整JD" }, { status: 400 });
    }
    if (!model) {
      return Response.json({ error: "请填写模型名称" }, { status: 400 });
    }
    if (resumeText.length > 45_000 || jdText.length > 30_000) {
      return Response.json({ error: "文档内容过长，请精简后重试" }, { status: 413 });
    }

    const config = providerConfig[provider];
    const apiKey = body.apiKey?.trim() || process.env[config.envKey];
    if (!apiKey) {
      return Response.json(
        { error: `没有检测到密钥。请临时填写密钥，或在部署环境设置 ${config.envKey}。` },
        { status: 401 },
      );
    }

    const companyContext = body.companyContext?.trim() ?? "";
    const profileContext = (body.profileContext?.trim() ?? "").slice(0, 12_000);
    if (body.mode === "interview_followup") {
      const track = body.interviewTrack;
      if (track !== "business" && track !== "hr") {
        return Response.json({ error: "请选择下一轮是业务侧还是 HR 侧" }, { status: 400 });
      }
      const originalResult = body.originalResult;
      if (!originalResult?.meta?.company || !originalResult?.meta?.role) {
        return Response.json({ error: "原始分析报告不完整，请重新打开岗位档案后再试" }, { status: 400 });
      }
      const previousRoundContext = (body.previousRoundContext?.trim() ?? "").slice(0, 6_000);
      const nextRoundContext = (body.nextRoundContext?.trim() ?? "").slice(0, 6_000);
      const reportSummary = {
        meta: originalResult.meta,
        recommendation: originalResult.recommendation,
        strengths: originalResult.strengths,
        biggestRisk: originalResult.biggestRisk,
        evidenceMatrix: originalResult.evidenceMatrix,
        roleInsight: originalResult.interview?.roleInsight,
      };
      const followUpInput = `请生成下一轮面试的深度准备报告。

【面试类型】
${track === "business" ? "业务侧复试" : "HR侧面试"}

【候选人简历】
${resumeText}

【岗位JD】
${jdText}

【公司与业务背景】
${companyContext || "用户未补充；只能基于JD谨慎推断。"}

【原始分析报告摘要】
${JSON.stringify(reportSummary)}

【上一轮面试补充（可选）】
${previousRoundContext || "用户未提供，不得推断上一轮问过什么。"}

【下一轮已知信息（可选）】
${nextRoundContext || "用户未提供，不得推断面试官身份或具体安排。"}`;
      const controller = new AbortController();
      const timeoutMs = provider === "doubao" ? 180_000 : 150_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        const usesResponsesApi = provider === "doubao" || provider === "openai";
        const endpoint = usesResponsesApi ? "responses" : "chat/completions";
        const requestBody = usesResponsesApi
          ? {
              model,
              instructions: interviewFollowUpPrompt,
              input: followUpInput,
              ...(provider === "doubao" ? { thinking: { type: "disabled" } } : {}),
              max_output_tokens: 10_000,
            }
          : {
              model,
              messages: [
                { role: "system", content: interviewFollowUpPrompt },
                { role: "user", content: followUpInput },
              ],
              max_tokens: 10_000,
              ...(provider === "qwen" ? { enable_thinking: false } : {}),
              ...(provider === "deepseek" || provider === "zhipu" ? { thinking: { type: "disabled" } } : {}),
            };
        response = await fetch(`${config.baseUrl}/${endpoint}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const providerError = payload as { error?: { message?: string }; message?: string } | null;
        return Response.json({ error: providerError?.error?.message || providerError?.message || `模型接口返回 ${response.status}` }, { status: response.status });
      }
      if (modelOutputWasTruncated(payload)) {
        throw new Error("模型输出因长度限制被截断，请重试或切换输出能力更强的模型");
      }
      const parsed = parseModelJson(getTextContent(payload)) as Partial<InterviewFollowUpReport>;
      return Response.json({ report: normalizeFollowUpReport(parsed, track, originalResult), usage: (payload as { usage?: unknown }).usage ?? null });
    }
    const evidenceAnswers = Array.isArray(body.evidenceAnswers)
      ? body.evidenceAnswers
          .filter((item) => typeof item?.question === "string" && typeof item?.answer === "string")
          .map((item) => ({ question: item.question.trim().slice(0, 500), answer: item.answer.trim().slice(0, 3_000) }))
          .filter((item) => item.question && item.answer)
          .slice(0, 5)
      : [];
    const controller = new AbortController();
    const timeoutMs = provider === "doubao" ? 180_000 : 150_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      const evidenceInput = evidenceAnswers.length > 0
        ? evidenceAnswers.map((item, index) => `${index + 1}. 问题：${item.question}\n用户回答：${item.answer}`).join("\n\n")
        : "本轮没有提交证据补全回答。";
      const userInput = `请分析以下材料。\n\n【候选人简历】\n${resumeText}\n\n【岗位描述】\n${jdText}\n\n【求职画像补充】\n${profileContext || "用户未提供额外求职画像信息。"}\n\n【本轮证据补全回答】\n${evidenceInput}\n\n【公司与业务背景】\n${companyContext || "用户未单独提供。仅可根据岗位描述与稳定常识谨慎推断，并明确标注推断。"}`;
      const usesResponsesApi = provider === "doubao" || provider === "openai";
      const endpoint = usesResponsesApi ? "responses" : "chat/completions";
      const requestBody =
        usesResponsesApi
          ? {
              model,
              instructions: `${systemPrompt}${evidenceReviewPrompt}`,
              input: userInput,
              ...(provider === "doubao" ? { thinking: { type: "disabled" } } : {}),
              max_output_tokens: 12_000,
            }
          : {
              model,
              messages: [
                { role: "system", content: `${systemPrompt}${evidenceReviewPrompt}` },
                { role: "user", content: userInput },
              ],
              max_tokens: 12_000,
              ...(provider === "qwen" ? { enable_thinking: false } : {}),
              ...(provider === "deepseek" || provider === "zhipu"
                ? { thinking: { type: "disabled" } }
                : {}),
            };

      response = await fetch(`${config.baseUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const providerError = payload as { error?: { message?: string }; message?: string } | null;
      const message =
        providerError?.error?.message || providerError?.message || `模型接口返回 ${response.status}`;
      return Response.json({ error: message }, { status: response.status });
    }

    if (modelOutputWasTruncated(payload)) {
      throw new Error("模型输出因长度限制被截断，无法生成完整报告。请重试；如果连续出现，请切换输出能力更强的模型。");
    }
    const parsed = parseModelJson(getTextContent(payload)) as AnalysisResult;
    const result = normalizeResult(parsed, evidenceAnswers);
    return Response.json({ result, usage: (payload as { usage?: unknown }).usage ?? null });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "模型分析超过等待上限，请重试或切换更快的模型"
        : error instanceof Error
          ? error.message
          : "分析失败，请稍后重试";
    return Response.json({ error: message }, { status: 500 });
  }
}
