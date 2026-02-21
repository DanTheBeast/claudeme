"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import {
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
  KeyRound,
} from "lucide-react";

const LAST_EMAIL_KEY = "callme_last_email";

function getLastEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LAST_EMAIL_KEY) ?? "";
}

function saveLastEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_EMAIL_KEY, email);
}

export default function AuthPage() {
  const savedEmail = getLastEmail();
  const isReturning = savedEmail.length > 0;

  // Returning users skip straight to the sign-in form (step 2, signin mode)
  const [step, setStep] = useState(isReturning ? 2 : 0);
  const [mode, setMode] = useState<"signin" | "signup">(isReturning ? "signin" : "signup");
  const [email, setEmail] = useState(isReturning ? savedEmail : "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
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
      saveLastEmail(email);
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
      saveLastEmail(email);
      setMessage({ type: "success", text: "Signed in! Loading..." });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: "error", text: "Enter your email address above first." });
      return;
    }
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback`,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: "Password reset email sent! Check your inbox.",
      });
      setForgotMode(false);
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
              <img src="/logo.png" alt="CallMe" className="w-[88px] h-[88px] rounded-[26px] mx-auto mb-7 shadow-lg shadow-callme/25 anim-float" />
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
                No algorithms • No AI • Just friends
              </p>
            </div>
          )}

          {/* Step 1: How it works */}
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
                      i === 0 ? "anim-fade-up" : i === 1 ? "anim-fade-up-1" : "anim-fade-up-2"
                    }`}
                  >
                    <span className="text-[28px] leading-none">{v.emoji}</span>
                    <div>
                      <p className="font-semibold text-[15px] mb-0.5">{v.title}</p>
                      <p className="text-gray-500 text-[13px] leading-snug">{v.desc}</p>
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
                  {forgotMode ? "Reset your password" : mode === "signup" ? "Create your account" : "Welcome back"}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {forgotMode
                    ? "We'll send you a reset link"
                    : mode === "signup"
                    ? "Sign up to start connecting"
                    : isReturning && savedEmail
                    ? `Signing in as ${savedEmail}`
                    : "Sign in to continue"}
                </p>
              </div>

              <div className="bg-white rounded-[22px] shadow-xl border border-gray-100 overflow-hidden">
                {/* Tab switcher — hidden in forgot mode */}
                {!forgotMode && (
                  <div className="flex border-b border-gray-100">
                    {(["signup", "signin"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMode(m);
                          setMessage(null);
                          setPassword("");
                          // Pre-fill saved email when switching to sign-in
                          if (m === "signin" && savedEmail) setEmail(savedEmail);
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
                )}

                <form
                  onSubmit={forgotMode ? handleForgotPassword : mode === "signin" ? handleSignIn : handleSignUp}
                  className="p-5 space-y-3.5"
                >
                  {mode === "signup" && !forgotMode && (
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

                  {!forgotMode && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[13px] font-medium text-gray-600">
                          Password
                        </label>
                        {mode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setForgotMode(true);
                              setMessage(null);
                            }}
                            className="text-[12px] text-callme hover:underline"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
                          required
                          minLength={6}
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
                  )}

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
                    {loading ? (
                      "Please wait..."
                    ) : forgotMode ? (
                      <><KeyRound className="w-4 h-4" /> Send Reset Link</>
                    ) : mode === "signin" ? (
                      <>Sign In <ArrowRight className="w-4 h-4" /></>
                    ) : (
                      <>Create Account <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>

                  {forgotMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMode(false);
                        setMessage(null);
                      }}
                      className="w-full text-center text-gray-400 text-sm hover:text-gray-600 transition-colors pt-1"
                    >
                      ← Back to sign in
                    </button>
                  )}
                </form>
              </div>

              {!forgotMode && (
                <button
                  onClick={() => isReturning ? null : setStep(1)}
                  className="block mx-auto mt-4 text-gray-400 text-sm hover:text-gray-600 transition-colors"
                >
                  {isReturning ? (
                    <span
                      onClick={() => {
                        localStorage.removeItem(LAST_EMAIL_KEY);
                        setEmail("");
                        setStep(0);
                        setMode("signup");
                      }}
                    >
                      Not {savedEmail.split("@")[0]}? Sign in with a different account
                    </span>
                  ) : (
                    "← Back"
                  )}
                </button>
              )}
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
