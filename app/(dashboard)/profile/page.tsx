"use client";

import { useState, useRef, useEffect } from "react";
import { feedbackToggleOn, feedbackToggleOff, feedbackSuccess, feedbackError, soundsEnabled, setSoundsEnabled } from "@/app/_lib/haptics";
import { createClient } from "@/app/_lib/supabase-browser";
import { useApp } from "../layout";
import { Avatar } from "@/app/_components/avatar";
import {
  Edit3,
  Save,
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
export default function ProfilePage() {
  const { user, refreshUser, toast } = useApp();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarBust, setAvatarBust] = useState<string | null>(null);
  const [appSounds, setAppSounds] = useState(() => soundsEnabled());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({
    display_name: user?.display_name || "",
    phone_number: user?.phone_number || "",
    current_mood: user?.current_mood || "",
    username: user?.username || "",
  });

  // Re-sync draft if user loads after mount (e.g. slow cold start)
  useEffect(() => {
    if (user && !editing) {
      setDraft({
        display_name: user.display_name || "",
        phone_number: user.phone_number || "",
        current_mood: user.current_mood || "",
        username: user.username || "",
      });
    }
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    if (!draft.display_name.trim()) {
      feedbackError();
      toast("Name can't be empty");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: draft.display_name,
        phone_number: draft.phone_number,
        current_mood: draft.current_mood,
        username: draft.username,
      })
      .eq("id", user.id);
    if (error) {
      feedbackError();
      toast("Failed to save — username may already be taken");
    } else {
      feedbackSuccess();
      await refreshUser();
      setEditing(false);
      toast("Profile updated! ✅");
    }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      // Store the clean URL without cache-busting params — the timestamp query
      // param is appended at render time by the Avatar component to bust CDN cache.
      const publicUrl = urlData.publicUrl;
      await supabase
        .from("profiles")
        .update({ profile_picture: publicUrl })
        .eq("id", user.id);
      await refreshUser();
      // Bust the browser/CDN cache for this session so the new photo shows immediately.
      // We do NOT store this timestamp in the DB — just use it locally for rendering.
      setAvatarBust(String(Date.now()));
      toast("Photo updated!");
    } catch {
      toast("Failed to upload photo");
    }
    setUploadingPhoto(false);
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
      return;
    }
    await refreshUser();
  };

  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = async () => {
    // signOut triggers onAuthStateChange in the layout which sets authed=false,
    // rendering <AuthPage /> directly — no need for an additional router.push
    // (which would cause a double-navigation flicker).
    await supabase.auth.signOut();
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
      desc: "Let friends see when you're free",
      icon: Eye,
    },
    {
      key: "allow_friend_requests",
      title: "Allow Friend Requests",
      desc: "Let new people find you",
      icon: Users,
    },
    {
      key: "enable_push_notifications",
      title: "Push Notifications",
      desc: "Get notified when friends are free",
      icon: Bell,
    },
    {
      key: "enable_email_notifications",
      title: "Email Notifications",
      desc: "Receive notifications via email",
      icon: Mail,
    },
    {
      key: "notify_availability_changes",
      title: "Availability Alerts",
      desc: "When friends become available",
      icon: Clock,
    },
    {
      key: "enable_quiet_hours",
      title: "Quiet Hours (10pm–8am)",
      desc: "Silence late-night notifications",
      icon: Clock,
    },
  ];

  return (
    <div className="pb-24">
      <header className="app-header bg-white backdrop-blur-sm border-b border-gray-100/80 fixed left-0 right-0 z-30 flex flex-col overflow-visible" style={{ top: 0 }}>
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="px-5 py-3.5 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Profile</h1>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-callme text-[13px] font-medium flex items-center gap-1 border border-callme-200 px-3.5 py-1.5 rounded-[12px] hover:bg-callme-50 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setDraft({
                    display_name: user.display_name,
                    phone_number: user.phone_number || "",
                    current_mood: user.current_mood || "",
                    username: user.username || "",
                  });
                }}
                className="text-[13px] border border-gray-200 px-3 py-1.5 rounded-[12px] text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="callme-gradient text-white text-[13px] px-3.5 py-1.5 rounded-[12px] font-semibold flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
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
            {editing ? (
              <input
                className="w-full text-center text-xl font-bold px-4 py-2 border-2 border-dashed border-gray-300 rounded-[14px] bg-transparent focus:outline-none focus:border-callme"
                value={draft.display_name}
                onChange={(e) =>
                  setDraft({ ...draft, display_name: e.target.value })
                }
              />
            ) : (
              <h2 className="font-display text-2xl font-bold">
                {user.display_name}
              </h2>
            )}
            {editing ? (
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-gray-400 text-sm">@</span>
                <input
                  className="text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg bg-transparent w-32 py-1 focus:outline-none focus:border-callme"
                  value={draft.username}
                  onChange={(e) =>
                    setDraft({ ...draft, username: e.target.value })
                  }
                />
              </div>
            ) : (
              <p className="text-gray-400 text-sm mt-0.5">
                @{user.username}
              </p>
            )}
          </div>

          <div className="h-px bg-gray-100 my-4" />

          <div className="space-y-4 text-left">
            {/* Status */}
            <div>
              <label className="text-[13px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> What's on your mind?
              </label>
              {editing ? (
                <textarea
                  className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20 resize-none"
                  rows={2}
                  value={draft.current_mood}
                  onChange={(e) =>
                    setDraft({ ...draft, current_mood: e.target.value })
                  }
                  placeholder="A show, game, sports, something on your mind..."
                />
              ) : (
                <div className="bg-[#f8f6f3] p-3.5 rounded-[14px] text-sm min-h-[44px]">
                  {user.current_mood
                    ? <span className="text-gray-600 italic">{user.current_mood}</span>
                    : <span className="text-gray-400">Nothing yet — give friends a reason to call</span>
                  }
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="text-[13px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </label>
              {editing ? (
                <input
                  className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20"
                  value={draft.phone_number}
                  onChange={(e) =>
                    setDraft({ ...draft, phone_number: e.target.value })
                  }
                  placeholder="+1 (555) 123-4567"
                />
              ) : (
                <div className="bg-[#f8f6f3] p-3.5 rounded-[14px] text-sm text-gray-600">
                  {user.phone_number || "No phone added"}
                </div>
              )}
              {!editing && !user.phone_number && (
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
            const isOn = (user as Record<string, unknown>)[s.key] as boolean;
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
