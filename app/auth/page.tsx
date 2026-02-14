"use client";

import { useState } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import {
  Phone,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";

export default function AuthPage() {
  const [step, setStep] = useState(0); // 0=splash, 1=how it works, 2=auth form
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: "Check your email for a confirmation link!",
      });
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      window.location.href = "/";
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FDFBF9] via-[#FFF5EF] to-[#FFE8D6] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm flex-1 flex items-center justify-center">
        <div className="w-full">
        {/* Step 0: Splash */}
        {step === 0 && (
          <div className="text-center anim-fade-up">
            <div className="w-[88px] h-[88px] rounded-[26px] callme-gradient flex items-center justify-center mx-auto mb-7 shadow-lg shadow-callme/25 anim-float">
              <Phone className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-display text-[42px] font-bold text-gray-900 tracking-tight">
              CallMe
            </h1>
            <p className="text-gray-500 text-[17px] leading-relaxed mt-2 mb-9">
              Real conversations
              <br />
              with people who matter
            </p>
            <button
              onClick={() => setStep(1)}
              className="w-full callme-gradient text-white py-4 rounded-[18px] font-semibold text-base flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-callme/25 transition-all"
            >
              Get Started <ArrowRight className="w-[18px] h-[18px]" />
            </button>
            <p className="text-gray-300 text-[13px] mt-5">
              Free to use · No ads · No algorithms
            </p>
          </div>
        )}

        {/* Step 1: How it works (value props as cards, not a wall of text) */}
        {step === 1 && (
          <div className="text-center anim-fade-up">
            <p className="text-[13px] font-semibold text-callme tracking-widest uppercase mb-5">
              How it works
            </p>
            <div className="flex flex-col gap-3 mb-8 text-left">
              {[
                {
                  emoji: "📱",
                  title: "Set your availability",
                  desc: "One tap to tell friends you're free to talk",
                },
                {
                  emoji: "👀",
                  title: "See who's free",
                  desc: "Know exactly when your people are available — no awkward interruptions",
                },
                {
                  emoji: "📞",
                  title: "Just call",
                  desc: "Tap to call. No scheduling apps, no text chains, just a real conversation",
                },
              ].map((v, i) => (
                <div
                  key={i}
                  className={`bg-white rounded-[18px] border border-gray-100 shadow-sm p-4 flex gap-3.5 items-start ${
                    i === 0
                      ? "anim-fade-up"
                      : i === 1
                      ? "anim-fade-up-1"
                      : "anim-fade-up-2"
                  }`}
                >
                  <span className="text-[28px] leading-none">{v.emoji}</span>
                  <div>
                    <p className="font-semibold text-[15px] mb-0.5">
                      {v.title}
                    </p>
                    <p className="text-gray-500 text-[13px] leading-snug">
                      {v.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full callme-gradient text-white py-4 rounded-[18px] font-semibold text-base flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-callme/25 transition-all"
            >
              Continue <ArrowRight className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setStep(0)}
              className="mt-3 text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 2: Auth form */}
        {step === 2 && (
          <div className="anim-fade-up">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {mode === "signup"
                  ? "Sign up to start connecting"
                  : "Sign in to continue"}
              </p>
            </div>

            {/* Auth card */}
            <div className="bg-white rounded-[22px] shadow-xl border border-gray-100 overflow-hidden">
              {/* Tab switcher */}
              <div className="flex border-b border-gray-100">
                {(["signup", "signin"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setMessage(null);
                    }}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                      mode === m
                        ? "text-callme border-b-2 border-callme"
                        : "text-gray-400 hover:text-gray-500"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              <form
                onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
                className="p-5 space-y-3.5"
              >
                {mode === "signup" && (
                  <div>
                    <label className="text-[13px] font-medium text-gray-600 mb-1.5 block">
                      Your name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Dan Fields"
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme transition-all bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[13px] font-medium text-gray-600 mb-1.5 block">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme transition-all bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[13px] font-medium text-gray-600 mb-1.5 block">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === "signup" ? "Min 6 characters" : "Your password"
                      }
                      required
                      minLength={6}
                      className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme transition-all bg-gray-50/50 focus:bg-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-xl text-sm ${
                      message.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full callme-gradient text-white py-3.5 rounded-[14px] font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-callme/25 transition-all disabled:opacity-60"
                >
                  {loading
                    ? "Please wait..."
                    : mode === "signin"
                    ? "Sign In"
                    : "Create Account"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </div>

            <button
              onClick={() => setStep(1)}
              className="block mx-auto mt-4 text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
        </div>
      </div>
      <footer className="text-center py-4 text-xs text-gray-400">
        Copyright Dan Fields 2026. All Rights Reserved.
      </footer>
    </div>
  );
}
