export interface Profile {
  id: string;
  email: string;
  display_name: string;
  username: string | null;
  phone_number: string | null;
  profile_picture: string | null;
  is_available: boolean;
  current_mood: string | null;
  availability_type: string;
  created_at: string;
  last_seen: string;
  show_online_status: boolean;
  show_last_seen: boolean;
  allow_friend_requests: boolean;
  allow_phone_search: boolean;
  enable_push_notifications: boolean;
  enable_email_notifications: boolean;
  notify_friend_requests: boolean;
  notify_availability_changes: boolean;
  notify_call_suggestions: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  enable_quiet_hours: boolean;
  available_until: string | null;
  [key: string]: string | boolean | null;
}

export interface Friendship {
  id: number;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "declined";
  is_muted: boolean;
  created_at: string;
  // Joined data
  friend?: Profile;
  requester?: Profile;
}

export interface FriendWithProfile {
  id: number;
  status: string;
  is_muted: boolean;
  friend: Profile;
}

export interface AvailabilityWindow {
  id: number;
  user_id: string;
  day_of_week: number; // 0=Sunday .. 6=Saturday
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
  description: string | null;
}


