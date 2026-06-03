import Image from "next/image";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  className?: string;
}

/** Shop-style chrome: eyebrow left, A24 mark centered. */
export function SiteHeader({ className }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "a24-gutter grid grid-cols-[1fr_auto_1fr] items-center border-b border-foreground py-4 md:py-5",
        className,
      )}
    >
      <p className="a24-eyebrow justify-self-start">The A24 Oracle</p>
      <Image
        src="/a24-assets/A24-Films-Logo-Vector.png"
        alt="A24"
        width={88}
        height={32}
        priority
        className="h-7 w-auto justify-self-center md:h-8"
      />
      <span className="justify-self-end" aria-hidden />
    </header>
  );
}
