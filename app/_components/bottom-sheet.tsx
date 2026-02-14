"use client";

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/35 backdrop-blur-[6px] z-[200] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-[28px] sm:rounded-[24px] max-w-[480px] w-full max-h-[88vh] overflow-y-auto anim-slide-up sm:anim-scale-in px-6 pb-8 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="w-9 h-1 rounded-full bg-gray-200 mx-auto mt-2 mb-5 sm:hidden" />
        {children}
      </div>
    </div>
  );
}
