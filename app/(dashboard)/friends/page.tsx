"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/app/_lib/supabase-browser";
import { cacheRead, cacheWrite, withTimeout, savePendingInviteCode, markInviteCodeAsSynced } from "@/app/_lib/cache";
import { logInviteCodeEvent } from "@/app/_lib/invite-code-monitor";
import { useApp } from "../layout";
import { feedbackFriendAdded, feedbackSuccess, feedbackError, feedbackClick } from "@/app/_lib/haptics";
import { Avatar } from "@/app/_components/avatar";
import { FriendCard } from "@/app/_components/friend-card";
import { BottomSheet } from "@/app/_components/bottom-sheet";
import {
   UserPlus,
   UserMinus,
   X,
   Users,
   Check,
   BellOff,
   Bell,
   Phone,
   Share2,
 } from "lucide-react";
import { Share } from "@capacitor/share";
import type { Profile, FriendWithProfile, Friendship } from "@/app/_lib/types";

// Validate invite code format (8 chars from valid charset)
const isValidCodeFormat = (code: string): boolean => {
  const validChars = /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/;
  return validChars.test(code);
};

export default function FriendsPage() {
   const { user, toast, refreshUser, refreshKey, pendingInviteFrom, clearPendingInvite } = useApp();
   
   // Type guard: ensure user is authenticated
   if (!user || !user.id) {
     return <div className="flex items-center justify-center h-screen">Loading...</div>;
   }
   // Stable client — avoids a new instance on every render
   const supabase = useMemo(() => createClient(), []);

   const [friends, setFriends] = useState<FriendWithProfile[]>([]);
   const [pendingRequests, setPendingRequests] = useState<
     (Friendship & { requester?: Profile })[]
   >([]);
   const [outgoingRequests, setOutgoingRequests] = useState<
     (Friendship & { recipient?: Profile })[]
   >([]);
   const [loading, setLoading] = useState(true);
   const [selectedFriend, setSelectedFriend] = useState<FriendWithProfile | null>(null);
   const [confirmRemove, setConfirmRemove] = useState(false);
   const [sendingInviteRequest, setSendingInviteRequest] = useState(false);
   // Track which request action is currently in progress to prevent double-clicks
   const [pendingActionId, setPendingActionId] = useState<number | null>(null);
   // Guard against state updates on unmounted component — prevents memory leaks
   // and React warnings when rapidly switching between pages
    const isMounted = useRef(true);
    
     // Add Friends modal state
     const [showAddFriendsModal, setShowAddFriendsModal] = useState(false);
     const [inviteCodeInput, setInviteCodeInput] = useState("");
     const [inviteCodeInputRaw, setInviteCodeInputRaw] = useState("");
     const [redeemingCode, setRedeemingCode] = useState(false);
     const [lastCodeGeneratedTime, setLastCodeGeneratedTime] = useState<number>(0);
     const [sharingCode, setSharingCode] = useState(false);
     const [isTyping, setIsTyping] = useState(false);
     const inviteInputDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    




  const loadData = async () => {
    if (!user) return;
    try {

    const { data: sent, error: sentError } = await withTimeout(supabase
      .from("friendships")
      .select("id, status, friend_id, is_muted")
      .eq("user_id", user.id)
      .eq("status", "accepted"));

    const { data: received, error: receivedError } = await withTimeout(supabase
      .from("friendships")
      .select("id, status, user_id, is_muted")
      .eq("friend_id", user.id)
      .eq("status", "accepted"));

    if (sentError || receivedError) {
      // Don't wipe existing data on re-fetch failure (e.g. session mid-refresh)
      return;
    }

    const friendEntries = [
      ...(sent || []).map((f) => ({ friendshipId: f.id, friendId: f.friend_id, is_muted: f.is_muted ?? false })),
      ...(received || []).map((f) => ({ friendshipId: f.id, friendId: f.user_id, is_muted: f.is_muted ?? false })),
    ];

    // Always start from empty arrays — never fall back to stale closure state.
    // If a sub-query fails we simply don't update that slice of state, which
    // preserves whatever was last successfully loaded rather than reverting to
    // an earlier snapshot from when this closure was created.
    let newFriends: FriendWithProfile[] | null = null;
    let newPending: (Friendship & { requester?: Profile })[] | null = null;
    let newOutgoing: (Friendship & { recipient?: Profile })[] | null = null;

    if (friendEntries.length > 0) {
      const { data, error: profilesErr } = await withTimeout(supabase
        .from("profiles")
        .select("*")
        .in("id", friendEntries.map((e) => e.friendId)));

      if (!profilesErr) {
        const profiles = (data || []) as Profile[];
        newFriends = profiles.map((p) => {
          const entry = friendEntries.find((e) => e.friendId === p.id);
          return {
            id: entry?.friendshipId || 0,
            status: "accepted",
            is_muted: entry?.is_muted ?? false,
            friend: p,
          };
        });
      }
    } else {
      newFriends = [];
    }

    // Pending incoming requests
    const { data: incoming, error: incomingErr } = await withTimeout(supabase
      .from("friendships")
      .select("*")
      .eq("friend_id", user.id)
      .eq("status", "pending"));

    if (!incomingErr) {
      if (incoming && incoming.length > 0) {
        const requesterIds = incoming.map((r) => r.user_id);
        const { data: requesterProfiles } = await withTimeout(supabase
          .from("profiles")
          .select("*")
          .in("id", requesterIds));
        newPending = incoming.map((r) => ({
          ...r,
          is_muted: r.is_muted ?? false,
          requester: (requesterProfiles || []).find((p) => p.id === r.user_id) as Profile | undefined,
        }));
      } else {
        newPending = [];
      }
    }

    // Pending outgoing requests sent by current user
    const { data: outgoing, error: outgoingErr } = await withTimeout(supabase
      .from("friendships")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending"));

    if (!outgoingErr) {
      if (outgoing && outgoing.length > 0) {
        const recipientIds = outgoing.map((r) => r.friend_id);
        const { data: recipientProfiles } = await withTimeout(supabase
          .from("profiles")
          .select("*")
          .in("id", recipientIds));
        newOutgoing = outgoing.map((r) => ({
          ...r,
          is_muted: r.is_muted ?? false,
          recipient: (recipientProfiles || []).find((p) => p.id === r.friend_id) as Profile | undefined,
        }));
      } else {
        newOutgoing = [];
      }
    }

     // Guard against state updates on unmounted component
     if (!isMounted.current) return;

     // Only update state slices that actually loaded successfully — never
     // overwrite good data with null on a partial failure.
     if (newFriends !== null) setFriends(newFriends);
     if (newPending !== null) setPendingRequests(newPending);
     if (newOutgoing !== null) setOutgoingRequests(newOutgoing);

     // Write cache with whatever we have — use functional reads to get current state
     // rather than stale closure values.
     if (newFriends !== null && newPending !== null && newOutgoing !== null) {
       cacheWrite("friends_page", user.id, { friends: newFriends, pending: newPending, outgoing: newOutgoing });
     }
     } catch {
       // Network timeout or unexpected error — don't wipe existing data
     } finally {
       if (isMounted.current) setLoading(false);
     }
   };

   useEffect(() => {
     if (!user) return;
     // Mark component as mounted for the entire lifecycle
     isMounted.current = true;
    // Seed from cache immediately so there's no skeleton on resume
    type FriendsCache = {
      friends: FriendWithProfile[];
      pending: (Friendship & { requester?: Profile })[];
      outgoing: (Friendship & { recipient?: Profile })[];
    };
    const cached = cacheRead<FriendsCache>("friends_page", user.id);
    if (cached && loading) {
      setFriends(cached.friends);
      setPendingRequests(cached.pending);
      setOutgoingRequests(cached.outgoing);
      setLoading(false);
    }
    loadData();

     // Debounce Realtime updates to avoid hammering the database with concurrent queries
     // Use 500ms instead of 1s to feel more responsive when friends accept requests
     let reloadTimer: ReturnType<typeof setTimeout> | null = null;
     const debouncedReload = () => {
       if (reloadTimer) clearTimeout(reloadTimer);
       reloadTimer = setTimeout(() => {
         if (isMounted.current) {
           console.log("[CallMe] Realtime: reloading friend data after change");
           loadData();
         }
       }, 500); // Wait 500ms after last change before reloading (was 1s)
     };

      // Subscribe to real-time friend request updates
      const channel = supabase
        .channel(`friends-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friendships",
            filter: `or(user_id.eq.${user.id},friend_id.eq.${user.id})`,
          },
           (payload) => {
            // Any change to friendships (incoming or outgoing) - debounce the reload
            // Skip if user is actively typing in the invite code field to avoid UI freezes
            if (isTyping) {
              console.log("[CallMe] Realtime: skipping update while user is typing");
              return;
            }
            console.log("[CallMe] Realtime: friendship change detected", payload.eventType, {
              new: payload.new,
              old: payload.old,
            });
            debouncedReload();
          }
       )
       .subscribe();

    // Cleanup: unsubscribe and mark component as unmounted
    return () => {
      isMounted.current = false;
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
    }, [user?.id, refreshKey]);

  // Debounced search — only shows users who allow friend requests,
  // and filters out people already friended or with a pending request.


    const acceptRequest = async (requestId: number) => {
      if (pendingActionId) return; // prevent double-click
      setPendingActionId(requestId);
      feedbackSuccess();
      // Optimistic update: remove from pending immediately, reload on success
      const originalPending = pendingRequests;
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

      const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", requestId);
      if (error) {
        // Revert optimistic update on failure
        setPendingRequests(originalPending);
        feedbackError();
        toast("Failed to accept request");
        setPendingActionId(null);
        return;
      }
      toast("Friend request accepted! 🤝");
      // Small delay to ensure database replication is complete before reloading
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadData(); // reload full data to update friends list and counts
      refreshUser(); // refreshes pending badge count
      setPendingActionId(null);
    };

     const cancelRequest = async (requestId: number) => {
       if (pendingActionId) return; // prevent double-click
       setPendingActionId(requestId);
       feedbackClick();
       // Optimistic update: remove from outgoing immediately
       const originalOutgoing = outgoingRequests;
       setOutgoingRequests((prev) => prev.filter((r) => r.id !== requestId));

       const { error } = await supabase.from("friendships").delete().eq("id", requestId);
       if (error) {
         // Revert optimistic update on failure
         setOutgoingRequests(originalOutgoing);
         feedbackError();
         toast("Failed to cancel request");
         setPendingActionId(null);
         return;
       }
       toast("Request cancelled");
       // Small delay to ensure database replication is complete before reloading
       await new Promise(resolve => setTimeout(resolve, 100));
       await loadData();
       setPendingActionId(null);
     };

     const declineRequest = async (requestId: number) => {
       if (pendingActionId) return; // prevent double-click
       setPendingActionId(requestId);
       feedbackClick();
       // Optimistic update: remove from pending immediately
       const originalPending = pendingRequests;
       setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

       const { error } = await supabase.from("friendships").delete().eq("id", requestId);
       if (error) {
         // Revert optimistic update on failure
         setPendingRequests(originalPending);
         feedbackError();
         toast("Failed to decline request");
         setPendingActionId(null);
         return;
       }
       toast("Request declined");
       // Small delay to ensure database replication is complete before reloading
       await new Promise(resolve => setTimeout(resolve, 100));
       await loadData(); // Ensure data is fresh after decline
       refreshUser(); // refreshes pending badge count
       setPendingActionId(null);
     };

  // Called when the app is opened via a callme://invite?code=... deep link,
  // or when a user enters a code manually. Routes through the redeem-invite-code
  // Edge Function which validates the code and creates the friend request.
   const redeemInviteCode = async (codeOrUsername: string) => {
     if (!user) return;
     
     // Guard against double-click by checking state first
     if (redeemingCode || sendingInviteRequest) {
       console.log("[CallMe] redeem already in progress, ignoring duplicate call");
       return;
     }
     
     setSendingInviteRequest(true);
     try {
       console.log("[CallMe] redeemInviteCode called with code:", codeOrUsername);
       const code = codeOrUsername.trim().toLowerCase();
       
       // Step 1: Look up the invite code WITH TIMEOUT
       console.log("[CallMe] looking up invite code:", code);
       const { data: invite, error: lookupErr } = await withTimeout(supabase
         .from("invite_codes")
         .select("code, inviter_id, inviter_username, used_by")
         .eq("code", code)
         .maybeSingle(), 10000);
       
       if (lookupErr) {
         console.error("[CallMe] invite code lookup failed:", lookupErr);
         toast("Failed to lookup code — try again");
         return;
       }
       
       if (!invite) {
         console.log("[CallMe] code not found:", code);
         toast("Code not found — double-check and try again");
         return;
       }
       
       console.log("[CallMe] code found:", { code, inviter_id: invite.inviter_id });
       
       // Can't redeem your own code
       if (invite.inviter_id === user.id) {
         toast("That's your own invite code!");
         return;
       }
       
       // If already used by someone else, reject
       if (invite.used_by && invite.used_by !== user.id) {
         toast("This code has already been used");
         return;
       }
       
       // Step 2: Check if friendship already exists WITH TIMEOUT
       console.log("[CallMe] checking for existing friendship");
       const { data: existing, error: friendshipCheckErr } = await withTimeout(supabase
         .from("friendships")
         .select("id, status")
         .or(`and(user_id.eq.${user.id},friend_id.eq.${invite.inviter_id}),and(user_id.eq.${invite.inviter_id},friend_id.eq.${user.id})`)
         .maybeSingle(), 10000);
       
       if (friendshipCheckErr) {
         console.error("[CallMe] friendship check failed:", friendshipCheckErr);
         toast("Failed to check friendship — try again");
         return;
       }
       
       // Step 3: Create friendship if it doesn't exist WITH TIMEOUT
       if (!existing) {
         console.log("[CallMe] creating friendship");
         const { error: createErr } = await withTimeout(supabase
           .from("friendships")
           .insert({
             user_id: user.id,
             friend_id: invite.inviter_id,
             status: "pending",
           }), 10000);
         
         if (createErr) {
           console.error("[CallMe] friendship creation failed:", createErr);
           // If it's a duplicate key error, that's OK (idempotent)
           if (!createErr.message?.includes("duplicate")) {
             toast("Failed to send friend request — try again");
             return;
           }
         }
       }
       
       // Step 4: Mark code as used WITH TIMEOUT
       console.log("[CallMe] marking code as used");
       const { error: updateErr } = await withTimeout(supabase
         .from("invite_codes")
         .update({ used_by: user.id, used_at: new Date().toISOString() })
         .eq("code", code), 10000);
       
       if (updateErr) {
         console.error("[CallMe] failed to mark code as used:", updateErr);
         // Don't fail the whole thing if marking as used fails
       }
       
       // Success!
       console.log("[CallMe] redemption successful");
       if (existing?.status === "accepted") {
         toast(`You're already friends with @${invite.inviter_username}!`);
       } else {
         feedbackFriendAdded();
         toast(`Friend request sent to @${invite.inviter_username}! 🎉`);
       }
       clearPendingInvite();
       loadData();
     } catch (err) {
       console.error("[CallMe] redeem error:", err);
       if (err instanceof Error && err.message.includes("timed out")) {
         toast("Request timed out — check your connection and try again");
       } else {
         toast("Something went wrong — check your connection and try again");
       }
     } finally {
       setSendingInviteRequest(false);
     }
   };

  const removeFriend = async (friendshipId: number, name: string) => {
    feedbackClick();
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) { feedbackError(); toast("Failed to remove friend"); return; }
    setSelectedFriend(null);
    setConfirmRemove(false);
    toast(`${name} removed`);
    loadData();
  };

  const toggleMute = async (friendshipId: number, currentlyMuted: boolean, name: string) => {
    feedbackClick();
    const { error } = await supabase
      .from("friendships")
      .update({ is_muted: !currentlyMuted })
      .eq("id", friendshipId);
    if (error) { feedbackError(); toast("Failed to update mute setting"); return; }
    // Update local state immediately for snappy UI
    setFriends((prev) =>
      prev.map((f) =>
        f.id === friendshipId ? { ...f, is_muted: !currentlyMuted } : f
      )
    );
    if (selectedFriend?.id === friendshipId) {
      setSelectedFriend((prev) => prev ? { ...prev, is_muted: !currentlyMuted } : null);
    }
    toast(currentlyMuted ? `${name} unmuted` : `${name} muted — you won't see each other's availability`);
  };

   const [friendFilter, setFriendFilter] = useState("");

   // Memoize filtered friends to avoid re-filtering on every render
   // Only recompute when friendFilter or friends list actually changes
   const filteredFriends = useMemo(() => {
     if (!friendFilter.trim()) return friends;
     const lowerFilter = friendFilter.toLowerCase();
     return friends.filter((f) =>
       f.friend.display_name?.toLowerCase().includes(lowerFilter) ||
       f.friend.username?.toLowerCase().includes(lowerFilter)
     );
   }, [friendFilter, friends]);

   // Memoize categorized friends lists
   const available = useMemo(() => filteredFriends.filter((f) => !f.is_muted && f.friend.is_available), [filteredFriends]);
   const offline = useMemo(() => filteredFriends.filter((f) => !f.is_muted && !f.friend.is_available), [filteredFriends]);
    const muted = useMemo(() => filteredFriends.filter((f) => f.is_muted), [filteredFriends]);



   return (
     <div className="pb-24">
       <header className="app-header bg-white backdrop-blur-sm border-b border-gray-100/80 fixed left-0 right-0 z-30 flex flex-col overflow-visible" style={{ top: 0 }}>
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="px-5 py-3.5 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Friends</h1>
          <button
            onClick={() => setShowAddFriendsModal(true)}
            className="callme-gradient text-white px-4 py-2 rounded-[10px] text-sm font-semibold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-callme/25 transition-all"
            title="Add Friends"
          >
            <UserPlus className="w-4 h-4" /> Add Friends
          </button>
        </div>
      </header>

      <div style={{ height: "calc(env(safe-area-inset-top, 0px) + 56px)" }} />

      <main className="px-5 pt-5 flex flex-col gap-5">
        {/* Filter bar — only shown when there are enough friends to warrant filtering */}
        {friends.length > 4 && (
          <div className="relative">
            <input
              type="text"
              value={friendFilter}
              onChange={(e) => setFriendFilter(e.target.value)}
              placeholder="Filter friends..."
              className="w-full pl-4 pr-9 py-2.5 bg-white border border-gray-200 rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme transition-all"
            />
            {friendFilter && (
              <button
                onClick={() => setFriendFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Invite deep link banner — shown when app was opened via a personal invite link */}
        {pendingInviteFrom && (
          <div className="bg-callme-50 border border-callme/20 rounded-[18px] p-4 anim-fade-up flex items-center gap-3">
            <div className="w-10 h-10 rounded-full callme-gradient flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">@{pendingInviteFrom} invited you</p>
              <p className="text-xs text-gray-500 mt-0.5">Send them a friend request to connect</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={clearPendingInvite}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => redeemInviteCode(pendingInviteFrom)}
                disabled={sendingInviteRequest}
                className="callme-gradient text-white px-3.5 py-1.5 rounded-[10px] text-xs font-semibold disabled:opacity-60 flex items-center gap-1.5"
              >
                {sendingInviteRequest
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-3 h-3" />}
                {sendingInviteRequest ? "Sending…" : "Add"}
              </button>
            </div>
          </div>
        )}

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
                <div key={req.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-[14px]">
                  <div className="flex items-center gap-3">
                    <Avatar name={req.requester?.display_name || "User"} id={req.user_id} src={req.requester?.profile_picture} />
                    <div>
                      <p className="font-medium text-sm">{req.requester?.display_name || "Unknown"}</p>
                      <p className="text-xs text-gray-400">@{req.requester?.username || "user"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptRequest(req.id)} aria-label={`Accept friend request from ${req.requester?.display_name || 'User'}`} className="callme-gradient text-white w-11 h-11 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => declineRequest(req.id)} aria-label={`Decline friend request from ${req.requester?.display_name || 'User'}`} className="bg-gray-100 text-gray-500 w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing pending requests */}
        {outgoingRequests.length > 0 && (
          <div className="bg-white rounded-[22px] p-5 shadow-sm border border-gray-200 anim-fade-up">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-[15px] text-gray-600">
                Sent Requests ({outgoingRequests.length})
              </h3>
            </div>
            <div className="flex flex-col gap-3">
              {outgoingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-[14px]">
                  <div className="flex items-center gap-3">
                    <Avatar name={req.recipient?.display_name || "User"} id={req.friend_id} src={req.recipient?.profile_picture} />
                    <div>
                      <p className="font-medium text-sm">{req.recipient?.display_name || "Unknown"}</p>
                      <p className="text-xs text-gray-400">@{req.recipient?.username || "user"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelRequest(req.id)}
                    aria-label={`Cancel friend request to ${req.recipient?.display_name || 'User'}`}
                    className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-[10px] hover:bg-gray-50 hover:text-red-500 hover:border-red-200 transition-colors"
                  >
                    Cancel
                  </button>
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
              <h2 className="text-[15px] font-semibold">Available ({available.length})</h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {available.map((f) => (
                  <FriendCard
                  key={f.id}
                  friend={f.friend}
                  showCallLabel
                  isMuted={false}
                  onPress={() => { setConfirmRemove(false); setSelectedFriend(f); }}
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
              <h2 className="text-[15px] font-semibold">Offline ({offline.length})</h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {offline.map((f) => (
                <FriendCard
                  key={f.id}
                  friend={f.friend}
                  isMuted={false}
                  onPress={() => { setConfirmRemove(false); setSelectedFriend(f); }}
                  onOfflineCall={() => toast("They're not marked available — giving it a shot!")}
                />
              ))}
            </div>
          </div>
        )}

        {/* Muted */}
        {muted.length > 0 && (
          <div className="anim-fade-up-2">
            <div className="flex items-center gap-2 mb-3">
              <BellOff className="w-3.5 h-3.5 text-gray-400" />
              <h2 className="text-[15px] font-semibold text-gray-400">Muted ({muted.length})</h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {muted.map((f) => (
                <FriendCard
                  key={f.id}
                  friend={f.friend}
                  isMuted
                  onPress={() => { setConfirmRemove(false); setSelectedFriend(f); }}
                />
              ))}
            </div>
          </div>
        )}

        {/* No filter results */}
        {friendFilter.trim() && available.length === 0 && offline.length === 0 && muted.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No friends matching &ldquo;{friendFilter}&rdquo;
          </div>
        )}

        {/* Empty state */}
        {!loading && friends.length === 0 && pendingRequests.length === 0 && outgoingRequests.length === 0 && (
          <div className="bg-white rounded-[22px] p-10 shadow-sm border border-gray-100 text-center anim-fade-up">
            <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-callme-50 to-orange-50 flex items-center justify-center mx-auto mb-5">
              <Users className="w-12 h-12 text-callme/40" />
            </div>
            <h3 className="font-display text-xl font-bold mb-1.5">Your people go here</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-[260px] mx-auto">
              Add the friends and family you actually want to talk to — not the whole internet.
            </p>
            <div className="flex flex-col gap-2.5 items-center">

            </div>
          </div>
        )}
      </main>

            {/* "Add Friends" modal */}
      {showAddFriendsModal && (
        <div
          className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-[4px] flex items-end justify-center"
          onClick={() => setShowAddFriendsModal(false)}
        >
          <div
            className="bg-white rounded-t-[28px] w-full max-w-md px-6 pt-3 pb-10 anim-slide-up"
            style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-gray-200 mx-auto mb-6" />
            <h3 className="font-display text-xl font-bold mb-1">Add Friends</h3>
            
            {/* Enter invite code section */}
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-3 leading-relaxed">
                Enter a code from someone you want to be friends with:
              </p>
              
                {/* Code input */}
                   <input
                     type="text"
                     value={inviteCodeInput}
                     onChange={(e) => {
                       const input = e.target.value.toLowerCase().trim();
                       setInviteCodeInputRaw(input);
                       setIsTyping(true);
                       
                       // Extract 8-char code immediately for display
                       const codeMatch = input.match(/[23456789abcdefghjkmnpqrstuvwxyz]{8}/);
                       const extracted = codeMatch ? codeMatch[0] : input.slice(0, 8);
                       setInviteCodeInput(extracted);
                       
                       // Debounce the realtime pause so it resets quickly after typing stops
                       if (inviteInputDebounceTimer.current) clearTimeout(inviteInputDebounceTimer.current);
                       inviteInputDebounceTimer.current = setTimeout(() => {
                         setIsTyping(false);
                       }, 300); // Pause realtime for 300ms after typing stops
                     }}
                     placeholder="Paste or type the invite code"
                     autoCorrect="off"
                     autoCapitalize="none"
                     className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-base font-mono bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20 focus:border-callme mb-3"
                   />
              
              {/* Redeem button */}
               <button
                 disabled={inviteCodeInput.length < 4 || redeemingCode}
                 onClick={async () => {
                   // Validate code format before calling Edge Function
                   if (!isValidCodeFormat(inviteCodeInput)) {
                     toast("Invalid code format — should be 8 characters");
                     return;
                   }

                    // Use the same Edge Function as deep links for consistency and reliability
                    await redeemInviteCode(inviteCodeInput);
                   setInviteCodeInput("");
                   setShowAddFriendsModal(false);
                 }}
                className="w-full callme-gradient text-white py-3.5 rounded-[14px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-callme/25 transition-all"
               >
                 {redeemingCode
                   ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connecting…</>
                   : "Connect with Code"
                 }
              </button>
            </div>

            {/* Or divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Share your code section */}
            <div>
              <p className="text-sm text-gray-400 mb-3 leading-relaxed">
                Share your code so others can add you:
              </p>
              
               <button
                 disabled={sharingCode}
                 onClick={async () => {
                   try {
                     if (!user) {
                       toast("Not authenticated");
                       return;
                     }

                     // Rate limiting: prevent spamming code generation (max 1 code every 5 seconds)
                     const now = Date.now();
                     if (now - lastCodeGeneratedTime < 5000) {
                       toast("Wait a moment before generating another code");
                       return;
                     }
                     
                     setSharingCode(true);

                     // Generate a random invite code locally
                     const chars = "23456789abcdefghjkmnpqrstuvwxyz";
                     const bytes = new Uint8Array(8);
                     crypto.getRandomValues(bytes);
                     const code = Array.from(bytes).map((b) => chars[b % chars.length]).join("");

                      console.log("[CallMe] Generated invite code:", code);
                      logInviteCodeEvent({ code, userId: user.id, event: "generated" });
                       
                      // Validate user data before inserting
                     if (!user.id || !user.username) {
                       console.error("[CallMe] Missing user data:", { id: user.id, username: user.username });
                       toast("Error: Your profile is incomplete. Please update your profile and try again.");
                       return;
                     }
                     
                      const insertPayload = {
                        code: code,
                        inviter_id: user.id,
                        inviter_username: user.username,
                      };
                      console.log("[CallMe] Insert payload:", insertPayload);
                      console.log("[CallMe] Current user session:", { userId: user.id, username: user.username });

                      // CRITICAL: Save code to database - this MUST succeed or user cannot add friends
                      console.log("[CallMe] Attempting to save code to database...");
                      // IMPORTANT: This insert can fail if:
                      // 1. User's auth session is invalid (RLS check fails)
                      // 2. Network timeout (>10s) - request is abandoned mid-flight
                      // 3. Database is down or unreachable
                      // 4. Duplicate code (extremely unlikely, but possible)
                      
                       // CRITICAL: Retry mechanism - code MUST get into database
                       let insertError: any = null;
                       let insertData: any = null;
                       let retryCount = 0;
                       const maxRetries = 4; // Increased from 2 to 4 - give database real chance to respond
                       
                         while (retryCount <= maxRetries && !insertData) {
                           try {
                             const attemptTime = Date.now();
                             console.log(`[CallMe] Insert attempt ${retryCount + 1}/${maxRetries + 1}...`);
                             
                             // Try to insert - this MUST succeed before we proceed
                             const insertResponse = await withTimeout(supabase
                               .from("invite_codes")
                               .insert(insertPayload), 5000); // 5s timeout per attempt
                             
                             const responseTime = Date.now();
                             console.log(`[CallMe] Response received in ${responseTime - attemptTime}ms - error: ${!!insertResponse.error}`);
                             
                             insertError = insertResponse.error;
                             // If no error, mark as success
                             insertData = insertError ? null : [insertPayload];
                           
                             if (insertError && retryCount < maxRetries) {
                               // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
                               const delay = 500 * Math.pow(2, retryCount);
                               console.log(`[CallMe] Insert failed (${(insertError as any).message}), retrying in ${delay}ms...`);
                               await new Promise(resolve => setTimeout(resolve, delay));
                               retryCount++;
                             } else {
                               break;
                             }
                           } catch (err) {
                             console.error(`[CallMe] Insert attempt threw error:`, err);
                             insertError = err;
                             if (retryCount < maxRetries) {
                               const delay = 500 * Math.pow(2, retryCount);
                               console.log(`[CallMe] Retrying in ${delay}ms...`);
                               await new Promise(resolve => setTimeout(resolve, delay));
                               retryCount++;
                             } else {
                               break;
                             }
                           }
                        }

                       console.log("[CallMe] Insert response:", { insertData, insertError });
                       
                       // CRITICAL: Database insert must succeed before allowing user to share
                         // Otherwise their friend will get "code not found" when trying to redeem it
                         if (insertError) {
                          console.error("[CallMe] Database insert failed after all retries:", JSON.stringify(insertError, null, 2));
                          const errorDetails = {
                            code: (insertError as any).code,
                            message: (insertError as any).message || insertError?.toString?.(),
                            details: (insertError as any).details,
                            hint: (insertError as any).hint,
                            inviter_id: user.id,
                            timestamp: new Date().toISOString(),
                            attempts: maxRetries + 1,
                          };
                          console.error("[CallMe] Full error details:", errorDetails);
                          logInviteCodeEvent({ 
                            code, 
                            userId: user.id, 
                            event: "sync_failed",
                            error: (insertError as any).message,
                          });
                          
                          // Check if it's an RLS policy error or auth issue
                          const errorMsg = ((insertError as any).message || "").toLowerCase();
                          if ((insertError as any).code === "PGRST301" || errorMsg.includes("row-level security") || errorMsg.includes("permission")) {
                            toast("Permission denied - signing you out. Please sign back in.");
                            await supabase.auth.signOut();
                            return;
                          }
                          
                          // Database is not responding - this is a critical issue
                          console.error("[CallMe] CRITICAL: Database insert failed! Code cannot be shared.");
                          toast("Unable to generate code - check your connection and try again");
                          return; // BLOCK: Don't show share dialog if code isn't in database
                        } else {
                          console.log("[CallMe] Code successfully inserted into database!");
                          markInviteCodeAsSynced(user.id, code);
                          logInviteCodeEvent({ code, userId: user.id, event: "sync_success" });
                        }
                     // Update rate limit timestamp
                     setLastCodeGeneratedTime(now);

                      // NOW show the share dialog (code is already safe in local storage)
                      console.log("[CallMe] Showing share dialog...");
                      try {
                        await Share.share({
                          title: "Join me on CallMe",
                          text: `I'm using CallMe to share when I'm free to call. To add me as a friend, copy this entire message and paste it in the "Add Friends" section — it'll automatically extract the code:

${code}

If you don't have CallMe yet, download it here: https://apps.apple.com/app/just-call-me-app/id6759512338`,
                        });
                        console.log("[CallMe] Share completed successfully");
                        logInviteCodeEvent({ code, userId: user.id, event: "shared" });
                      } catch (shareErr) {
                        // If share dialog fails or is cancelled, code is still safe locally
                        console.log("[CallMe] Share dialog cancelled or failed:", shareErr);
                      }

                     // Close modal since everything succeeded
                     setShowAddFriendsModal(false);

                   } catch (err: unknown) {
                     if (err instanceof Error && err.name !== "AbortError") {
                       console.error("[CallMe] code generation failed:", err.message);
                       if (err.message.includes("timed out")) {
                         toast("Request timed out — check your connection and try again");
                       } else {
                         toast("Something went wrong — check your connection and try again");
                       }
                     }
                   } finally {
                     setSharingCode(false);
                   }
                 }}
                 className="w-full callme-gradient text-white py-3.5 rounded-[14px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-callme/25 transition-all"
               >
                 {sharingCode
                   ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating code…</>
                   : <><Share2 className="w-4 h-4" /> Share Your Code</>
                 }
               </button>
            </div>

            <button
              onClick={() => {
                setShowAddFriendsModal(false);
                setInviteCodeInput("");
              }}
              className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors mt-3"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Friend Detail Sheet */}
      <BottomSheet open={!!selectedFriend} onClose={() => { setSelectedFriend(null); setConfirmRemove(false); }}>
        {selectedFriend && (
          <>
            {/* Profile summary */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar
                name={selectedFriend.friend.display_name}
                id={selectedFriend.friend.id}
                src={selectedFriend.friend.profile_picture}
                size="lg"
                online={!selectedFriend.is_muted && selectedFriend.friend.is_available}
              />
              <div>
                <p className="font-display font-bold text-xl">{selectedFriend.friend.display_name}</p>
                <p className="text-gray-400 text-sm">@{selectedFriend.friend.username}</p>
                {!selectedFriend.is_muted && selectedFriend.friend.current_mood && (
                  <p className="text-sm text-gray-500 mt-1 italic">"{selectedFriend.friend.current_mood}"</p>
                )}
                {selectedFriend.is_muted && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <BellOff className="w-3 h-3" /> Muted
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Call button */}
              {selectedFriend.friend.phone_number && (
                <a
                  href={`tel:${selectedFriend.friend.phone_number.replace(/[^\d+]/g, "")}`}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border border-emerald-200 rounded-[16px] text-emerald-700 font-medium text-sm hover:bg-emerald-100 transition-colors"
                >
                  <Phone className="w-[18px] h-[18px]" />
                  Call {selectedFriend.friend.display_name.split(" ")[0]}
                </a>
              )}

              {/* Mute / Unmute */}
              <button
                onClick={() => toggleMute(
                  selectedFriend.id,
                  selectedFriend.is_muted,
                  selectedFriend.friend.display_name.split(" ")[0]
                )}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border border-gray-200 rounded-[16px] text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                {selectedFriend.is_muted ? (
                  <><Bell className="w-[18px] h-[18px] text-callme" /> Unmute</>
                ) : (
                  <><BellOff className="w-[18px] h-[18px]" /> Mute — hide availability from each other</>
                )}
              </button>

              {/* Remove — two-step confirm */}
              {confirmRemove ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 px-5 py-3.5 bg-white border border-gray-200 rounded-[16px] text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmRemove(false);
                      removeFriend(
                        selectedFriend.id,
                        selectedFriend.friend.display_name.split(" ")[0]
                      );
                    }}
                    className="flex-1 px-5 py-3.5 bg-red-500 border border-red-500 rounded-[16px] text-white font-semibold text-sm hover:bg-red-600 transition-colors"
                  >
                    Yes, remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(true)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border border-red-200 rounded-[16px] text-red-500 font-medium text-sm hover:bg-red-50 transition-colors"
                >
                  <UserMinus className="w-[18px] h-[18px]" />
                  Remove {selectedFriend.friend.display_name.split(" ")[0]}
                </button>
              )}
            </div>
          </>
        )}
      </BottomSheet>


    </div>
  );
}
