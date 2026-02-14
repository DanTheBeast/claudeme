"use client";

import { Avatar } from "./avatar";
import { Phone, MessageCircle } from "lucide-react";
import type { Profile } from "@/app/_lib/types";

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
}: {
  friend: Profile;
  showCallLabel?: boolean;
}) {
  const phoneClean = friend.phone_number?.replace(/[^\d+]/g, "");

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-[18px] border transition-all hover:-translate-y-[1px] hover:shadow-sm ${
        friend.is_available
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-gray-100 bg-white"
      }`}
    >
      <Avatar
        name={friend.display_name}
        id={friend.id}
        src={friend.profile_picture}
        online={friend.is_available}
      />

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-sm truncate">
            {friend.display_name}
          </span>
          {/* Show relative time for offline, nothing for available */}
          {!friend.is_available && friend.last_seen && (
            <span className="text-[11px] text-gray-300 flex-shrink-0 ml-2">
              {relativeTime(friend.last_seen)}
            </span>
          )}
        </div>

        {friend.current_mood && (
          <div className="flex items-center gap-1 mt-1">
            <MessageCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span className="text-[12px] text-gray-500 truncate">
              {friend.current_mood}
            </span>
          </div>
        )}
      </div>

      {/* Call button — prominent with label for available, muted icon for offline */}
      {friend.is_available ? (
        showCallLabel ? (
          <a
            href={phoneClean ? `tel:${phoneClean}` : undefined}
            className="callme-gradient text-white px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 hover:shadow-md hover:shadow-callme/25 transition-all flex-shrink-0"
          >
            <Phone className="w-3.5 h-3.5" /> Call
          </a>
        ) : (
          <a
            href={phoneClean ? `tel:${phoneClean}` : undefined}
            className="w-10 h-10 callme-gradient rounded-full flex items-center justify-center flex-shrink-0 hover:shadow-md hover:shadow-callme/25 hover:scale-105 transition-all"
          >
            <Phone className="w-[17px] h-[17px] text-white" />
          </a>
        )
      ) : (
        <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Phone className="w-[15px] h-[15px] text-gray-300" />
        </div>
      )}
    </div>
  );
}
