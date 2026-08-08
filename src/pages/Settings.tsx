// ============================================
// Nancy OS — Settings Page
// User profile, preferences, data export info
// ============================================

import { useState, useEffect } from "react";
import { User, Mail, Clock, Database, ChevronRight, Loader2, CheckCircle2, ArrowLeft, Globe, Cpu, LogOut, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/hooks/useProfile";

export default function Settings() {
  const [, navigate] = useLocation();
  const { signOut } = useAuth();
  const { profile, loading, updateProfile, isUpdating } = useProfile();
  const [saved, setSaved] = useState(false);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState("zh");
  const [aiModel, setAiModel] = useState("deepseek");

  // Email + ai_model come from auth (not in profiles table)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || "");
        setAiModel((user.user_metadata?.ai_model as string) || "deepseek");
      }
    });
  }, []);

  // Profile fields initialized from profiles table (source of truth)
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setLanguage(profile.language_preference || "zh");
    }
  }, [profile]);

  const handleSave = async () => {
    setSaved(false);
    try {
      // 1. Write to profiles table (source of truth)
      await updateProfile({
        display_name: displayName,
        timezone,
        language_preference: language,
      });
      // 2. Sync ai_model to auth metadata (not stored in profiles)
      await supabase.auth.updateUser({
        data: { display_name: displayName, timezone, language, ai_model: aiModel },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error state handled by mutation
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-sage-deep" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-card-hover transition-colors"
        >
          <ArrowLeft size={18} className="text-ink-light" />
        </button>
        <h1 className="text-xl font-semibold text-ink">设置</h1>
      </header>

      {/* Profile Section */}
      <section className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">个人信息</p>
        </div>

        <div className="divide-y divide-border/50">
          {/* Email (read-only) */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-sky/10 flex items-center justify-center shrink-0">
              <Mail size={16} className="text-accent-sky" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-ink-lighter">邮箱</p>
              <p className="text-sm text-ink">{email || "未设置"}</p>
            </div>
          </div>

          {/* Display Name */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
              <User size={16} className="text-sage-deep" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-ink-lighter mb-1">显示名称</p>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="你的名字"
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50 transition-colors"
              />
            </div>
          </div>

          {/* Timezone */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-warm/10 flex items-center justify-center shrink-0">
              <Clock size={16} className="text-accent-warm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-ink-lighter mb-1">时区</p>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Shanghai"
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between">
          <p className="text-[11px] text-ink-lighter">
            {saved ? "已保存" : "修改后请点击保存"}
          </p>
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
              saved
                ? "bg-emerald-50 text-emerald-600"
                : "bg-sage-light text-sage-deep hover:bg-sage-light/80",
            )}
          >
            {isUpdating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <CheckCircle2 size={14} />
            ) : null}
            {isUpdating ? "保存中..." : saved ? "已保存" : "保存"}
          </button>
        </div>
      </section>

      {/* Preferences */}
      <section className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">偏好设置</p>
        </div>

        <div className="divide-y divide-border/50">
          {/* Language */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
              <Globe size={16} className="text-sage-deep" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-ink-lighter mb-1">界面语言</p>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50 transition-colors"
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* AI Model */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-sky/10 flex items-center justify-center shrink-0">
              <Cpu size={16} className="text-accent-sky" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-ink-lighter mb-1">AI 模型</p>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50 transition-colors"
              >
                <option value="deepseek">DeepSeek (默认)</option>
                <option value="claude">Claude</option>
                <option value="gpt4">GPT-4</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* AI Health */}
      <section className="bg-white border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => navigate("/settings/ai-health")}
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-card-hover transition-colors text-left"
        >
          <div className="h-9 w-9 rounded-xl bg-accent-sky/10 flex items-center justify-center shrink-0">
            <Activity size={16} className="text-accent-sky" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink">AI 运行状态</p>
            <p className="text-[11px] text-ink-lighter">查看 AI 服务健康状态与调用历史</p>
          </div>
          <ChevronRight size={14} className="text-ink-lighter shrink-0" />
        </button>
      </section>

      {/* Data & Export */}
      <section className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">数据管理</p>
        </div>

        <button
          onClick={() => navigate("/reflection")}
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-card-hover transition-colors text-left"
        >
          <div className="h-9 w-9 rounded-xl bg-accent-rose/10 flex items-center justify-center shrink-0">
            <Database size={16} className="text-accent-rose" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink">AI 记忆中心</p>
            <p className="text-[11px] text-ink-lighter">查看和管理你的长期记忆</p>
          </div>
          <ChevronRight size={14} className="text-ink-lighter shrink-0" />
        </button>

        <div className="px-4 py-3.5 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-ink/5 flex items-center justify-center shrink-0">
              <Database size={16} className="text-ink-light" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink">数据导出</p>
              <p className="text-[11px] text-ink-lighter">
                你的所有数据都存储在 Supabase 中，可通过 SQL 编辑器或 API 导出。Edge Functions 使用 DeepSeek 进行 AI 分析。数据不会离开你的 Supabase 项目。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">账户操作</p>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-accent-rose/5 transition-colors text-left"
        >
          <div className="h-9 w-9 rounded-xl bg-accent-rose/10 flex items-center justify-center shrink-0">
            <LogOut size={16} className="text-accent-rose" />
          </div>
          <span className="text-sm text-accent-rose font-medium">退出登录</span>
        </button>
      </section>

      {/* Version */}
      <p className="text-center text-[11px] text-ink-lighter pb-4">
        Nancy OS v1.0 Beta · Built with Supabase + DeepSeek
      </p>
    </div>
  );
}
