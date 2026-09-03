// ============================================
// Habit Lab — Sprint icon set (lucide names)
// Stored on habit_sprints.icon as the string key.
// ============================================

import {
  BookOpen, Dumbbell, Footprints, Coffee, Droplets, Moon, Sun, Leaf,
  Languages, Mic, HeartPulse, Brain, NotebookPen, Bike, Code, Palette,
  Star, Cake, Popcorn, Gift, Sparkles,
  type LucideIcon,
} from "lucide-react";

export const REWARD_ICONS: Record<string, LucideIcon> = {
  Star, Coffee, Cake, Popcorn, BookOpen, Sparkles, Gift,
};

export function getRewardIcon(key: string): LucideIcon {
  return REWARD_ICONS[key] || Star;
}

export const HABIT_ICONS: Record<string, LucideIcon> = {
  BookOpen, Dumbbell, Footprints, Coffee, Droplets, Moon, Sun, Leaf,
  Languages, Mic, HeartPulse, Brain, NotebookPen, Bike, Code, Palette,
};

/** Picker catalog: name → lucide icon, Chinese label, quiet English tagline. */
export const HABIT_ICON_CHOICES: { key: string; label: string }[] = [
  { key: "BookOpen", label: "阅读" },
  { key: "NotebookPen", label: "书写" },
  { key: "Languages", label: "语言" },
  { key: "Mic", label: "表达" },
  { key: "Dumbbell", label: "力量" },
  { key: "Footprints", label: "行走" },
  { key: "Bike", label: "骑行" },
  { key: "Droplets", label: "饮水" },
  { key: "Coffee", label: "习惯伴侣" },
  { key: "Leaf", label: "自然" },
  { key: "Moon", label: "睡眠" },
  { key: "Sun", label: "晨间" },
  { key: "HeartPulse", label: "健康" },
  { key: "Brain", label: "思考" },
  { key: "Code", label: "编程" },
  { key: "Palette", label: "创作" },
];

export function getHabitIcon(key: string): LucideIcon {
  return HABIT_ICONS[key] || BookOpen;
}

/** Default icon key used when none chosen. */
export const DEFAULT_HABIT_ICON = "BookOpen";

/** Reward icons for the milestone shelf (small, curated). */
export const REWARD_ICON_CHOICES: { key: string; label: string }[] = [
  { key: "Coffee", label: "咖啡" },
  { key: "Cake", label: "甜点" },
  { key: "Popcorn", label: "电影" },
  { key: "BookOpen", label: "书" },
  { key: "Sparkles", label: "犒赏" },
  { key: "Gift", label: "礼物" },
];
