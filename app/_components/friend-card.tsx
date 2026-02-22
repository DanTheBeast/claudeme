"use client";

import { Avatar } from "./avatar";
import { Phone, Sparkles, BellOff } from "lucide-react";
import type { Profile } from "@/app/_lib/types";
import { hapticMedium, hapticLight } from "@/app/_lib/haptics";

function relativeTime(d: string | Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const hours = Math.floor(ms / 3.6e6);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function FriendCard({
  friend,
  showCallLabel = false,
  isMuted = false,
  onPress,
}: {
  friend: Profile;
  showCallLabel?: boolean;
  isMuted?: boolean;
  onPress?: () => void;
}) {
  const phoneClean = friend.phone_number?.replace(/[^\d+]/g, "");

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-[18px] border transition-all hover:-translate-y-[1px] hover:shadow-sm ${
        isMuted
          ? "border-gray-100 bg-gray-50/60 opacity-70"
          : friend.is_available
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-gray-100 bg-white"
      }`}
    >
      {/* Tappable area: avatar + name */}
      <button
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        onClick={() => { hapticLight(); onPress?.(); }}
      >
        <Avatar
          name={friend.display_name}
          id={friend.id}
          src={friend.profile_picture}
          online={!isMuted && friend.is_available}
        />

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center gap-2">
            <span className="font-semibold text-sm truncate">
              {friend.display_name}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isMuted && (
                <BellOff className="w-3 h-3 text-gray-400" />
              )}
              {!isMuted && !friend.is_available && friend.last_seen && (
                <span className="text-[11px] text-gray-300">
                  {relativeTime(friend.last_seen)}
                </span>
              )}
            </div>
          </div>

          {!isMuted && friend.current_mood && (
            <div className="flex items-center gap-1 mt-1">
              <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[12px] text-gray-500 truncate italic">
                {friend.current_mood}
              </span>
            </div>
          )}
          {isMuted && (
            <span className="text-[11px] text-gray-400 mt-0.5 block">Muted</span>
          )}
        </div>
      </button>

      {/* Call button — suppressed when muted */}
      {!isMuted && phoneClean ? (
        friend.is_available ? (
          showCallLabel ? (
            <a
              href={`tel:${phoneClean}`}
              onClick={() => hapticMedium()}
              className="callme-gradient text-white px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 hover:shadow-md hover:shadow-callme/25 transition-all flex-shrink-0"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          ) : (
            <a
              href={`tel:${phoneClean}`}
              onClick={() => hapticMedium()}
              className="w-10 h-10 callme-gradient rounded-full flex items-center justify-center flex-shrink-0 hover:shadow-md hover:shadow-callme/25 hover:scale-105 transition-all"
            >
              <Phone className="w-[17px] h-[17px] text-white" />
            </a>
          )
        ) : (
          <a
            href={`tel:${phoneClean}`}
            onClick={() => hapticMedium()}
            className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition-all"
          >
            <Phone className="w-[15px] h-[15px] text-gray-400" />
          </a>
        )
      ) : (
        !isMuted && (
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Phone className="w-[15px] h-[15px] text-gray-300" />
          </div>
        )
      )}
    </div>
  );
}
