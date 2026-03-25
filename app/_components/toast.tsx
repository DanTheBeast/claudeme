"use client";

import { useEffect, useRef } from "react";

export function Toast({
   message,
   onDone,
 }: {
   message: string;
   onDone: () => void;
 }) {
   // Store onDone in a ref so the timer never restarts if the parent re-renders
   // and passes a new function reference (which would reset the 2800ms window).
   const onDoneRef = useRef(onDone);
   useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

   // Use a unique key to ensure timer restarts even if the message is identical.
   // This handles the case where "Failed to save" appears twice in rapid succession.
   const messageKey = useRef(0);
   useEffect(() => {
     messageKey.current++;
   }, [message]);

   useEffect(() => {
     const t = setTimeout(() => onDoneRef.current(), 2800);
     return () => clearTimeout(t);
   }, [message, messageKey.current]); // re-start timer when message or count changes

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDoneRef.current()}
      onKeyDown={(e) => e.key === "Enter" && onDoneRef.current()}
      className="fixed left-1/2 -translate-x-1/2 z-[999] bg-gray-900 text-white px-6 py-3.5 rounded-2xl text-sm font-medium shadow-2xl anim-fade-up max-w-[90%] text-center cursor-pointer select-none"
      style={{ top: "calc(env(safe-area-inset-top) + 1.25rem)" }}
    >
      {message}
    </div>
  );
}
