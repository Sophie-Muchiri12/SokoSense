type LogoMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "boxed" | "plain";
  animate?: boolean;
};

const markSizes = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
} as const;

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
} as const;

export function SokoSenseLogoMark({
  className = "",
  size = "sm",
  variant = "boxed",
  animate = false,
}: LogoMarkProps) {
  const isPlain = variant === "plain";

  return (
    <span
      className={`relative inline-flex items-center justify-center ${
        isPlain ? "text-teal" : "rounded-md bg-ink text-paper"
      } ${markSizes[size]} ${animate ? "splash-logo-float" : ""} ${className}`}
    >
      {isPlain && animate && (
        <span
          className="absolute inset-0 rounded-full bg-teal/10 splash-glow-pulse"
          aria-hidden="true"
        />
      )}
      <svg
        viewBox="0 0 24 24"
        className={`relative ${iconSizes[size]} ${animate ? "splash-logo-draw" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={isPlain ? 2 : 1.8}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path
          className={animate ? "splash-path-draw" : undefined}
          style={animate ? { strokeDasharray: 32, strokeDashoffset: 32 } : undefined}
          d="M4 18c4-10 12-10 16 0"
        />
        <path
          className={animate ? "splash-path-draw splash-path-draw-delay" : undefined}
          style={animate ? { strokeDasharray: 18, strokeDashoffset: 18 } : undefined}
          d="M12 4v14"
        />
      </svg>
    </span>
  );
}

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
  variant?: "boxed" | "plain";
  animate?: boolean;
};

export function SokoSenseLogo({
  size = "sm",
  showWordmark = true,
  className = "",
  variant = "boxed",
  animate = false,
}: LogoProps) {
  const wordmarkSizes = {
    sm: "text-[22px]",
    md: "text-[28px]",
    lg: "text-[40px]",
    xl: "text-[56px]",
  } as const;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SokoSenseLogoMark size={size} variant={variant} animate={animate} />
      {showWordmark && (
        <span
          className={`font-serif leading-none text-ink ${wordmarkSizes[size]} ${
            animate ? "splash-rise splash-rise-delay-2" : ""
          }`}
        >
          Soko<span className="text-teal">Sense</span>
        </span>
      )}
    </span>
  );
}
