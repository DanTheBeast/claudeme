"use client";

import { useEffect, useRef } from "react";
import { feedbackSheetOpen, feedbackClick } from "@/app/_lib/haptics";

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);

  // Play sound when sheet opens
  useEffect(() => {
    if (open) feedbackSheetOpen();
  }, [open]);

  // When keyboard appears, scroll focused input into view inside the sheet
  useEffect(() => {
    if (!open) return;
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && sheetRef.current?.contains(target)) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    };
    document.addEventListener("focusin", handleFocus);
    return () => document.removeEventListener("focusin", handleFocus);
  }, [open]);

  // Swipe-to-dismiss: track touch on the sheet itself
  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy < 0) return; // don't allow dragging up
    dragCurrentY.current = dy;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };

  const onTouchEnd = () => {
    if (sheetRef.current) {
      sheetRef.current.style.transition = "";
      sheetRef.current.style.transform = "";
    }
    // Dismiss if dragged more than 120px down
    if (dragCurrentY.current > 120) {
      feedbackClick();
      onClose();
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  };

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}
      className="bg-black/35 backdrop-blur-[6px] flex items-end justify-center"
      onClick={() => { feedbackClick(); onClose(); }}
    >
      <div
        ref={sheetRef}
        className="bg-white rounded-t-[28px] overflow-y-auto overflow-x-hidden anim-slide-up px-6 pt-2"
        style={{
          maxHeight: "88vh",
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
          width: "100%",
          maxWidth: "100vw",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="w-9 h-1 rounded-full bg-gray-200 mx-auto mt-2 mb-5" />
        {children}
      </div>
    </div>
  );
}
