"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { feedbackToggleOn, feedbackToggleOff, feedbackSuccess, feedbackError, soundsEnabled, setSoundsEnabled } from "@/app/_lib/haptics";
import { createClient } from "@/app/_lib/supabase-browser";
import { useApp } from "../layout";
import type { Profile } from "@/app/_lib/types";
import { Avatar } from "@/app/_components/avatar";
import {
  LogOut,
  Phone,
  Shield,
  Bell,
  Mail,
  Eye,
  Users,
  Clock,
  MessageCircle,
  Camera,
  Bug,
  Lightbulb,
  Volume2,
} from "lucide-react";
// Clock is kept for Availability Alerts toggle

// Resize an image file to maxPx on the longest side and compress as JPEG.
// Runs entirely client-side via canvas — no server round-trip needed.
function resizeImage(file: File, maxPx: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    // Guard against HEIC/HEIF decode hangs — iOS WKWebView can stall decoding
    // large camera photos, so we give it 30s before giving up.
    const decodeTimeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode timed out"));
    }, 30000);
    img.onload = () => {
      clearTimeout(decodeTimeout);
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxPx / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      clearTimeout(decodeTimeout);
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

export default function ProfilePage() {
  const { user, refreshUser, toast } = useApp();
  // Stable client instance — avoids creating a new client on every render
  const supabase = useMemo(() => createClient(), []);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarBust, setAvatarBust] = useState<string | null>(null);
  const [appSounds, setAppSounds] = useState(() => soundsEnabled());
  const [saving, setSaving] = useState(false);
  // savingRef mirrors the `saving` state but is always current inside async
  // closures — avoids the stale-closure deadlock where saveField sees an old
  // `saving = true` and re-queues instead of running the pending save.
  const savingRef = useRef(false);
  // Queue for pending saves: if a save is in-flight when a second blur fires,
  // store it and run it after the first one completes.
  const pendingSave = useRef<{ field: string; value: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({
    display_name: user?.display_name || "",
    phone_number: user?.phone_number || "",
    current_mood: user?.current_mood || "",
    username: user?.username || "",
  });

  // Re-sync draft whenever the DB values change — covers:
  //   • Initial load (user goes from null → profile)
  //   • refreshUser() after a successful save (DB value confirmed)
  //   • refreshUser() after an error-revert (DB value may differ from what
  //     was typed, so we re-align the draft to avoid a stale pre-revert value
  //     being sent on the next save)
  // We only update fields that aren't currently "dirty" (i.e. have no pending
  // in-flight save) to avoid clobbering what the user is mid-typing.
  useEffect(() => {
    if (!user) return;
    // Only resync if not currently saving — savingRef is always current
    if (savingRef.current) return;
    setDraft({
      display_name: user.display_name || "",
      phone_number: user.phone_number || "",
      current_mood: user.current_mood || "",
      username: user.username || "",
    });
  // Each field individually so any DB-side change triggers a re-sync,
  // not just a user ID change (which only fires on login/logout).
  }, [user?.id, user?.display_name, user?.phone_number, user?.current_mood, user?.username]);

  // Auto-save on blur — called when any field loses focus.
  // If a save is already in-flight, queue the latest value and run it after.
  const saveField = async (field: string, value: string) => {
    if (!user) return;
    if (field === "display_name" && !value.trim()) {
      feedbackError();
      toast("Name can't be empty");
      setDraft((d) => ({ ...d, display_name: user.display_name || "" }));
      return;
    }
    if (savingRef.current) {
      // Don't drop it — queue it so it runs after the current save finishes
      pendingSave.current = { field, value };
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", user.id);
    savingRef.current = false;
    setSaving(false);
    if (error) {
      feedbackError();
      if (field === "username") {
        toast("Username already taken");
        setDraft((d) => ({ ...d, username: user.username || "" }));
      } else {
        toast("Failed to save");
      }
    } else {
      feedbackSuccess();
      await refreshUser();
    }
    // Flush any queued save that arrived while this one was in-flight
    if (pendingSave.current) {
      const next = pendingSave.current;
      pendingSave.current = null;
      saveField(next.field, next.value);
    }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    // Reset the input so the same file can be reselected after a failure
    e.target.value = "";
    setUploadingPhoto(true);
    try {
      // Resize and compress to JPEG before uploading.
      // iPhone photos can be 10-15MB — we only need ~400px for a profile pic.
      const compressed = await resizeImage(file, 400, 0.85);
      const path = `${user.id}/avatar.jpg`;

      // Wrap the upload in a 45s timeout so a hung request never freezes the app.
      // Camera photos on iOS can take extra time to decode (HEIC→JPEG conversion
      // happens in the browser before resizeImage even starts), so 15s was too tight.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Upload timed out")), 45000)
      );
      const upload = supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

      const { error: uploadError } = await Promise.race([upload, timeout]);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await supabase
        .from("profiles")
        .update({ profile_picture: publicUrl })
        .eq("id", user.id);
      await refreshUser();
      setAvatarBust(String(Date.now()));
      toast("Photo updated!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "";
      const msg = errMsg === "Upload timed out"
        ? "Upload timed out — check your connection and try again"
        : errMsg === "Image decode timed out"
        ? "Photo took too long to process — try again"
        : errMsg === "Image load failed" || errMsg === "Canvas context unavailable"
        ? "Couldn't process that photo — try a different one"
        : "Failed to upload photo";
      toast(msg);
      feedbackError();
    } finally {
      // Always clear the uploading state — never leave the spinner stuck
      setUploadingPhoto(false);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    if (!user) return;
    if (value) feedbackToggleOn(); else feedbackToggleOff();
    const { error } = await supabase
      .from("profiles")
      .update({ [key]: value })
      .eq("id", user.id);
    if (error) {
      feedbackError();
      toast("Failed to save setting — try again");
      // Revert by refreshing from DB so toggle snaps back to its real state
      await refreshUser();
      return;
    }
    await refreshUser();
  };

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      // Clear session and local storage
      try {
        Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
      } catch {}
      window.location.href = "/";
    } catch {
      feedbackError();
      toast("Failed to delete account — please try again");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    // Clear all Supabase session keys from localStorage so the next
    // load starts completely unauthenticated regardless of signOut result.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.location.href = "/";
  };

  if (!user) return null;

  const settings: {
    key: string;
    title: string;
    desc: string;
    icon: typeof Eye;
  }[] = [
    {
      key: "show_online_status",
      title: "Show Online Status",
      desc: "Let friends see when you go available",
      icon: Eye,
    },
    {
      key: "allow_friend_requests",
      title: "Allow Friend Requests",
      desc: "Let people search for and add you",
      icon: Users,
    },
    {
      key: "enable_push_notifications",
      title: "Push Notifications",
      desc: "Required for availability alerts to work",
      icon: Bell,
    },
    {
      key: "enable_email_notifications",
      title: "Email Notifications",
      desc: "Get availability alerts via email too",
      icon: Mail,
    },
    {
      key: "notify_availability_changes",
      title: "Availability Alerts",
      desc: "Get a notification the moment a friend goes free",
      icon: Clock,
    },
  ];

  return (
    <div className="pb-24">
      <header className="app-header bg-white backdrop-blur-sm border-b border-gray-100/80 fixed left-0 right-0 z-30 flex flex-col overflow-visible" style={{ top: 0 }}>
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="px-5 py-3.5 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Profile</h1>
          {saving && (
            <span className="text-[12px] text-gray-400 animate-pulse">Saving…</span>
          )}
        </div>
      </header>

      <div style={{ height: "calc(env(safe-area-inset-top, 0px) + 56px)" }} />

      <main className="px-5 pt-5 flex flex-col gap-5">
        {/* Profile card */}
        <div className="bg-white rounded-[22px] p-7 shadow-sm border border-gray-100 anim-fade-up">
          <div className="text-center mb-5">
            <div className="inline-block mb-3 relative">
              <Avatar
                name={user.display_name}
                id={user.id}
                size="lg"
                src={user.profile_picture
                  ? user.profile_picture + (avatarBust ? `?t=${avatarBust}` : "")
                  : null}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 w-10 h-10 bg-callme rounded-full flex items-center justify-center shadow-md border-2 border-white"
              >
                {uploadingPhoto ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadPhoto}
              />
            </div>
            <input
              className="w-full text-center text-xl font-bold px-4 py-2 border-2 border-dashed border-transparent rounded-[14px] bg-transparent focus:outline-none focus:border-callme hover:border-gray-200 transition-colors"
              value={draft.display_name}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
              onBlur={(e) => saveField("display_name", e.target.value)}
            />
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="text-gray-400 text-sm">@</span>
              <input
                className="text-center text-sm text-gray-500 border border-dashed border-transparent rounded-lg bg-transparent w-32 py-1 focus:outline-none focus:border-callme hover:border-gray-200 transition-colors"
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                onBlur={(e) => saveField("username", e.target.value)}
              />
            </div>
          </div>

          <div className="h-px bg-gray-100 my-4" />

          <div className="space-y-4 text-left">
            {/* Status */}
            <div>
              <label className="text-[13px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> What's on your mind?
              </label>
              <textarea
                className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20 resize-none"
                rows={2}
                value={draft.current_mood}
                onChange={(e) => setDraft({ ...draft, current_mood: e.target.value })}
                onBlur={(e) => saveField("current_mood", e.target.value)}
                placeholder="A show, game, sports, something on your mind..."
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-[13px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20"
                value={draft.phone_number}
                onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })}
                onBlur={(e) => saveField("phone_number", e.target.value)}
                placeholder="+1 (555) 123-4567"
                type="tel"
              />
              {!user.phone_number && (
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  Add your phone number so friends can call you
                </p>
              )}
            </div>

            {/* Availability indicator */}
            <div className="flex items-center gap-2.5 pt-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  user.is_available
                    ? "bg-emerald-500 status-pulse"
                    : "bg-gray-300"
                }`}
              />
              <span className="text-sm font-medium">
                {user.is_available
                  ? "Available to chat"
                  : "Currently unavailable"}
              </span>
            </div>
          </div>
        </div>

        {/* Settings — single flat list, no tabs */}
        <div className="bg-white rounded-[22px] px-5 pt-5 pb-2 shadow-sm border border-gray-100 anim-fade-up-1">
          <h3 className="font-semibold text-[15px] mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Settings
          </h3>
          {settings.map((s, i) => {
            const isOn = user[s.key as keyof Profile] as boolean;
            return (
              <div
                key={s.key}
                className="flex items-center justify-between py-3.5 border-b border-gray-50"
              >
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                </div>
                <button
                  onClick={() => updateSetting(s.key, !isOn)}
                  className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                    isOn ? "bg-callme" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                      isOn ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
          {/* Local-only sounds toggle */}
          <div className="flex items-center justify-between py-3.5">
            <div className="flex items-start gap-2.5">
              <Volume2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">App Sounds</p>
                <p className="text-xs text-gray-400 mt-0.5">UI sound effects</p>
              </div>
            </div>
            <button
              onClick={() => {
                const next = !appSounds;
                setSoundsEnabled(next);
                setAppSounds(next);
                if (next) feedbackToggleOn(); else feedbackToggleOff();
              }}
              className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                appSounds ? "bg-callme" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                  appSounds ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Privacy Policy */}
        <a
          href="https://justcallme.app/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border-[1.5px] border-gray-200 rounded-[16px] text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          <Shield className="w-[18px] h-[18px]" /> Privacy Policy
        </a>

        {/* Report a Bug */}
        <a
          href="mailto:hello@justcallme.app?subject=CallMe%20Bug%20Report&body=Describe%20the%20bug%20here..."
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border-[1.5px] border-gray-200 rounded-[16px] text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          <Bug className="w-[18px] h-[18px]" /> Report a Bug
        </a>

        {/* Feature Requests */}
        <a
          href="mailto:hello@justcallme.app?subject=Feature%20Request&body=Describe%20your%20feature%20request%20here..."
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border-[1.5px] border-gray-200 rounded-[16px] text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          <Lightbulb className="w-[18px] h-[18px]" /> Feature Request
        </a>

        {/* Sign Out — two-step to prevent accidental taps */}
        {confirmLogout ? (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmLogout(false)}
              className="flex-1 px-5 py-3.5 bg-white border-[1.5px] border-gray-200 rounded-[16px] text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 px-5 py-3.5 bg-red-500 border-[1.5px] border-red-500 rounded-[16px] text-white font-semibold text-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-[18px] h-[18px]" /> Yes, sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border-[1.5px] border-red-200 rounded-[16px] text-red-500 font-medium text-sm hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" /> Sign Out
          </button>
        )}

        {/* Delete Account — two-step, visually separate from Sign Out */}
        {confirmDelete ? (
          <div className="bg-white border-[1.5px] border-red-200 rounded-[16px] p-4">
            <p className="text-sm font-semibold text-red-600 mb-1">Delete your account?</p>
            <p className="text-xs text-gray-500 mb-3">
              This permanently deletes your profile, friends, and all data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-[12px] text-gray-600 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-500 rounded-[12px] text-white font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Yes, delete everything"
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full text-center text-xs text-gray-400 hover:text-red-400 transition-colors py-2"
          >
            Delete Account
          </button>
        )}

        {/* App info */}
        <div className="bg-white rounded-[22px] p-6 shadow-sm border border-gray-100 text-center">
          <img src="/logo.png" alt="CallMe" className="w-12 h-12 rounded-[14px] mx-auto mb-3" />
          <h3 className="font-display font-bold">CallMe</h3>
          <p className="text-xs text-gray-400 mt-0.5">Version {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}</p>
          <p className="text-xs text-gray-300 mt-1">
            Connect through real conversations
          </p>
        </div>
      </main>
    </div>
  );
}
