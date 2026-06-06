import Image from "next/image";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  className?: string;
  /** Transparent bar over the basement TV scene. */
  overlay?: boolean;
}

/** Shop-style chrome: eyebrow left, A24 mark centered. */
export function SiteHeader({ className, overlay = false }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "a24-gutter grid grid-cols-[1fr_auto_1fr] items-center py-4 md:py-5",
        overlay
          ? "absolute inset-x-0 top-0 z-40 border-b border-[#f5e6c8]/10 bg-[#120f0c]/35 backdrop-blur-[2px]"
          : "border-b border-foreground",
        className,
      )}
    >
      <p
        className={cn(
          "a24-eyebrow justify-self-start",
          overlay && "text-[#f5e6c8]/70",
        )}
      >
        The A24 Oracle
      </p>
      <Image
        src="/a24-assets/A24-Films-Logo-Vector.png"
        alt="A24"
        width={88}
        height={32}
        priority
        className={cn(
          "h-7 w-auto justify-self-center md:h-8",
          overlay && "brightness-0 invert opacity-90",
        )}
      />
      <span className="justify-self-end" aria-hidden />
    </header>
  );
}
