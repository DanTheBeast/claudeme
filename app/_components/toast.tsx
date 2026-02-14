"use client";

import { useEffect } from "react";

export function Toast({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999] bg-gray-900 text-white px-6 py-3.5 rounded-2xl text-sm font-medium shadow-2xl anim-fade-up max-w-[90%] text-center">
      {message}
    </div>
  );
}
