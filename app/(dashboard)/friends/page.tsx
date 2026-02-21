"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { useApp } from "../layout";
import { feedbackFriendAdded, feedbackSuccess, feedbackError, feedbackClick } from "@/app/_lib/haptics";
import { Avatar } from "@/app/_components/avatar";
import { FriendCard } from "@/app/_components/friend-card";
import { BottomSheet } from "@/app/_components/bottom-sheet";
import {
  Plus,
  Search,
  UserPlus,
  X,
  Users,
  Check,
  Share2,
  MessageCircle,
} from "lucide-react";
import type { Profile, FriendWithProfile, Friendship } from "@/app/_lib/types";

export default function FriendsPage() {
  const { user, toast } = useApp();
  const supabase = createClient();

  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<
    (Friendship & { requester?: Profile })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const loadData = async () => {
    if (!user) return;

    console.log("[CallMe] loadData for user:", user.id, user.email);

    // Check all friendships regardless of status
    const { data: debugFriendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    console.log("[CallMe] all friendships for user:", JSON.stringify(debugFriendships));

    const { data: sent, error: sentError } = await supabase
      .from("friendships")
      .select("id, status, friend_id")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    console.log("[CallMe] sent friendships:", sent?.length, sentError?.message);

    const { data: received, error: receivedError } = await supabase
      .from("friendships")
      .select("id, status, user_id")
      .eq("friend_id", user.id)
      .eq("status", "accepted");

    console.log("[CallMe] received friendships:", received?.length, receivedError?.message);

    const friendIds = [
      ...(sent || []).map((f) => f.friend_id),
      ...(received || []).map((f) => f.user_id),
    ];

    let profiles: Profile[] = [];
    if (friendIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds);
      profiles = (data || []) as Profile[];
    }

    const allFriendships = [...(sent || []), ...(received || [])];
    setFriends(
      profiles.map((p) => {
        const fs = allFriendships.find(
          (f) =>
            ("friend_id" in f && f.friend_id === p.id) ||
            ("user_id" in f && f.user_id === p.id)
        );
        return { id: fs?.id || 0, status: "accepted", friend: p };
      })
    );

    // Load pending incoming requests
    const { data: incoming } = await supabase
      .from("friendships")
      .select("*")
      .eq("friend_id", user.id)
      .eq("status", "pending");

    if (incoming && incoming.length > 0) {
      const requesterIds = incoming.map((r) => r.user_id);
      const { data: requesterProfiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", requesterIds);

      setPendingRequests(
        incoming.map((r) => ({
          ...r,
          requester: (requesterProfiles || []).find(
            (p) => p.id === r.user_id
          ) as Profile | undefined,
        }))
      );
    } else {
      setPendingRequests([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(
          `display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
        )
        .neq("id", user?.id || "")
        .limit(10);
      setSearchResults((data || []) as Profile[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sendFriendRequest = async (recipientId: string) => {
    if (!user) return;
    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: recipientId,
      status: "pending",
    });
    if (error) {
      feedbackError();
      toast("Failed to send request — maybe already sent?");
    } else {
      feedbackFriendAdded();
      toast("Friend request sent! 🎉");
      setShowAdd(false);
      setSearchQuery("");
      loadData();
    }
  };

  const acceptRequest = async (requestId: number) => {
    feedbackSuccess();
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", requestId);
    toast("Friend request accepted! 🤝");
    loadData();
  };

  const declineRequest = async (requestId: number) => {
    feedbackClick();
    await supabase.from("friendships").delete().eq("id", requestId);
    toast("Request declined");
    loadData();
  };

  const inviteFriends = async () => {
    const inviteUrl = `${window.location.origin}/auth`;
    const inviteText = `Hey! I'm using CallMe to stay in touch with the people who matter. Join me so we can actually talk — no algorithms, no ads.\n\n${inviteUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on CallMe",
          text: inviteText,
        });
      } catch (err: unknown) {
        // User cancelled the share sheet — not an error
        if (err instanceof Error && err.name !== "AbortError") {
          toast("Couldn't share — try copying the link instead");
        }
      }
    } else {
      // Fallback: open SMS compose with pre-filled message
      const smsBody = encodeURIComponent(inviteText);
      window.open(`sms:?&body=${smsBody}`, "_self");
    }
  };

  const available = friends.filter((f) => f.friend.is_available);
  const offline = friends.filter((f) => !f.friend.is_available);

  return (
    <div className="pb-24">
      <header className="app-header bg-white backdrop-blur-sm border-b border-gray-100/80 fixed left-0 right-0 z-30 flex flex-col max-w-md mx-auto relative overflow-visible" style={{ top: 0 }}>
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="px-5 py-3.5 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Friends</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={inviteFriends}
              className="text-callme border border-callme/20 px-3 py-2 rounded-[12px] text-[13px] font-semibold flex items-center gap-1.5 hover:bg-callme-50 transition-all"
            >
              <Share2 className="w-4 h-4" /> Invite
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="callme-gradient text-white px-4 py-2 rounded-[12px] text-[13px] font-semibold flex items-center gap-1.5 hover:shadow-md hover:shadow-callme/25 transition-all"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </header>

      {/* Spacer matching header height: safe-area + 56px */}
      <div style={{ height: "calc(env(safe-area-inset-top, 0px) + 56px)" }} />

      <main className="px-5 pt-5 flex flex-col gap-5">
        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-white rounded-[22px] p-5 shadow-sm border border-amber-200 anim-fade-up">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-callme" />
              <h3 className="font-semibold text-[15px]">
                Friend Requests ({pendingRequests.length})
              </h3>
            </div>
            <div className="flex flex-col gap-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-[14px]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={req.requester?.display_name || "User"}
                      id={req.user_id}
                    />
                    <div>
                      <p className="font-medium text-sm">
                        {req.requester?.display_name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400">
                        @{req.requester?.username || "user"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(req.id)}
                      className="callme-gradient text-white w-8 h-8 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => declineRequest(req.id)}
                      className="bg-gray-100 text-gray-500 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available */}
        {available.length > 0 && (
          <div className="anim-fade-up">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
              <h2 className="text-[15px] font-semibold">
                Available ({available.length})
              </h2>
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

        {/* Offline */}
        {offline.length > 0 && (
          <div className="anim-fade-up-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
              <h2 className="text-[15px] font-semibold">
                Offline ({offline.length})
              </h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {offline.map((f) => (
                <FriendCard key={f.id} friend={f.friend} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && friends.length === 0 && pendingRequests.length === 0 && (
          <div className="bg-white rounded-[22px] p-10 shadow-sm border border-gray-100 text-center anim-fade-up">
            <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-callme-50 to-orange-50 flex items-center justify-center mx-auto mb-5">
              <Users className="w-12 h-12 text-callme/40" />
            </div>
            <h3 className="font-display text-xl font-bold mb-1.5">
              Your people go here
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-[260px] mx-auto">
              Add the friends and family you actually want to talk to
              — not the whole internet.
            </p>
            <div className="flex flex-col gap-2.5 items-center">
              <button
                onClick={() => setShowAdd(true)}
                className="callme-gradient text-white px-6 py-3 rounded-[14px] text-sm font-semibold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-callme/25 transition-all"
              >
                <Search className="w-4 h-4" /> Find Friends
              </button>
              <button
                onClick={inviteFriends}
                className="text-callme px-6 py-3 rounded-[14px] text-sm font-semibold inline-flex items-center gap-2 border border-callme/20 hover:bg-callme-50 transition-all"
              >
                <MessageCircle className="w-4 h-4" /> Invite Friends
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Add Friend — Bottom Sheet */}
      <BottomSheet open={showAdd} onClose={() => setShowAdd(false)}>
        <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2">
          <Search className="w-5 h-5" /> Find Friends
        </h3>

        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, username, or email..."
            autoFocus
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme bg-gray-50/50"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {searchQuery.length < 2 ? (
            <div className="text-center py-8">
              <Search className="w-7 h-7 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                Type at least 2 characters to search
              </p>
            </div>
          ) : searching ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-callme border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">Searching...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No users found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-[14px]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={p.display_name} id={p.id} size="sm" />
                    <div>
                      <p className="font-medium text-sm">
                        {p.display_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        @{p.username}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(p.id)}
                    className="callme-gradient text-white px-3.5 py-1.5 rounded-[10px] text-xs font-semibold flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Friends section */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          <button
            onClick={inviteFriends}
            className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-callme-50 to-orange-50 rounded-[16px] border border-callme/10 hover:border-callme/25 transition-all group"
          >
            <div className="w-10 h-10 rounded-full callme-gradient flex items-center justify-center flex-shrink-0 group-hover:shadow-md group-hover:shadow-callme/25 transition-all">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Invite Friends</p>
              <p className="text-xs text-gray-500">
                Text a link to people in your contacts
              </p>
            </div>
            <Share2 className="w-4 h-4 text-gray-400 ml-auto" />
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
