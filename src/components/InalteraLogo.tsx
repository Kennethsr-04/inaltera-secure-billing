import { cn } from "@/lib/utils";

interface InalteraLogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function InalteraLogo({ className, showText = true, size = "md" }: InalteraLogoProps) {
  const iconSize = size === "sm" ? "w-8 h-8" : size === "md" ? "w-10 h-10" : "w-14 h-14";
  const textSize = size === "sm" ? "text-lg" : size === "md" ? "text-xl" : "text-3xl";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("bg-primary dark:bg-[hsl(var(--primary-glow))] rounded-lg flex items-center justify-center", iconSize)}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={cn(size === "sm" ? "w-5 h-5" : size === "md" ? "w-6 h-6" : "w-8 h-8", "text-primary-foreground dark:text-white")}
        >
          <path
            d="M7 17L17 7M17 7H9M17 7V15"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-display font-bold tracking-tight text-foreground", textSize)}>
            INALTERA
          </span>
        </div>
      )}
    </div>
  );
}
