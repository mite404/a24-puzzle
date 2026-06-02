import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  className?: string;
}

/** Minimal chrome echoing shop.a24films.com product pages. */
export function SiteHeader({ className }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "a24-gutter flex items-center justify-between border-b border-foreground py-3",
        className,
      )}
    >
      <p className="a24-eyebrow">The A24 Oracle</p>
      <p className="a24-eyebrow text-muted-foreground">Portfolio demo</p>
    </header>
  );
}
