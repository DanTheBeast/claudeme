"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { BottomNav } from "@/app/_components/bottom-nav";
import { Toast } from "@/app/_components/toast";
import type { Profile } from "@/app/_lib/types";
import AuthPage from "@/app/auth/page";
import { soundAppLaunch } from "@/app/_lib/haptics";
import { SplashScreen } from "@capacitor/splash-screen";

interface AppContextType {
  user: Profile | null;
  refreshUser: () => Promise<void>;
  toast: (msg: string) => void;
}

const AppContext = createContext<AppContextType>({
  user: null,
  refreshUser: async () => {},
  toast: () => {},
});

export const useApp = () => useContext(AppContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const launchJinglePlayed = useRef(false);

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setAuthed(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) setUser(data as Profile);
      setAuthed(true);
      // Play launch jingle only once on first load
      if (!launchJinglePlayed.current) {
        launchJinglePlayed.current = true;
        setTimeout(() => soundAppLaunch(), 400);
      }
    } catch (e) {
      setAuthed(false);
    }
    setLoading(false);
    // Hide splash screen as soon as app is ready
    try { await SplashScreen.hide(); } catch {}
  }, [supabase]);

  useEffect(() => {
    fetchProfile();

    // Re-check session when app comes back to foreground
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchProfile();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Show loading spinner immediately so AuthPage doesn't flash
        setLoading(true);
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) setUser(data as Profile);
        setAuthed(true);
        setLoading(false);
      } else {
        setUser(null);
        setAuthed(false);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          if (user && payload.new.id === user.id) {
            setUser(payload.new as Profile);
          }
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="CallMe" className="w-14 h-14 rounded-[18px] mx-auto mb-3 animate-pulse" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return <AuthPage />;
  }

  return (
    <AppContext.Provider value={{ user, refreshUser: fetchProfile, toast }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="text-center py-4 text-xs text-gray-500 pb-20">
          Copyright Dan Fields 2026. All Rights Reserved.
        </footer>
      </div>
      <BottomNav />
      {toastMsg && (
        <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}
    </AppContext.Provider>
  );
}
