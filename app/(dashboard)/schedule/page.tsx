"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { useApp } from "../layout";
import { feedbackSuccess, feedbackError, feedbackClick } from "@/app/_lib/haptics";
import { BottomSheet } from "@/app/_components/bottom-sheet";
import { Avatar } from "@/app/_components/avatar";
import { Calendar, Clock, Plus, X, Users, Phone } from "lucide-react";
import type { AvailabilityWindow, Profile } from "@/app/_lib/types";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
  nowMinutes?: number  // if provided, the overlap must not have already ended
): boolean {
  const a0 = timeToMinutes(aStart);
  const a1 = timeToMinutes(aEnd);
  const b0 = timeToMinutes(bStart);
  const b1 = timeToMinutes(bEnd);
  if (!(a0 < b1 && b0 < a1)) return false;
  // For today: the overlap window ends at min(a1, b1) — if that's in the past, no match
  if (nowMinutes !== undefined) {
    const overlapEnd = Math.min(a1, b1);
    if (overlapEnd <= nowMinutes) return false;
  }
  return true;
}

interface FriendWindow extends AvailabilityWindow {
  friend?: Profile;
}

export default function SchedulePage() {
  const { user, toast } = useApp();
  const supabase = createClient();

  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [friendWindows, setFriendWindows] = useState<FriendWindow[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);
  const [showFriends, setShowFriends] = useState(true);
  const [addModal, setAddModal] = useState<{
    day: number;
    start: string;
    end: string;
    desc: string;
  } | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  const loadWindows = async () => {
    if (!user) return;

    // Load user's own windows
    const { data } = await supabase
      .from("availability_windows")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week")
      .order("start_time");

    setWindows((data || []) as AvailabilityWindow[]);

    // Load friends — exclude muted ones (mute is bidirectional:
    // if either side muted the other, hide schedule windows for both)
    const { data: sent } = await supabase
      .from("friendships")
      .select("friend_id, is_muted")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    const { data: received } = await supabase
      .from("friendships")
      .select("user_id, is_muted")
      .eq("friend_id", user.id)
      .eq("status", "accepted");

    const friendIds = [
      ...(sent || []).filter((f) => !f.is_muted).map((f) => f.friend_id),
      ...(received || []).filter((f) => !f.is_muted).map((f) => f.user_id),
    ];

    if (friendIds.length > 0) {
      // Load friend profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds);
      setFriendProfiles((profiles || []) as Profile[]);

      // Load friends' availability windows
      const { data: fWindows } = await supabase
        .from("availability_windows")
        .select("*")
        .in("user_id", friendIds)
        .order("start_time");

      const profileMap = new Map(
        (profiles || []).map((p: Profile) => [p.id, p])
      );
      setFriendWindows(
        (fWindows || []).map((w: AvailabilityWindow) => ({
          ...w,
          friend: profileMap.get(w.user_id) as Profile | undefined,
        }))
      );
    }

    loadedOnce.current = true;
    setLoading(false);
  };

  useEffect(() => {
    loadWindows();
  }, [user?.id]);

  const addWindow = async (w: {
    day: number;
    start: string;
    end: string;
    desc: string;
  }) => {
    if (!user) return;
    const { error } = await supabase.from("availability_windows").insert({
      user_id: user.id,
      day_of_week: w.day,
      start_time: w.start,
      end_time: w.end,
      description: w.desc || null,
    });
    if (error) {
      feedbackError();
      toast("Failed to add window");
    } else {
      feedbackSuccess();
      toast("Availability added");
      setAddModal(null);
      loadWindows();
    }
  };

  const removeWindow = async (id: number) => {
    feedbackClick();
    const { error } = await supabase.from("availability_windows").delete().eq("id", id);
    if (error) { feedbackError(); toast("Failed to remove window"); return; }
    toast("Window removed");
    loadWindows();
  };

  const today = new Date().getDay();

  // Group user's windows by day
  const grouped: Record<number, AvailabilityWindow[]> = {};
  windows.forEach((w) => {
    (grouped[w.day_of_week] = grouped[w.day_of_week] || []).push(w);
  });

  // Group friends' windows by day
  const friendGrouped: Record<number, FriendWindow[]> = {};
  friendWindows.forEach((w) => {
    (friendGrouped[w.day_of_week] = friendGrouped[w.day_of_week] || []).push(w);
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Find overlaps for a given day: friend windows that overlap with any of user's windows.
  // For today, only count overlaps whose window hasn't already ended.
  const getOverlappingFriends = (dayIdx: number): FriendWindow[] => {
    const myWindows = grouped[dayIdx] || [];
    const theirWindows = friendGrouped[dayIdx] || [];
    if (myWindows.length === 0) return [];
    const isToday = dayIdx === today;

    return theirWindows.filter((fw) =>
      myWindows.some((mw) =>
        timesOverlap(mw.start_time, mw.end_time, fw.start_time, fw.end_time, isToday ? nowMinutes : undefined)
      )
    );
  };

  return (
    <div className="pb-24">
      <header className="app-header bg-white backdrop-blur-sm border-b border-gray-100/80 fixed left-0 right-0 z-30 flex flex-col overflow-visible" style={{ top: 0 }}>
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-[18px] h-[18px] text-callme" />
            <h1 className="font-display text-xl font-bold">Schedule</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFriends(!showFriends)}
              className={`px-3 py-2 rounded-[12px] text-[13px] font-semibold flex items-center gap-1.5 transition-all ${
                showFriends
                  ? "bg-blue-50 text-blue-600 border border-blue-200"
                  : "bg-gray-50 text-gray-400 border border-gray-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Friends
            </button>
            <button
              onClick={() =>
                setAddModal({
                  day: today,
                  start: "09:00",
                  end: "10:00",
                  desc: "",
                })
              }
              className="callme-gradient text-white px-4 py-2 rounded-[12px] text-[13px] font-semibold flex items-center gap-1.5 hover:shadow-md hover:shadow-callme/25 transition-all"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </header>

      <div style={{ height: "calc(env(safe-area-inset-top, 0px) + 56px)" }} />

      <main className="px-5 pt-5 flex flex-col gap-3">
        {/* Current time */}
        <div className="bg-white rounded-[18px] p-4 shadow-sm border border-gray-100 anim-fade-up flex items-center gap-2">
          <Clock className="w-4 h-4 text-callme" />
          <span className="font-medium text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            —{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Loading schedule...
          </div>
        ) : (
          // Show days starting from today, wrapping around the week
          Array.from({ length: 7 }, (_, i) => (today + i) % 7).map((dayIdx) => {
            const dayName = DAYS[dayIdx];
            const dayWindows = grouped[dayIdx] || [];
            const dayFriendWindows = friendGrouped[dayIdx] || [];
            const overlapping = getOverlappingFriends(dayIdx);
            const isToday = dayIdx === today;

            // Deduplicate overlapping friends for the match badge
            const overlappingFriendIds = Array.from(
              new Set(overlapping.map((fw) => fw.user_id))
            );

            return (
              <div
                key={dayIdx}
                className={`bg-white rounded-[18px] p-4 shadow-sm border transition-all ${
                  isToday
                    ? "border-callme border-2 anim-fade-up"
                    : "border-gray-100 anim-fade-up-1"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold text-sm ${
                        isToday ? "text-callme" : ""
                      }`}
                    >
                      {dayName}
                    </span>
                    {isToday && (
                      <span className="text-[11px] font-semibold bg-callme-50 text-callme px-2.5 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                    {showFriends && overlappingFriendIds.length > 0 && (
                      <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                        {overlappingFriendIds.length} match
                        {overlappingFriendIds.length > 1 ? "es" : ""}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setAddModal({
                        day: dayIdx,
                        start: "09:00",
                        end: "10:00",
                        desc: "",
                      })
                    }
                    className="text-xs text-gray-400 hover:text-callme font-medium transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {/* User's own windows */}
                {dayWindows.length === 0 ? (
                  <p className="text-xs text-gray-400">No availability set</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {dayWindows.map((w) => (
                      <div
                        key={w.id}
                        className="flex justify-between items-center px-3.5 py-2.5 rounded-[12px] bg-emerald-50 border border-emerald-200"
                      >
                        <div>
                          <span className="text-[13px] font-semibold text-emerald-800">
                            {formatTime12(w.start_time)} –{" "}
                            {formatTime12(w.end_time)}
                          </span>
                          {w.description && (
                            <span className="text-xs text-gray-500 ml-2">
                              {w.description}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeWindow(w.id)}
                          className="text-red-400 hover:text-red-600 p-3 -m-1 transition-colors"
                          aria-label="Remove window"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Friends' windows for this day */}
                {showFriends && dayFriendWindows.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Friends available
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {dayFriendWindows.map((fw) => {
                        const isOverlap =
                          dayWindows.length > 0 &&
                          dayWindows.some((mw) =>
                            timesOverlap(
                              mw.start_time,
                              mw.end_time,
                              fw.start_time,
                              fw.end_time,
                              isToday ? nowMinutes : undefined
                            )
                          );

                        return (
                          <div
                            key={fw.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-[12px] ${
                              isOverlap
                                ? "bg-blue-50 border border-blue-200"
                                : "bg-gray-50 border border-gray-100"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar
                                name={fw.friend?.display_name || "Friend"}
                                id={fw.user_id}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[12px] font-semibold truncate ${
                                      isOverlap
                                        ? "text-blue-800"
                                        : "text-gray-600"
                                    }`}
                                  >
                                    {fw.friend?.display_name || "Friend"}
                                  </span>
                                  {isOverlap && (
                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                      MATCH
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-[11px] ${
                                    isOverlap
                                      ? "text-blue-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {formatTime12(fw.start_time)} –{" "}
                                  {formatTime12(fw.end_time)}
                                  {fw.description && ` · ${fw.description}`}
                                </span>
                              </div>
                            </div>
                            {isOverlap && fw.friend?.phone_number && (
                              <a
                                href={`tel:${fw.friend.phone_number}`}
                                className="callme-gradient text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 hover:shadow-md hover:shadow-callme/25 transition-all"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Add Window — Bottom Sheet */}
      <BottomSheet open={!!addModal} onClose={() => { setAddModal(null); setTimeError(null); }}>
        <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2">
          <Clock className="w-5 h-5" /> Add Availability
        </h3>
        {addModal && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[13px] font-semibold mb-1.5 block">
                Day
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20"
                value={addModal.day}
                onChange={(e) =>
                  setAddModal({ ...addModal, day: +e.target.value })
                }
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block">
                  Start
                </label>
                <input
                  type="time"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20"
                  value={addModal.start}
                  onChange={(e) => {
                    setAddModal({ ...addModal, start: e.target.value });
                    setTimeError(null);
                  }}
                />
              </div>
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block">
                  End
                </label>
                <input
                  type="time"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20"
                  value={addModal.end}
                  onChange={(e) => {
                    setAddModal({ ...addModal, end: e.target.value });
                    setTimeError(null);
                  }}
                />
              </div>
            </div>
            {timeError && (
              <p className="text-sm text-red-500 font-medium -mt-1">{timeError}</p>
            )}
            <div>
              <label className="text-[13px] font-semibold mb-1.5 block">
                Note (optional)
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20"
                value={addModal.desc}
                onChange={(e) =>
                  setAddModal({ ...addModal, desc: e.target.value })
                }
                placeholder="e.g., Lunch break, Commute"
              />
            </div>

            {/* Preview */}
            <div className="bg-gray-50 p-3.5 rounded-[14px]">
              <p className="text-sm text-gray-600">
                <strong>Preview:</strong> {DAYS[addModal.day]},{" "}
                {formatTime12(addModal.start)} – {formatTime12(addModal.end)}
                {addModal.desc && ` · ${addModal.desc}`}
              </p>
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setAddModal(null)}
                className="px-5 py-2.5 text-sm border border-gray-200 rounded-[14px] text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (addModal.start >= addModal.end) {
                    setTimeError("End time must be after start time");
                    feedbackError();
                    return;
                  }
                  setTimeError(null);
                  addWindow(addModal);
                }}
                className="callme-gradient text-white px-5 py-2.5 rounded-[14px] text-sm font-semibold hover:shadow-md hover:shadow-callme/25 transition-all"
              >
                Add Availability
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
