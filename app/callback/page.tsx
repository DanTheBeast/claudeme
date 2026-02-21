"use client";

import { useEffect } from "react";
import { createClient } from "@/app/_lib/supabase-browser";

export default function CallbackPage() {
  const supabase = createClient();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          window.location.href = "/";
          return;
        }
      }

      // If something went wrong, redirect to auth page
      window.location.href = "/auth?error=callback_failed";
    };

    handleCallback();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center">
      <div className="text-center">
        <img src="/logo.png" alt="CallMe" className="w-14 h-14 rounded-[18px] mx-auto mb-3 animate-pulse" />
        <p className="text-gray-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
