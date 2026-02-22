"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Calendar, User } from "lucide-react";
import { feedbackClick } from "@/app/_lib/haptics";

const items = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/friends", icon: Users, label: "Friends" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav({ pendingRequests = 0 }: { pendingRequests?: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100/80 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="max-w-md mx-auto flex items-center justify-around py-1.5 pb-2">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          const showBadge = href === "/friends" && pendingRequests > 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => feedbackClick()}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 px-4 transition-colors ${
                active
                  ? "text-callme"
                  : "text-[#c0bbb4] hover:text-gray-500"
              }`}
            >
              <div className="relative">
                <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {pendingRequests > 9 ? "9+" : pendingRequests}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
