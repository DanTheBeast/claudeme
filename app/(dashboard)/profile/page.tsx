"use client";

import { useState, useRef } from "react";
import { feedbackToggleOn, feedbackToggleOff, feedbackSuccess, feedbackError } from "@/app/_lib/haptics";
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
  Eye,
  Users,
  Clock,
  MessageCircle,
  Camera,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, refreshUser, toast } = useApp();
  const supabase = createClient();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({
    display_name: user?.display_name || "",
    phone_number: user?.phone_number || "",
    current_mood: user?.current_mood || "",
    username: user?.username || "",
  });

  const save = async () => {
    if (!user) return;
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
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
      await supabase
        .from("profiles")
        .update({ profile_picture: publicUrl })
        .eq("id", user.id);
      await refreshUser();
      toast("Photo updated!");
    } catch {
      toast("Failed to upload photo");
    }
    setUploadingPhoto(false);
  };

  const updateSetting = async (key: string, value: boolean) => {
    if (!user) return;
    if (value) feedbackToggleOn(); else feedbackToggleOff();
    await supabase
      .from("profiles")
      .update({ [key]: value })
      .eq("id", user.id);
    await refreshUser();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
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
      icon: Bell,
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
      <header className="bg-white border-b border-gray-100/80 sticky top-0 z-30 px-5 py-3.5 flex items-center justify-between">
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
      </header>

      <main className="px-5 pt-5 flex flex-col gap-5">
        {/* Profile card */}
        <div className="bg-white rounded-[22px] p-7 shadow-sm border border-gray-100 anim-fade-up">
          <div className="text-center mb-5">
            <div className="inline-block mb-3 relative">
              <Avatar
                name={user.display_name}
                id={user.id}
                size="lg"
                src={user.profile_picture}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 w-8 h-8 bg-callme rounded-full flex items-center justify-center shadow-md border-2 border-white"
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
                <MessageCircle className="w-3.5 h-3.5" /> Status
              </label>
              {editing ? (
                <textarea
                  className="w-full px-4 py-3 border border-gray-200 rounded-[14px] text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-callme/20 resize-none"
                  rows={2}
                  value={draft.current_mood}
                  onChange={(e) =>
                    setDraft({ ...draft, current_mood: e.target.value })
                  }
                  placeholder="What do you want to chat about?"
                />
              ) : (
                <div className="bg-[#f8f6f3] p-3.5 rounded-[14px] text-sm text-gray-600 min-h-[44px]">
                  {user.current_mood || "No status set"}
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
                className={`flex items-center justify-between py-3.5 ${
                  i < settings.length - 1
                    ? "border-b border-gray-50"
                    : ""
                }`}
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
        </div>

        {/* Sign Out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border-[1.5px] border-red-200 rounded-[16px] text-red-500 font-medium text-sm hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" /> Sign Out
        </button>

        {/* App info */}
        <div className="bg-white rounded-[22px] p-6 shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 callme-gradient rounded-[14px] flex items-center justify-center mx-auto mb-3">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-display font-bold">CallMe</h3>
          <p className="text-xs text-gray-400 mt-0.5">Version 1.0.0</p>
          <p className="text-xs text-gray-300 mt-1">
            Connect through real conversations
          </p>
        </div>
      </main>
    </div>
  );
}
