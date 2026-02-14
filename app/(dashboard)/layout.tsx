"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { BottomNav } from "@/app/_components/bottom-nav";
import { Toast } from "@/app/_components/toast";
import type { Profile } from "@/app/_lib/types";

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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (data) setUser(data as Profile);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProfile();

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
      supabase.removeChannel(channel);
    };
  }, []);

  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 callme-gradient rounded-[18px] flex items-center justify-center mx-auto mb-3 animate-pulse">
            <div className="w-6 h-6 bg-white/30 rounded-lg" />
          </div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
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
