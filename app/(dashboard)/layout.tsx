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
import { initSentry, setSentryUser, clearSentryUser } from "@/app/_lib/sentry";
import { cacheClear } from "@/app/_lib/cache";
import { SplashScreen } from "@capacitor/splash-screen";
import { App as CapApp } from "@capacitor/app";

// Initialize Sentry as early as possible — before any component renders
initSentry();

interface AppContextType {
  user: Profile | null;
  refreshUser: () => Promise<void>;
  toast: (msg: string) => void;
  pendingRequests: number;
  refreshKey: number;
  pendingInviteFrom: string | null;
  clearPendingInvite: () => void;
}

const AppContext = createContext<AppContextType>({
  user: null,
  refreshUser: async () => {},
  toast: () => {},
  pendingRequests: 0,
  refreshKey: 0,
  pendingInviteFrom: null,
  clearPendingInvite: () => {},
});

export const useApp = () => useContext(AppContext);

const TIPS = [
  // App tips
  { emoji: "📞", text: "Tap the big button to go available. Your friends see it the moment you do." },
  { emoji: "⏱️", text: "Set a timer so you go offline automatically. No more awkward \"still there?\" moments." },
  { emoji: "💬", text: "Add a status to give friends a reason to call. A show, a game, whatever's on your mind." },
  { emoji: "🔔", text: "Turn on Availability Alerts to get notified the moment a friend goes free." },
  { emoji: "📅", text: "Set a weekly schedule so friends know when you're usually around." },
  { emoji: "🤫", text: "Mute a friend to hide their status without unfriending them." },
  { emoji: "👀", text: "Hide your online status if you want to browse without anyone knowing." },
  { emoji: "📵", text: "No feed, no likes, no algorithm. Just real calls with people you actually care about." },
  // Conversation starters
  { emoji: "🎬", text: "Ask them what they've been watching lately. Everyone has something." },
  { emoji: "😂", text: "Tell them about something that made you laugh this week." },
  { emoji: "🌱", text: "Ask what they've been working on. People love talking about what they're building." },
  { emoji: "🤔", text: "\"What's been on your mind lately?\" Simple question. Always goes somewhere good." },
  { emoji: "🎵", text: "Ask what they've had on repeat. Music is an easy in." },
  { emoji: "✈️", text: "Ask if they've been anywhere new lately, or if they're planning to." },
  { emoji: "😤", text: "Ask what's been stressing them out. Sometimes people just need to vent." },
  { emoji: "🍕", text: "Ask if they've eaten anywhere good recently. Food never fails." },
  { emoji: "💭", text: "\"How are you actually doing?\" Not the polite version. The real one." },
  { emoji: "🎮", text: "Ask what they've been playing, reading, or into lately. Curiosity is contagious." },
];

function LoadingScreen() {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      // Fade out, swap tip, fade in
      setVisible(false);
      fadeTimer = setTimeout(() => {
        setTipIndex((i) => (i + 1) % TIPS.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => {
      clearInterval(interval);
      // Also cancel the inner fade timer so it doesn't fire on an unmounted component
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, []);

  const tip = TIPS[tipIndex];

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col items-center justify-center px-8">
      <img src="/logo.png" alt="CallMe" className="w-14 h-14 rounded-[18px] mx-auto mb-6 animate-pulse" />
      <div
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.4s ease",
          minHeight: 72,
        }}
        className="text-center"
      >
        <div className="text-3xl mb-2">{tip.emoji}</div>
        <p className="text-gray-500 text-sm leading-relaxed max-w-[260px] mx-auto">{tip.text}</p>
      </div>
    </div>
  );
}

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingInviteFrom, setPendingInviteFrom] = useState<string | null>(null);
  const [showInviteCodePrompt, setShowInviteCodePrompt] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [redeemingCode, setRedeemingCode] = useState(false);
  const invitePromptShown = useRef(false);
  const supabase = useMemo(() => createClient(), []);
  const launchJinglePlayed = useRef(false);
  const initialLoadDone = useRef(false);
  const pushRegistered = useRef(false);
  const splashHidden = useRef(false);
  const foregroundBusy = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

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

      // Tag Sentry with the logged-in user so errors show who was affected
      setSentryUser(session.user.id, data?.username);

       // Silently sync the user's timezone — update only if it has changed
       const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
       if (detectedTz && data?.timezone !== detectedTz) {
         // Fire-and-forget timezone sync with error logging
         (async () => {
           try {
             const { error } = await supabase
               .from("profiles")
               .update({ timezone: detectedTz })
               .eq("id", session.user.id);
             if (error) {
               console.error("[CallMe] timezone sync failed:", error.message);
             } else {
               console.log("[CallMe] timezone synced:", detectedTz);
             }
           } catch (err: unknown) {
             const errMsg = err instanceof Error ? err.message : String(err);
             console.error("[CallMe] timezone sync error:", errMsg);
           }
         })();
       }

      // Fetch pending friend requests count for nav badge
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("friend_id", session.user.id)
        .eq("status", "pending");
      setPendingRequests(count ?? 0);

      // Show invite code prompt once for brand-new users (account < 10 min old,
      // not already shown this session). Gives them a chance to connect with
      // whoever invited them before they hit the empty friends list.
      if (
        !invitePromptShown.current &&
        data?.created_at &&
        Date.now() - new Date(data.created_at).getTime() < 10 * 60 * 1000
      ) {
        invitePromptShown.current = true;
        // Small delay so the app finishes rendering first
        setTimeout(() => setShowInviteCodePrompt(true), 1200);
      }

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
      // Only tear down the dashboard if we were never authenticated.
      // A transient network error on foreground resume should NOT unmount
      // the entire app — the user was already logged in; just leave everything
      // as-is and the Realtime/onAuthStateChange subscription will recover.
      if (!initialLoadDone.current) {
        setAuthed(false);
        setLoading(false);
        initialLoadDone.current = true;
        hideSplash();
      }
      // If already authenticated (resume scenario), silently ignore the error.
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
      // Guard against double-fire: both visibilitychange and appStateChange fire
      // on iOS foreground. Only let one through at a time.
      if (foregroundBusy.current) return;
      foregroundBusy.current = true;

      // If the app was backgrounded for more than 5 minutes, the WKWebView JS
      // context may be in a stale/suspended state — pending promises and timers
      // can be frozen, leaving spinners stuck and buttons unresponsive. A hard
      // reload is the safest recovery: it takes ~1s and guarantees a clean slate.
      const bgDuration = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (bgDuration > 5 * 60 * 1000) {
        window.location.reload();
        return;
      }

      try {
        // Refresh the session first in case the token expired while backgrounded,
        // then re-fetch the profile so queries don't fail with auth errors.
        // Await fetchProfile so the session is confirmed fresh before pages re-query.
        try { await supabase.auth.refreshSession(); } catch {}
        await fetchProfile();
        clearNotificationBadge();
      } finally {
        // Always bump refreshKey — even if fetchProfile hit a transient error,
        // child pages should still retry their own data loads.
        setRefreshKey((k) => k + 1);
        foregroundBusy.current = false;
      }
    };

    const handleBackground = () => {
      backgroundedAt.current = Date.now();
    };

    // visibilitychange covers web/browser; appStateChange covers native iOS background→foreground
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleForeground();
      } else {
        handleBackground();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Capacitor app state — fires when returning from background on iOS.
    // Await the promise immediately so the remove handle is available before
    // the cleanup function runs — prevents a leak on fast unmounts.
    const appStateListenerPromise = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) handleForeground(); else handleBackground();
    }).catch(() => null);

    // Handle callme:// deep links — fired when the website callback page opens
    // the app after email verification or password reset. The callback passes
    // the session tokens in the URL so we can sign the user in immediately.
    const appUrlListenerPromise = CapApp.addListener("appUrlOpen", async (data: { url: string }) => {
      try {
        const url = new URL(data.url);
        // callme://invite?code=x7k2m9ab — opened from a personal invite link
        // url.host === "invite" because callme://invite parses "invite" as the host
        if (url.host === "invite") {
          const code = url.searchParams.get("code");
          const from = url.searchParams.get("from"); // legacy support
          if (code) setPendingInviteFrom(code);
          else if (from) setPendingInviteFrom(from);
          return;
        }
        // callme://open?access_token=...&refresh_token=... — email verification callback
        const accessToken = url.searchParams.get("access_token");
        const refreshToken = url.searchParams.get("refresh_token") || "";
        if (accessToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          await fetchProfile();
          setRefreshKey((k) => k + 1);
        }
      } catch {}
    }).catch(() => null);

    // onAuthStateChange handles sign-in/sign-out transitions AFTER initial load.
    // IMPORTANT: only act on explicit SIGNED_OUT — never set authed=false on
    // TOKEN_REFRESHED or other transient events, which would unmount the entire
    // dashboard and cause all pages to remount with loading skeletons.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip the initial INITIAL_SESSION event — fetchProfile already handles it
      if (!initialLoadDone.current) return;

      if (event === "SIGNED_OUT") {
        // Clear per-user cache so a subsequent login doesn't see stale data
        if (user) cacheClear(user.id);
        setUser(null);
        setAuthed(false);
        clearSentryUser();
        return;
      }

      // TOKEN_REFRESHED fires every ~hour — no need to re-fetch the profile,
      // the session is still valid and no user data has changed.
      if (event === "TOKEN_REFRESHED") return;

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
      }
    });

    // Scope the Realtime subscription to the current user's row only —
     // without a filter every profile UPDATE on the table fans out to all clients.
     const getProfileChannel = async () => {
       const { data: { session } } = await supabase.auth.getSession();
       const uid = session?.user?.id;
       if (!uid) return null;

       // Wrap the channel subscription in a timeout guard to prevent hanging promises
       // from blocking the cleanup function on unmount.
       const timeoutPromise = new Promise<null>((resolve) =>
         setTimeout(() => {
           console.warn("[CallMe] realtime channel subscription timed out");
           resolve(null);
         }, 10000)
       );

       try {
         const channelPromise = supabase
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

         // Wait for either subscription to succeed or timeout
         return await Promise.race([
           channelPromise,
           timeoutPromise,
         ]);
       } catch {
         // Network error or subscription failure — return null and let Realtime retry on next focus
         return null;
       }
     };
     const channelPromise = getProfileChannel();

    return () => {
      clearTimeout(timeout);
      clearTimeout(pushRetry);
      document.removeEventListener("visibilitychange", handleVisibility);
      // Await the listener promises in the cleanup so remove() is always called,
      // even if the component unmounted before the addListener promise resolved.
      appStateListenerPromise.then((l) => l?.remove());
      appUrlListenerPromise.then((l) => l?.remove());
      subscription.unsubscribe();
      channelPromise.then((ch) => { if (ch) supabase.removeChannel(ch); });
    };
  // fetchProfile and supabase are stable (useCallback/useMemo) so listing them
  // here doesn't cause re-runs — it just satisfies exhaustive-deps correctly.
  }, [fetchProfile, supabase]);

  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!authed) {
    return <AuthPage />;
  }

  return (
    <AppContext.Provider value={{ user, refreshUser: fetchProfile, toast, pendingRequests, refreshKey, pendingInviteFrom, clearPendingInvite: () => setPendingInviteFrom(null) }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
      </div>
      <BottomNav pendingRequests={pendingRequests} />
      {toastMsg && (
        <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}

      {/* Invite code prompt — shown once to new users so they can connect
          with whoever sent them the link before hitting the empty friends list */}
      {showInviteCodePrompt && (
        <div
          className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-[4px] flex items-end justify-center"
          onClick={() => setShowInviteCodePrompt(false)}
        >
          <div
            className="bg-white rounded-t-[28px] w-full max-w-md px-6 pt-3 pb-10 anim-slide-up"
            style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-gray-200 mx-auto mb-6" />
            <h3 className="font-display text-xl font-bold mb-1">Got an invite code?</h3>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              If someone sent you a CallMe invite link, enter the code here to connect with them automatically.
            </p>
            <input
              type="text"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value.toLowerCase().trim())}
              placeholder="e.g. x7k2m9ab"
              maxLength={12}
              autoCorrect="off"
              autoCapitalize="none"
              className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm font-mono bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme mb-3"
            />
            <button
              disabled={inviteCodeInput.length < 4 || redeemingCode}
              onClick={async () => {
                setRedeemingCode(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/redeem-invite-code`,
                    {
                      method: "POST",
                      headers: {
                        "Authorization": `Bearer ${session?.access_token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ code: inviteCodeInput }),
                    }
                  );
                  const json = await res.json();
                  if (!res.ok) {
                    toast(json.error || "Invalid code — double-check and try again");
                    return;
                  }
                  toast(json.already_friends
                    ? `You're already friends with @${json.inviter_username}!`
                    : `Friend request sent to @${json.inviter_username}! 🎉`
                  );
                  setShowInviteCodePrompt(false);
                } catch {
                  toast("Something went wrong — try again");
                } finally {
                  setRedeemingCode(false);
                }
              }}
              className="w-full callme-gradient text-white py-3.5 rounded-[14px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 mb-3 hover:shadow-lg hover:shadow-callme/25 transition-all"
            >
              {redeemingCode
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connecting…</>
                : "Connect with Inviter"
              }
            </button>
            <button
              onClick={() => setShowInviteCodePrompt(false)}
              className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
            >
              Skip — I&apos;ll add friends later
            </button>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}
