type LogoMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const markSizes = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
} as const;

export function SokoSenseLogoMark({ className = "", size = "sm" }: LogoMarkProps) {
  return (
    <img
      src="/sokosenselogo.jpeg"
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-full object-contain ${markSizes[size]} ${className}`}
    />
  );
}

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
};

export function SokoSenseLogo({ size = "sm", showWordmark = true, className = "" }: LogoProps) {
  const wordmarkSizes = {
    sm: "text-[22px]",
    md: "text-[28px]",
    lg: "text-[40px]",
    xl: "text-[56px]",
  } as const;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SokoSenseLogoMark size={size} />
      {showWordmark && (
        <span className={`font-serif leading-none text-ink ${wordmarkSizes[size]}`}>
          Soko<span className="text-teal">Sense</span>
        </span>
      )}
    </span>
  );
}
