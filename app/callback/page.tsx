"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/_lib/supabase-browser";

export default function CallbackPage() {
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
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
  }, [supabase]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FDFBF9] via-[#FFF5EF] to-[#FFE8D6] flex flex-col items-center justify-center p-5">
      <div className="text-center">
        <img
          src="/logo.png"
          alt="CallMe"
          className={`w-16 h-16 rounded-[20px] mx-auto mb-5 shadow-lg shadow-callme/20 transition-all duration-500 ${
            status === "success" ? "scale-110" : "animate-pulse"
          }`}
        />
        {status === "loading" && (
          <>
            <p className="font-display text-lg font-bold text-gray-800 mb-1">Signing you in…</p>
            <p className="text-gray-400 text-sm">Just a moment</p>
          </>
        )}
        {status === "success" && (
          <>
            <p className="font-display text-lg font-bold text-emerald-600 mb-1">You're in!</p>
            <p className="text-gray-400 text-sm">Taking you to CallMe…</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="font-display text-lg font-bold text-red-500 mb-1">Something went wrong</p>
            <p className="text-gray-400 text-sm">Redirecting you back…</p>
          </>
        )}
      </div>
    </div>
  );
}
