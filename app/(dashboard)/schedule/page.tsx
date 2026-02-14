"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { useApp } from "../layout";
import { BottomSheet } from "@/app/_components/bottom-sheet";
import { Calendar, Clock, Plus, X } from "lucide-react";
import type { AvailabilityWindow } from "@/app/_lib/types";

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

export default function SchedulePage() {
  const { user, toast } = useApp();
  const supabase = createClient();

  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState<{
    day: number;
    start: string;
    end: string;
    desc: string;
  } | null>(null);

  const loadWindows = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("availability_windows")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week")
      .order("start_time");

    setWindows((data || []) as AvailabilityWindow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadWindows();
  }, [user]);

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
      toast("Failed to add window");
    } else {
      toast("Availability added ✅");
      setAddModal(null);
      loadWindows();
    }
  };

  const removeWindow = async (id: number) => {
    await supabase.from("availability_windows").delete().eq("id", id);
    toast("Window removed");
    loadWindows();
  };

  const today = new Date().getDay();

  // Group by day
  const grouped: Record<number, AvailabilityWindow[]> = {};
  windows.forEach((w) => {
    (grouped[w.day_of_week] = grouped[w.day_of_week] || []).push(w);
  });

  return (
    <div className="pb-24">
      <header className="bg-white border-b border-gray-100/80 sticky top-0 z-30 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-[18px] h-[18px] text-callme" />
          <h1 className="font-display text-xl font-bold">Schedule</h1>
        </div>
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
      </header>

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
          DAYS.map((dayName, dayIdx) => {
            const dayWindows = grouped[dayIdx] || [];
            const isToday = dayIdx === today;

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

                {dayWindows.length === 0 ? (
                  <p className="text-xs text-gray-300">No availability</p>
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
                          className="text-red-400 hover:text-red-600 p-1 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Add Window — Bottom Sheet */}
      <BottomSheet
        open={!!addModal}
        onClose={() => setAddModal(null)}
      >
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
                  onChange={(e) =>
                    setAddModal({ ...addModal, start: e.target.value })
                  }
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
                  onChange={(e) =>
                    setAddModal({ ...addModal, end: e.target.value })
                  }
                />
              </div>
            </div>
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
                {formatTime12(addModal.start)} –{" "}
                {formatTime12(addModal.end)}
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
                    return;
                  }
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
