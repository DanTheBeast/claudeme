"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { useApp } from "./layout";
import { feedbackToggleOn, feedbackToggleOff, feedbackSuccess, feedbackClick } from "@/app/_lib/haptics";
import { FriendCard } from "@/app/_components/friend-card";
import {
  Phone,
  PhoneOff,
  Plus,
  Lightbulb,
  Save,
  Clock,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import type { FriendWithProfile, Profile } from "@/app/_lib/types";

export default function HomePage() {
  const { user, refreshUser, toast } = useApp();
  const supabase = createClient();

  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [mood, setMood] = useState(user?.current_mood || "");
  const [moodDirty, setMoodDirty] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function loadFriends() {
      const { data: sentData } = await supabase
        .from("friendships")
        .select("id, status, friend_id")
        .eq("user_id", user!.id)
        .eq("status", "accepted");

      const { data: receivedData } = await supabase
        .from("friendships")
        .select("id, status, user_id")
        .eq("friend_id", user!.id)
        .eq("status", "accepted");

      const friendIds = [
        ...(sentData || []).map((f) => f.friend_id),
        ...(receivedData || []).map((f) => f.user_id),
      ];

      if (friendIds.length === 0) {
        setFriends([]);
        setLoadingFriends(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds);

      const allFriendships = [...(sentData || []), ...(receivedData || [])];
      const result: FriendWithProfile[] = (profiles || []).map((p) => {
        const friendship = allFriendships.find(
          (f) =>
            ("friend_id" in f && f.friend_id === p.id) ||
            ("user_id" in f && f.user_id === p.id)
        );
        return {
          id: friendship?.id || 0,
          status: "accepted",
          friend: p as Profile,
        };
      });

      setFriends(result);
      setLoadingFriends(false);
    }

    loadFriends();

    const channel = supabase
      .channel("friends-availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => loadFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const toggleAvailability = async () => {
    if (!user) return;
    const newVal = !user.is_available;
    if (newVal) feedbackToggleOn(); else feedbackToggleOff();
    await supabase
      .from("profiles")
      .update({ is_available: newVal, last_seen: new Date().toISOString() })
      .eq("id", user.id);
    await refreshUser();
    toast(
      newVal
        ? "You're available! Friends will be notified 📞"
        : "You're now unavailable"
    );
  };

  const saveMood = async () => {
    if (!user) return;
    feedbackSuccess();
    await supabase
      .from("profiles")
      .update({ current_mood: mood })
      .eq("id", user.id);
    await refreshUser();
    setMoodDirty(false);
    toast("Status updated! ✨");
  };

  const available = friends.filter((f) => f.friend.is_available);
  const offline = friends.filter((f) => !f.friend.is_available);

  if (!user) return null;

  return (
    <div className="pb-24">
      {/* Header — fixed, with explicit safe-area top padding */}
      <header
        className="app-header bg-white backdrop-blur-sm border-b border-gray-100/80 fixed left-0 right-0 z-30 flex flex-col max-w-md mx-auto relative overflow-visible"
        style={{ top: 0 }}
      >
        {/* Safe area spacer */}
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CallMe" className="w-8 h-8 rounded-[10px]" />
            <span className="font-display text-xl font-bold">CallMe</span>
          </div>
          <span className="text-sm text-gray-400">
            Hey {user.display_name?.split(" ")[0]}! 👋
          </span>
        </div>
      </header>

      {/* Spacer matching header height: safe-area + 56px */}
      <div style={{ height: "calc(env(safe-area-inset-top, 0px) + 56px)" }} />

      <main className="px-5 pt-5 flex flex-col gap-5">
        {/* ── Compact availability strip (not a giant circle) ── */}
        <div
          className={`bg-white rounded-[18px] border p-4 flex items-center justify-between shadow-sm anim-fade-up ${
            user.is_available
              ? "border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white"
              : "border-gray-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAvailability}
              className={`w-14 h-14 rounded-full border-none cursor-pointer flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                user.is_available
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 glow-green"
                  : "callme-gradient shadow-lg shadow-callme/25"
              }`}
            >
              {user.is_available ? (
                <Phone className="w-6 h-6 text-white" />
              ) : (
                <PhoneOff className="w-6 h-6 text-white" />
              )}
            </button>
            <div>
              <p className="font-semibold text-[15px]">
                {user.is_available
                  ? "You're available"
                  : "You're unavailable"}
              </p>
              <p className="text-[12px] text-gray-400 mt-0.5">
                {user.is_available
                  ? `${available.length} friend${available.length !== 1 ? "s" : ""} can see you're free`
                  : "Tap the circle to go live"}
              </p>
            </div>
          </div>
          <div
            className={`w-3 h-3 rounded-full ${
              user.is_available
                ? "bg-emerald-500 status-pulse"
                : "bg-gray-300"
            }`}
          />
        </div>

        {/* ── Available friends — the whole point of the app ── */}
        {!loadingFriends && available.length > 0 && (
          <div className="anim-fade-up-1">
            <div className="flex items-center gap-2 mb-3 px-0.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
              <span className="text-sm font-semibold text-emerald-800">
                Available now
              </span>
              <span className="text-xs text-emerald-500 font-medium">
                — call someone!
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {available.map((f) => (
                <FriendCard
                  key={f.id}
                  friend={f.friend}
                  showCallLabel
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Status / mood — smaller, less prominent ── */}
        <div className="rounded-[18px] bg-gradient-to-br from-[#FDFBF9] to-callme-50 border border-gray-100 p-4 anim-fade-up-2">
          <div className="flex items-center gap-2 mb-2.5">
            <Lightbulb className="w-4 h-4 text-callme" />
            <span className="font-semibold text-[14px]">Your status</span>
          </div>
          <textarea
            value={mood}
            onChange={(e) => {
              setMood(e.target.value);
              setMoodDirty(e.target.value !== (user.current_mood || ""));
            }}
            placeholder="What do you feel like chatting about?"
            rows={2}
            className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-callme/15 focus:border-callme bg-white resize-none"
          />
          {moodDirty && (
            <div className="flex justify-end mt-2">
              <button
                onClick={saveMood}
                className="callme-gradient text-white px-4 py-1.5 rounded-[10px] text-xs font-semibold flex items-center gap-1.5 hover:shadow-md transition-all"
              >
                <Save className="w-3 h-3" /> Save
              </button>
            </div>
          )}
        </div>

        {/* ── Loading skeleton ── */}
        {loadingFriends && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse flex items-center gap-3 bg-white rounded-[18px] p-4 border border-gray-100"
              >
                <div className="w-[46px] h-[46px] bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Offline friends — collapsed by default ── */}
        {!loadingFriends && offline.length > 0 && (
          <div className="anim-fade-up-3">
            <button
              onClick={() => setOfflineOpen(!offlineOpen)}
              className="w-full flex items-center justify-between py-2.5 px-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                Offline ({offline.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  offlineOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {offlineOpen && (
              <div className="flex flex-col gap-2.5 pt-1">
                {offline.map((f) => (
                  <FriendCard key={f.id} friend={f.friend} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── No friends empty state ── */}
        {!loadingFriends && friends.length === 0 && (
          <div className="bg-white rounded-[22px] p-8 shadow-sm border border-gray-100 text-center anim-fade-up-1">
            <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-callme-50 to-orange-50 flex items-center justify-center mx-auto mb-5">
              <Plus className="w-12 h-12 text-callme/50" />
            </div>
            <h3 className="font-display text-xl font-bold mb-1.5">
              Your people go here
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">
              Add the friends and family you actually want to talk to
              — not the whole internet.
            </p>
            <Link
              href="/friends"
              className="callme-gradient text-white px-6 py-3 rounded-[14px] text-sm font-semibold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-callme/25 transition-all"
            >
              <Plus className="w-4 h-4" /> Find Friends
            </Link>
          </div>
        )}

        {/* ── "Nobody free" nudge — actionable, not vanity stats ── */}
        {!loadingFriends &&
          friends.length > 0 &&
          available.length === 0 && (
            <div className="bg-white rounded-[22px] p-6 shadow-sm border border-gray-100 text-center anim-fade-up-3">
              <div className="w-12 h-12 rounded-full bg-callme-50 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-[22px] h-[22px] text-callme" />
              </div>
              <p className="font-semibold text-[15px] mb-1">
                Nobody&apos;s free right now
              </p>
              <p className="text-gray-400 text-[13px] leading-relaxed">
                Check your schedule to find the best time to catch up
                with friends.
              </p>
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1.5 mt-4 text-callme text-sm font-medium border border-callme-200 px-4 py-2 rounded-[12px] hover:bg-callme-50 transition-colors"
              >
                View Schedule
              </Link>
            </div>
          )}
      </main>
    </div>
  );
}
