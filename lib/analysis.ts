export type ProviderId = "doubao" | "qwen" | "deepseek" | "zhipu" | "openai";

export interface ModelOption {
  id: string;
  name: string;
  note: string;
}

export type EvidenceStatus =
  | "已充分证明"
  | "表达不足"
  | "信息不足"
  | "当前缺失";

export type GapType = "表达缺口" | "信息缺口" | "准备缺口" | "硬性门槛";

export interface EvidenceAnswer {
  question: string;
  answer: string;
}

export type EvidenceReviewStatus = "证据充分" | "需要补充" | "无法采用";

export type InterviewTrack = "business" | "hr";

export interface InterviewFollowUpReport {
  title: string;
  roundGoal: string;
  strategy: {
    coreNarrative: string;
    opening: string;
    questionsToAsk: string[];
    riskReminder: string;
  };
  questions: AnalysisResult["interview"]["questions"];
  tasks: AnalysisResult["interview"]["tasks"];
}

export interface AnalysisResult {
  meta: {
    company: string;
    role: string;
    summary: string;
  };
  score: number;
  confidence: "高" | "中" | "低";
  recommendation: "建议投递" | "优化后投递" | "低优先级投递";
  verdict: string;
  strengths: string[];
  biggestRisk: string;
  dimensions: Array<{
    name: string;
    score: number;
    weight: number;
    note: string;
  }>;
  evidenceMatrix: Array<{
    requirement: string;
    importance: "核心" | "重要" | "加分";
    status: EvidenceStatus;
    evidence: string;
    strength: "强" | "中" | "弱" | "无";
    gapType: GapType | "无";
    action: string;
  }>;
  gaps: Array<{
    type: GapType;
    title: string;
    description: string;
    action: string;
  }>;
  followUpQuestions: string[];
  evidenceReview?: Array<{
    question: string;
    answer: string;
    status: EvidenceReviewStatus;
    feedback: string;
    usableEvidence: string;
  }>;
  resumeSuggestions: Array<{
    original: string;
    rewrite: string;
    reason: string;
    source: string;
  }>;
  messages: {
    platformMessage: string;
    recruiterGreeting?: string;
    applicationReason?: string;
    emailSubject: string;
    emailBody: string;
  };
  interview: {
    roleInsight: string;
    questions: Array<{
      category: string;
      question: string;
      whyAsked: string;
      answerFramework: string;
      evidenceAnchor: string;
      businessConnection: string;
      preparation: string;
    }>;
    tasks: Array<{
      priority: "必须" | "建议";
      task: string;
      reason: string;
    }>;
  };
}

export const providers: Record<
  ProviderId,
  {
    name: string;
    shortName: string;
    description: string;
    defaultModel: string;
    models: ModelOption[];
    keyHint: string;
    accent: string;
  }
> = {
  doubao: {
    name: "火山方舟",
    shortName: "豆包",
    description: "国内访问友好，中文任务性价比较高",
    defaultModel: "doubao-seed-2-0-lite-260215",
    models: [
      { id: "doubao-seed-2-0-lite-260215", name: "豆包 Seed 2.0 Lite", note: "高性价比，推荐日常分析" },
    ],
    keyHint: "ARK_API_KEY",
    accent: "blue",
  },
  qwen: {
    name: "阿里云百炼",
    shortName: "千问",
    description: "中文理解稳定，支持 OpenAI 兼容接口",
    defaultModel: "qwen3.7-plus",
    models: [
      { id: "qwen3.7-plus", name: "通义千问 3.7 Plus", note: "综合质量与成本均衡" },
      { id: "qwen3.7-flash", name: "通义千问 3.7 Flash", note: "响应更快、成本更低" },
      { id: "qwen-plus", name: "通义千问 Plus", note: "兼容性稳定的经典选择" },
    ],
    keyHint: "DASHSCOPE_API_KEY",
    accent: "violet",
  },
  deepseek: {
    name: "DeepSeek",
    shortName: "DS",
    description: "国产推理模型，擅长复杂分析与长文本",
    defaultModel: "deepseek-v4-flash",
    models: [
      { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", note: "速度与性价比优先" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", note: "更强的复杂推理能力" },
    ],
    keyHint: "DEEPSEEK_API_KEY",
    accent: "cyan",
  },
  zhipu: {
    name: "智谱开放平台",
    shortName: "GLM",
    description: "中文场景成熟，结构化输出能力稳定",
    defaultModel: "glm-5.2",
    models: [
      { id: "glm-5.2", name: "智谱 GLM-5.2", note: "旗舰推理与长文本分析" },
      { id: "glm-4.7-flash", name: "智谱 GLM-4.7 Flash", note: "轻量快速、适合高频使用" },
    ],
    keyHint: "ZHIPU_API_KEY",
    accent: "orange",
  },
  openai: {
    name: "OpenAI",
    shortName: "GPT",
    description: "适合稳定的结构化分析与复杂推理",
    defaultModel: "gpt-5.6-luna",
    models: [
      { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", note: "成本敏感型任务，推荐日常使用" },
      { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", note: "质量与成本均衡" },
      { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", note: "复杂专业任务，成本更高" },
    ],
    keyHint: "OPENAI_API_KEY",
    accent: "mint",
  },
};

export const sampleResume = `林晓｜产品经理实习生
复旦大学 信息管理与信息系统 本科 2023.09—2027.06

字节跳动校园产品训练营｜产品项目负责人 2025.03—2025.06
- 面向高校社团活动组织者，访谈12名社团负责人并梳理报名、通知和签到环节的主要问题
- 使用Figma完成活动管理小程序原型，负责需求分析、功能优先级和交互设计
- 组织5人团队完成可用性测试，根据18条反馈完成两轮迭代
- 项目在训练营终评中获得前10%

复旦大学学生会新媒体部｜运营成员 2024.09—2025.06
- 负责校园活动内容策划与公众号运营，独立完成8篇推送
- 通过选题复盘和发布时间测试，使平均阅读量从1,200提升至2,100

技能：Figma、Axure、Excel、SQL基础、用户访谈、原型设计`;

export const sampleJd = `小红书｜社区产品实习生
岗位职责：
1. 参与社区互动方向的产品需求分析、方案设计和项目推进；
2. 通过用户调研和数据分析发现问题，持续优化用户体验；
3. 协同设计、研发和运营团队推动产品功能落地；
4. 跟踪上线效果并进行数据复盘。

岗位要求：
1. 本科及以上学历，2027届优先，每周至少实习4天，持续4个月以上；
2. 对内容社区和用户产品有热情，有产品项目或互联网实习经历；
3. 逻辑清晰，具备良好的沟通协作与执行能力；
4. 熟练使用Figma、Axure等产品工具；
5. 具备SQL或数据分析能力者优先。

投递方式：请将简历发送至 campus-recruit@example.com（示例邮箱）。`;

export const sampleResult: AnalysisResult = {
  meta: {
    company: "小红书",
    role: "社区产品实习生",
    summary: "参与社区互动方向的需求分析、产品设计、跨团队推进与上线复盘。",
  },
  score: 78,
  confidence: "高",
  recommendation: "优化后投递",
  verdict:
    "你的用户研究和产品项目经历与岗位核心职责较匹配。当前主要问题不是经历不足，而是简历没有充分证明数据分析与跨团队落地能力。",
  strengths: [
    "完成过12名目标用户访谈，能够证明基础用户研究能力",
    "拥有从需求分析到原型测试的完整产品项目经历",
    "Figma、Axure等岗位明确要求的工具已覆盖",
  ],
  biggestRisk: "JD要求每周至少实习4天并持续4个月，当前简历未提供到岗信息。",
  dimensions: [
    { name: "核心能力", score: 84, weight: 30, note: "用户研究和需求分析证据较完整" },
    { name: "相关经历", score: 78, weight: 25, note: "有产品项目，但缺少正式互联网实习" },
    { name: "技能工具", score: 82, weight: 20, note: "产品工具覆盖，SQL仅为基础水平" },
    { name: "成果证据", score: 72, weight: 15, note: "有测试反馈和排名，业务指标较少" },
    { name: "加分项", score: 60, weight: 10, note: "具备内容运营背景，可补充社区理解" },
  ],
  evidenceMatrix: [
    {
      requirement: "用户调研与需求分析",
      importance: "核心",
      status: "已充分证明",
      evidence: "访谈12名社团负责人，梳理报名、通知和签到环节问题",
      strength: "强",
      gapType: "无",
      action: "在简历首条突出调研对象、数量和输出结论",
    },
    {
      requirement: "产品方案与原型设计",
      importance: "核心",
      status: "已充分证明",
      evidence: "使用Figma完成活动管理小程序原型并负责功能优先级",
      strength: "强",
      gapType: "无",
      action: "准备解释优先级判断依据和被舍弃的需求",
    },
    {
      requirement: "跨团队项目推进",
      importance: "重要",
      status: "表达不足",
      evidence: "组织5人团队完成可用性测试和两轮迭代",
      strength: "中",
      gapType: "表达缺口",
      action: "补充团队角色、协作方式和你解决的具体阻塞",
    },
    {
      requirement: "SQL或数据分析能力",
      importance: "加分",
      status: "信息不足",
      evidence: "技能栏出现SQL基础，未描述真实使用场景",
      strength: "弱",
      gapType: "信息缺口",
      action: "补充课程或项目中的SQL使用场景；没有则不要夸大",
    },
    {
      requirement: "每周4天，持续4个月",
      importance: "核心",
      status: "信息不足",
      evidence: "简历未提供可到岗时间",
      strength: "无",
      gapType: "硬性门槛",
      action: "投递前确认并在沟通文案中主动说明",
    },
  ],
  gaps: [
    {
      type: "表达缺口",
      title: "跨团队推进过程不清晰",
      description: "简历写了组织团队，但没有说明如何分工、推进和解决阻塞。",
      action: "补充一次具体的协作动作，以及该动作带来的项目结果。",
    },
    {
      type: "信息缺口",
      title: "SQL缺少使用证据",
      description: "技能栏中的“SQL基础”不足以证明能完成岗位的数据分析任务。",
      action: "补充一次真实查询或分析任务；若没有，列入面试前学习清单。",
    },
    {
      type: "硬性门槛",
      title: "到岗时间尚未确认",
      description: "这可能直接影响是否进入筛选流程。",
      action: "确认每周到岗天数和连续实习月份，并写入投递沟通。",
    },
  ],
  followUpQuestions: [
    "你每周可以到岗几天，最早何时开始实习？",
    "两轮迭代中，你具体推动团队解决过哪一个分歧或阻塞？",
    "你是否在课程或项目中用SQL完成过真实的数据查询？",
  ],
  evidenceReview: [],
  resumeSuggestions: [
    {
      original: "面向高校社团活动组织者，访谈12名社团负责人并梳理主要问题。",
      rewrite:
        "围绕社团活动报名与签到体验，访谈12名社团负责人，归纳通知触达、信息收集和现场核验3类核心痛点，并转化为产品需求清单。",
      reason: "补充了调研范围、问题分类和输出物，更直接对应JD中的用户调研与需求分析。",
      source: "训练营项目原文：访谈12名社团负责人；梳理报名、通知和签到问题。",
    },
    {
      original: "组织5人团队完成可用性测试，根据18条反馈完成两轮迭代。",
      rewrite:
        "协调5人团队完成核心流程可用性测试，按影响范围与修复成本归类18条反馈，推进两轮原型迭代并完成终评交付。",
      reason: "强化了项目推进和优先级判断，但没有虚构新增结果。",
      source: "训练营项目原文：5人团队、18条反馈、两轮迭代。",
    },
  ],
  messages: {
    platformMessage:
      "您好，我是复旦信息管理专业2027届学生，想应聘社区产品实习生。我曾从12名用户访谈中提炼需求，完成Figma原型并协调5人团队根据18条反馈推进两轮迭代；校园内容运营也让我理解内容与用户互动。这些经历能直接对应岗位的用户研究和方案推进，方便进一步聊聊吗？",
    recruiterGreeting:
      "您好，我是复旦大学信息管理专业2027届学生，有用户访谈、需求分析和Figma原型的完整产品项目经历，曾访谈12名目标用户并推动5人团队完成两轮迭代。对社区互动方向很感兴趣，每周可到岗时间确认后可立即补充，期待与您沟通。",
    applicationReason:
      "我对社区产品中用户表达与互动机制非常感兴趣。过往项目中，我从12名用户访谈出发，将活动组织痛点转化为需求清单，并负责功能优先级、原型设计和测试迭代。这段经历与岗位要求的用户调研、产品设计和协作推进高度相关。我也有校园内容运营经验，希望进一步理解内容社区的供需与互动机制。",
    emailSubject: "应聘社区产品实习生｜复旦大学林晓｜2027届",
    emailBody:
      "您好，\n\n我是复旦大学信息管理与信息系统专业2027届学生林晓，希望申请社区产品实习生。\n\n与岗位最相关的是一段完整产品项目：我访谈12名社团负责人，把报名、通知和签到问题转化为需求与Figma原型，随后协调5人团队根据18条测试反馈推进两轮迭代。这段经历能直接迁移到社区场景中的用户研究、方案取舍和跨团队推进。\n\n我另有校园内容运营经历，持续关注内容分发与用户互动。附件为个人简历，如果经历符合团队需求，希望有机会进一步交流具体的项目思路。\n\n谢谢！",
  },
  interview: {
    roleInsight:
      "小红书社区产品岗位的核心不是画原型，而是理解内容社区中用户表达、互动与治理之间的关系。面试官大概率会围绕你的训练营项目验证：你能否从模糊反馈中识别真实问题，并把需求判断、方案取舍、协作推进和数据复盘连成完整闭环。",
    questions: [
      {
        category: "项目深挖",
        question: "12名社团负责人是如何选择的？你如何判断样本足以支持结论？",
        whyAsked: "验证你的用户研究是否有方法，而不是只完成了访谈数量。",
        answerFramework: "研究目标 → 样本分层 → 关键问题 → 信息饱和度 → 研究局限。",
        evidenceAnchor: "简历中的“访谈12名社团负责人”与报名、通知、签到三类场景。",
        businessConnection: "社区产品同样需要区分创作者、浏览者和互动用户，避免用单一人群代表全部用户。",
        preparation: "准备样本构成、访谈提纲、共性与个性问题，并主动承认样本规模的局限。",
      },
      {
        category: "产品判断",
        question: "如果开发资源只能支持一个功能，你会优先解决报名、通知还是签到？",
        whyAsked: "验证你能否在资源约束下做出有依据的产品取舍。",
        answerFramework: "目标用户 → 问题频次/严重度 → 业务价值 → 实现成本 → 风险与验证方案。",
        evidenceAnchor: "你负责过功能优先级与两轮原型迭代，可用一次真实取舍作为主线。",
        businessConnection: "社区业务需要平衡互动增长、内容质量与用户体验，不能只追求单一点击指标。",
        preparation: "先明确决策标准，再给结论；补充你会如何用小范围实验验证选择。",
      },
      {
        category: "数据能力",
        question: "功能上线后，你会用哪些指标判断社区互动体验得到改善？",
        whyAsked: "JD明确要求数据分析与上线复盘，当前简历对此证明较弱。",
        answerFramework: "业务目标 → 核心结果指标 → 过程漏斗 → 护栏指标 → 分群与观察周期。",
        evidenceAnchor: "可借用公众号阅读量从1,200提升至2,100的复盘经验，但要说明与社区互动指标的差异。",
        businessConnection: "建议关注有效互动率、互动用户留存、内容消费深度，并设置举报率或负反馈率作为护栏。",
        preparation: "准备一张指标树，说明每个指标对应的用户行为及异常时如何定位原因。",
      },
      {
        category: "协作推进",
        question: "团队对方案存在分歧时，你具体如何推动达成一致？",
        whyAsked: "验证“组织5人团队”背后是否有真实的推进动作与影响力。",
        answerFramework: "分歧背景 → 各方诉求 → 共识标准 → 你采取的动作 → 结果与反思。",
        evidenceAnchor: "使用18条测试反馈和两轮迭代中的真实分歧，不要虚构研发协作经历。",
        businessConnection: "社区功能常涉及产品、设计、研发和运营多方约束，统一决策标准比强行说服更重要。",
        preparation: "准备一个有具体人物角色、争议点和最终决策的案例，控制在2分钟内。",
      },
      {
        category: "业务理解",
        question: "你认为小红书社区互动与普通内容平台的互动有什么不同？",
        whyAsked: "验证你是否真正理解目标公司，而不只是泛泛表达对产品工作的兴趣。",
        answerFramework: "用户动机 → 内容供给 → 互动关系 → 平台价值 → 潜在风险。",
        evidenceAnchor: "结合你的校园内容运营经验，说明选题、表达和反馈如何影响用户互动。",
        businessConnection: "从真实经验分享、决策参考和社区信任出发分析，避免把业务简单概括为点赞评论。",
        preparation: "选择一个你真实使用过的互动场景，与另一内容平台做同维度比较。",
      },
      {
        category: "需求分析",
        question: "如果用户说“社区评论区不好用”，你会如何把这句话转化为可验证的需求？",
        whyAsked: "考察你从模糊反馈识别问题本质的能力。",
        answerFramework: "澄清用户与场景 → 还原行为链路 → 定位问题 → 提出假设 → 设计验证。",
        evidenceAnchor: "复用社团活动中把报名、通知、签到问题拆成需求清单的方法。",
        businessConnection: "评论区问题可能涉及互动效率、氛围、安全感或信息价值，需要先区分业务目标。",
        preparation: "准备追问清单，并给出访谈、行为数据和可用性测试三种验证方式。",
      },
      {
        category: "方案设计",
        question: "请设计一个提升优质评论被看见概率的方案，你会如何避免副作用？",
        whyAsked: "验证产品方案是否兼顾用户价值、业务效果与生态风险。",
        answerFramework: "问题定义 → 目标人群 → 核心机制 → 指标 → 护栏 → 灰度实验。",
        evidenceAnchor: "用你做原型和可用性测试的经验说明方案如何从概念走到验证。",
        businessConnection: "提升评论曝光可能带来刷赞、从众效应或争议内容放大，需要设计治理护栏。",
        preparation: "至少提出一个排序机制、一个用户反馈机制和两个风险指标。",
      },
      {
        category: "成果复盘",
        question: "训练营项目最终进入前10%，但如果重新做一次，你最想改变哪个决策？",
        whyAsked: "通过反思深度判断你是否真正理解项目，而不是只复述成功结果。",
        answerFramework: "原决策 → 当时依据 → 后来发现的问题 → 新方案 → 可迁移的方法。",
        evidenceAnchor: "从访谈样本、优先级、测试方式或团队推进中选择一个真实遗憾。",
        businessConnection: "社区产品迭代需要快速学习，面试官更看重能否修正判断而非证明从不犯错。",
        preparation: "选择一个不会否定整个项目、但能体现认知升级的具体决策。",
      },
      {
        category: "岗位动机",
        question: "为什么是社区产品，而不是工具产品或内容运营？",
        whyAsked: "判断你的求职动机是否与经历连贯，以及入职后的稳定性。",
        answerFramework: "经历触发 → 能力积累 → 业务兴趣 → 岗位匹配 → 下一步成长目标。",
        evidenceAnchor: "串联活动管理产品项目与校园内容运营两段经历，不要只说喜欢小红书。",
        businessConnection: "强调你希望研究内容如何引发互动、互动如何形成社区价值。",
        preparation: "准备一个90秒版本，避免使用“平台大、能学到东西”等通用理由。",
      },
      {
        category: "能力缺口",
        question: "你的SQL目前只是基础水平，如果入职第一周需要独立取数，你会怎么做？",
        whyAsked: "直接验证当前最大能力短板是否可控，以及你的学习和求助方式。",
        answerFramework: "诚实界定水平 → 拆解任务 → 校验口径 → 小步查询 → 交叉验证 → 复盘补齐。",
        evidenceAnchor: "如无真实SQL项目就明确说明，不把课程练习包装成业务分析。",
        businessConnection: "社区指标口径复杂，取数前需要确认用户、内容、互动事件和时间窗口的定义。",
        preparation: "复习SELECT、JOIN、GROUP BY和窗口函数，准备一个可现场讲解的小型查询案例。",
      },
    ],
    tasks: [
      {
        priority: "必须",
        task: "补全可到岗时间并写入招聘平台沟通文案",
        reason: "这是JD的明确硬性条件。",
      },
      {
        priority: "必须",
        task: "用STAR结构准备训练营项目的3分钟讲述",
        reason: "这是最强匹配证据，几乎一定会被追问。",
      },
      {
        priority: "建议",
        task: "复习基础SQL并准备一个真实查询案例",
        reason: "能把当前弱证据转化为可信的加分项。",
      },
      {
        priority: "必须",
        task: "完成一页小红书社区互动业务拆解",
        reason: "面试回答需要连接公司业务，而不只是复述个人项目。",
      },
      {
        priority: "建议",
        task: "准备一套社区互动指标树与护栏指标",
        reason: "补强JD要求的数据分析与上线复盘能力。",
      },
    ],
  },
};

export function clampScore(value: unknown, fallback = 60) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}
