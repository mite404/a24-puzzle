import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  /** Extra top offset for hero-style phases (intake, end). */
  hero?: boolean;
  /** Vertically center the column in the viewport (intake / end). */
  centered?: boolean;
  /** Narrow copy column vs. wider game layout. */
  maxWidth?: "copy" | "game" | "full";
}

const maxWidthClass = {
  /** ~730px text column on shop product pages */
  copy: "max-w-[45.6rem]",
  game: "max-w-6xl",
  full: "w-full",
} as const;

export function AppShell({
  children,
  className,
  hero = false,
  centered = false,
  maxWidth = "copy",
}: AppShellProps) {
  return (
    <div
      className={cn(
        "a24-gutter flex w-full flex-1 flex-col",
        hero && "a24-hero-pad",
        centered && "justify-center",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col",
          maxWidthClass[maxWidth],
          centered && "min-h-[min(720px,75dvh)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
