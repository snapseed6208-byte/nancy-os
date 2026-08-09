// ============================================
// Nancy OS — Navigation Configuration
// Phase: Sidebar Personalization System v1.0
//
// All sidebar items are defined here.
// Order, visibility, and groups are controlled by
// user preferences (localStorage), not this file.
// ============================================

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  group: NavigationGroup;
  defaultOrder: number;
  description: string;
}

export type NavigationGroup = "core" | "learning" | "career" | "life" | "system";

export const GROUP_LABELS: Record<NavigationGroup, string> = {
  core: "核心",
  learning: "学习",
  career: "职业",
  life: "生活",
  system: "系统",
};

export const GROUP_ORDER: NavigationGroup[] = [
  "core",
  "learning",
  "career",
  "life",
  "system",
];

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: "home",
    label: "首页 Dashboard",
    icon: "LayoutDashboard",
    path: "/",
    group: "core",
    defaultOrder: 0,
    description: "每日控制中心",
  },
  {
    id: "ai-dashboard",
    label: "AI 仪表盘",
    icon: "Sparkles",
    path: "/dashboard/ai",
    group: "core",
    defaultOrder: 1,
    description: "个人 AI 能力驾驶舱",
  },
  {
    id: "plan",
    label: "计划管理",
    icon: "CalendarCheck",
    path: "/plan",
    group: "core",
    defaultOrder: 2,
    description: "目标、任务、习惯",
  },
  {
    id: "chinese",
    label: "中文表达",
    icon: "Mic",
    path: "/chinese",
    group: "learning",
    defaultOrder: 10,
    description: "中文表达训练",
  },
  {
    id: "english",
    label: "English OS",
    icon: "BookOpen",
    path: "/english",
    group: "learning",
    defaultOrder: 11,
    description: "口语、表达库、复习",
  },
  {
    id: "exam",
    label: "考试学习",
    icon: "GraduationCap",
    path: "/exam",
    group: "learning",
    defaultOrder: 12,
    description: "IELTS、课程、证书",
  },
  {
    id: "resources",
    label: "知识库",
    icon: "FolderOpen",
    path: "/resources",
    group: "learning",
    defaultOrder: 13,
    description: "资源收藏与管理",
  },
  {
    id: "career",
    label: "工作成长",
    icon: "Briefcase",
    path: "/career",
    group: "career",
    defaultOrder: 20,
    description: "求职、面试、职业规划",
  },
  {
    id: "health",
    label: "健康管理",
    icon: "Heart",
    path: "/health",
    group: "life",
    defaultOrder: 30,
    description: "健身、饮食、身体档案",
  },
  {
    id: "life-trace",
    label: "Life Trace",
    icon: "Footprints",
    path: "/life-trace",
    group: "life",
    defaultOrder: 31,
    description: "日记、心情、记账",
  },
  {
    id: "ideas",
    label: "灵感库",
    icon: "Lightbulb",
    path: "/ideas",
    group: "life",
    defaultOrder: 32,
    description: "想法捕捉与整理",
  },
  {
    id: "review",
    label: "数据复盘",
    icon: "BarChart3",
    path: "/review",
    group: "life",
    defaultOrder: 33,
    description: "周报、月报、趋势",
  },
  {
    id: "reflection",
    label: "AI 反思",
    icon: "Brain",
    path: "/reflection",
    group: "system",
    defaultOrder: 40,
    description: "深度反思与成长洞察",
  },
  {
    id: "memory-center",
    label: "记忆中心",
    icon: "Database",
    path: "/memory-center",
    group: "system",
    defaultOrder: 41,
    description: "AI 记忆管理与确认",
  },
];

// Build a lookup map for fast access
export const NAVIGATION_BY_ID: Record<string, NavigationItem> = {};
for (const item of NAVIGATION_ITEMS) {
  NAVIGATION_BY_ID[item.id] = item;
}

// Default order: by group then by defaultOrder within group
export const DEFAULT_ITEM_ORDER = NAVIGATION_ITEMS.map((i) => i.id);
