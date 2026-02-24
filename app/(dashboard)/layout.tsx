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
import { registerPushNotifications, clearNotificationBadge } from "@/app/_lib/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { App as CapApp } from "@capacitor/app";

interface AppContextType {
  user: Profile | null;
  refreshUser: () => Promise<void>;
  toast: (msg: string) => void;
  pendingRequests: number;
}

const AppContext = createContext<AppContextType>({
  user: null,
  refreshUser: async () => {},
  toast: () => {},
  pendingRequests: 0,
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
  const [pendingRequests, setPendingRequests] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const launchJinglePlayed = useRef(false);
  const initialLoadDone = useRef(false);
  const pushRegistered = useRef(false);
  const splashHidden = useRef(false);

  const hideSplash = useCallback(async () => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    try { await SplashScreen.hide(); } catch {}
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setAuthed(false);
        setLoading(false);
        initialLoadDone.current = true;
        hideSplash();
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) setUser(data as Profile);
      setAuthed(true);

      // Silently sync the user's timezone — update only if it has changed
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTz && data?.timezone !== detectedTz) {
        supabase
          .from("profiles")
          .update({ timezone: detectedTz })
          .eq("id", session.user.id)
          .then(() => {});
      }

      // Fetch pending friend requests count for nav badge
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("friend_id", session.user.id)
        .eq("status", "pending");
      setPendingRequests(count ?? 0);

      // Hide splash and play jingle as soon as profile is loaded —
      // defer everything else (push, realtime) so UI renders first
      setLoading(false);
      initialLoadDone.current = true;
      hideSplash();

      if (!launchJinglePlayed.current) {
        launchJinglePlayed.current = true;
        setTimeout(() => soundAppLaunch(), 300);
      }

      // Defer push registration + badge clear until after UI is interactive
      setTimeout(() => {
        if (!pushRegistered.current) {
          pushRegistered.current = true;
          registerPushNotifications(session.user.id, supabase).catch(() => {});
          clearNotificationBadge();
        }
      }, 1000);

    } catch (e) {
      setAuthed(false);
      setLoading(false);
      initialLoadDone.current = true;
      hideSplash();
    }
  }, [supabase, hideSplash]);

  useEffect(() => {
    // Safety net: never stay stuck on loading screen beyond 15s
    const timeout = setTimeout(() => {
      if (!initialLoadDone.current) {
        setLoading(false);
        initialLoadDone.current = true;
        hideSplash();
      }
    }, 15000);

    // Fallback push registration if fetchProfile didn't trigger it
    const pushRetry = setTimeout(async () => {
      if (pushRegistered.current) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        pushRegistered.current = true;
        registerPushNotifications(session.user.id, supabase).catch((e) => {
          console.error("[CallMe] push retry failed:", e);
        });
      }
    }, 3000);

    fetchProfile();

    const handleForeground = async () => {
      // Refresh the session first in case the token expired while backgrounded,
      // then re-fetch the profile so queries don't fail with auth errors.
      try { await supabase.auth.refreshSession(); } catch {}
      fetchProfile();
      clearNotificationBadge();
    };

    // visibilitychange covers web/browser; appStateChange covers native iOS background→foreground
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleForeground();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Capacitor app state — fires when returning from background on iOS
    let appStateListener: { remove: () => void } | null = null;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) handleForeground();
    }).then((l) => { appStateListener = l; }).catch(() => {});

    // onAuthStateChange handles sign-in/sign-out transitions AFTER initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Skip the initial INITIAL_SESSION event — fetchProfile already handles it
      if (!initialLoadDone.current) return;

      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) setUser(data as Profile);
        setAuthed(true);
        if (!pushRegistered.current) {
          pushRegistered.current = true;
          registerPushNotifications(session.user.id, supabase).catch((e) => {
            console.error("[CallMe] push registration failed:", e);
          });
        }
      } else {
        setUser(null);
        setAuthed(false);
      }
    });

    // Scope the Realtime subscription to the current user's row only —
    // without a filter every profile UPDATE on the table fans out to all clients.
    const getProfileChannel = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return null;
      return supabase
        .channel("profile-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${uid}`,
          },
          (payload) => {
            setUser((current) => {
              if (current && payload.new.id === current.id) {
                return payload.new as Profile;
              }
              return current;
            });
          }
        )
        .subscribe();
    };
    const channelPromise = getProfileChannel();

    return () => {
      clearTimeout(timeout);
      clearTimeout(pushRetry);
      document.removeEventListener("visibilitychange", handleVisibility);
      appStateListener?.remove();
      subscription.unsubscribe();
      channelPromise.then((ch) => { if (ch) supabase.removeChannel(ch); });
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
    <AppContext.Provider value={{ user, refreshUser: fetchProfile, toast, pendingRequests }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
      </div>
      <BottomNav pendingRequests={pendingRequests} />
      {toastMsg && (
        <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}
    </AppContext.Provider>
  );
}
