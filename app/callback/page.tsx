"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { Eye, EyeOff, KeyRound, ArrowRight } from "lucide-react";

export default function CallbackPage() {
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "reset" | "success" | "error">("loading");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase puts recovery tokens in the URL hash as:
      // #access_token=...&type=recovery  (PKCE flow)
      // or as query params: ?token=...&type=recovery  (older flow)
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);

      const type = hash.get("type") || query.get("type");
      const accessToken = hash.get("access_token");
      const code = query.get("code");

      // ── Password reset flow ──────────────────────────────────────────────
      if (type === "recovery") {
        if (accessToken) {
          // Set the session from the recovery token so updateUser works
          const refreshToken = hash.get("refresh_token") || "";
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
        setStatus("reset");
        return;
      }

      // ── OAuth / magic-link / email confirm flow ──────────────────────────
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setStatus("success");
          setTimeout(() => { window.location.href = "/"; }, 800);
          return;
        }
      }

      // Hash-based session (magic link)
      if (accessToken && type !== "recovery") {
        const refreshToken = hash.get("refresh_token") || "";
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error) {
          setStatus("success");
          setTimeout(() => { window.location.href = "/"; }, 800);
          return;
        }
      }

      setStatus("error");
      setTimeout(() => { window.location.href = "/auth?error=callback_failed"; }, 2000);
    };

    handleCallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Password updated! Taking you to the app…" });
      setTimeout(() => { window.location.href = "/"; }, 1200);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FDFBF9] via-[#FFF5EF] to-[#FFE8D6] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">

        {/* Loading */}
        {status === "loading" && (
          <div className="text-center">
            <img src="/logo.png" alt="CallMe" className="w-16 h-16 rounded-[20px] mx-auto mb-5 shadow-lg shadow-callme/20 animate-pulse" />
            <p className="font-display text-lg font-bold text-gray-800 mb-1">Just a moment…</p>
            <p className="text-gray-400 text-sm">Verifying your link</p>
          </div>
        )}

        {/* Password reset form */}
        {status === "reset" && (
          <div className="anim-fade-up">
            <div className="text-center mb-6">
              <img src="/logo.png" alt="CallMe" className="w-14 h-14 rounded-[16px] mx-auto mb-4 shadow-md shadow-callme/20" />
              <h2 className="font-display text-2xl font-bold">Set a new password</h2>
              <p className="text-gray-400 text-sm mt-1">Choose something you'll remember</p>
            </div>

            <div className="bg-white rounded-[22px] shadow-xl border border-gray-100 overflow-hidden p-5">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="text-[13px] font-medium text-gray-600 mb-1.5 block">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      autoFocus
                      className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme transition-all bg-gray-50/50 focus:bg-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {message && (
                  <div className={`p-3 rounded-xl text-sm ${
                    message.type === "error"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full callme-gradient text-white py-3.5 rounded-[14px] font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-callme/25 transition-all disabled:opacity-60"
                >
                  {saving ? "Saving…" : <><KeyRound className="w-4 h-4" /> Set New Password</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="text-center">
            <img src="/logo.png" alt="CallMe" className="w-16 h-16 rounded-[20px] mx-auto mb-5 shadow-lg shadow-callme/20 scale-110 transition-all duration-500" />
            <p className="font-display text-lg font-bold text-emerald-600 mb-1">You're in!</p>
            <p className="text-gray-400 text-sm">Taking you to CallMe…</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="text-center">
            <img src="/logo.png" alt="CallMe" className="w-16 h-16 rounded-[20px] mx-auto mb-5 shadow-lg shadow-callme/20" />
            <p className="font-display text-lg font-bold text-red-500 mb-1">Something went wrong</p>
            <p className="text-gray-400 text-sm">Redirecting you back…</p>
          </div>
        )}

      </div>
    </div>
  );
}
