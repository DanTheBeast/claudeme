const COLORS = [
  "from-indigo-500 to-violet-500",
  "from-emerald-500 to-green-600",
  "from-rose-500 to-pink-600",
  "from-blue-500 to-cyan-500",
  "from-amber-500 to-orange-500",
  "from-violet-500 to-purple-600",
  "from-pink-500 to-rose-500",
  "from-teal-500 to-emerald-500",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function Avatar({
  name,
  id,
  size = "md",
  online,
  src,
}: {
  name: string | null | undefined;
  id?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  src?: string | null;
}) {
  const safeName = name || "?";
  const initials = safeName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const idx = hash(id || safeName) % COLORS.length;

  const sizes = {
    sm: { box: "w-9 h-9 text-xs", dot: "w-2.5 h-2.5" },
    md: { box: "w-[46px] h-[46px] text-sm", dot: "w-3 h-3" },
    lg: { box: "w-[72px] h-[72px] text-xl", dot: "w-4 h-4" },
  };

  return (
    <div className="relative flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={safeName}
          className={`${sizes[size].box} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizes[size].box} rounded-full bg-gradient-to-br ${COLORS[idx]} flex items-center justify-center text-white font-semibold`}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${sizes[size].dot} rounded-full border-[2.5px] border-white ${
            online ? "bg-emerald-500 status-pulse" : "bg-gray-300"
          }`}
        />
      )}
    </div>
  );
}
