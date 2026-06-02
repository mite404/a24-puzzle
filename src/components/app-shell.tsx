import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  /** Center content vertically (intake chat). Games use default top-aligned flow. */
  centered?: boolean;
  /** Narrow column for conversation; games can pass a wider max width. */
  maxWidth?: "chat" | "game" | "full";
}

const maxWidthClass = {
  chat: "max-w-2xl",
  game: "max-w-5xl",
  full: "max-w-6xl",
} as const;

export function AppShell({
  children,
  className,
  centered = false,
  maxWidth = "chat",
}: AppShellProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8",
        centered && "items-center justify-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-1 flex-col",
          maxWidthClass[maxWidth],
          centered && "h-[min(720px,90dvh)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
