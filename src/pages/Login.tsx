import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fn = mode === "login" ? signIn : signUp;
    const { error: err } = await fn(email.trim(), password);

    if (err) {
      setError(err);
    } else if (mode === "register") {
      setRegistered(true);
    }
    setLoading(false);
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
            <Sparkles size={28} className="text-sage-deep" />
          </div>
          <h2 className="text-xl font-semibold text-ink">注册成功</h2>
          <p className="text-sm text-ink-light">
            账户已创建。切换至登录模式开始使用。
          </p>
          <button
            onClick={() => { setMode("login"); setRegistered(false); setPassword(""); }}
            className="bg-sage-light text-sage-deep rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            前往登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-sage-light flex items-center justify-center mx-auto mb-3">
            <Sparkles size={22} className="text-sage-deep" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Nancy OS</h1>
          <p className="text-xs text-ink-lighter mt-1">Personal Growth AI Operating System</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex gap-1 bg-ink/5 rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "register" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink"
              }`}
            >
              注册
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-light block mb-1.5">邮箱</label>
            <input
              type="email"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-light"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink-light block mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 pr-10 focus:border-sage-light"
                placeholder={mode === "register" ? "至少6位字符" : "输入密码"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || password.length < 6}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            {mode === "login" ? "登录" : "注册"}
          </button>
        </form>
      </div>
    </div>
  );
}
