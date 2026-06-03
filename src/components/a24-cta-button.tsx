import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface A24CtaButtonProps extends ComponentProps<"button"> {
  children: React.ReactNode;
}

const ARROW_VIEWBOX = "0 0 72 12";

/**
 * Borderless LISTEN NOW CTA — arrow left, shared center axis.
 * CSS-only hover: clip wrapper narrows (overflow hidden + justify-end)
 * so the shaft retracts from the left while tip-to-label gap stays fixed.
 */
export function A24CtaButton({
  children,
  className,
  type = "button",
  ...props
}: A24CtaButtonProps) {
  return (
    <button type={type} className={cn("a24-cta-link", className)} {...props}>
      <span className="a24-cta-arrow-wrap" aria-hidden>
        <svg
          className="a24-cta-arrow-svg"
          viewBox={ARROW_VIEWBOX}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          aria-hidden
        >
          <path
            d="M0 6H63L68 6M63 2.25 68 6 63 9.75"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="a24-cta-link-label">{children}</span>
    </button>
  );
}
