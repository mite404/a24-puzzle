import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SiteFooterProps {
  className?: string;
}

/** Decorative shop footer — links are inert mockups for visual parity. */
export function SiteFooter({ className }: SiteFooterProps) {
  return (
    <footer
      className={cn(
        "a24-footer-spacer a24-footer-inset bg-foreground text-background",
        className,
      )}
    >
      <div className="a24-footer-pad grid gap-12 lg:grid-cols-3 lg:gap-16">
        <nav aria-label="Shop" className="flex flex-col gap-8">
          <ul className="flex flex-col gap-1.5">
            {["Apparel", "Goods", "Collectibles", "Books", "AAA24"].map(
              (item) => (
                <li key={item}>
                  <FooterLink>{item}</FooterLink>
                </li>
              ),
            )}
          </ul>
          <ul className="flex flex-col gap-1.5">
            {[
              "Shipping & Returns",
              "Terms of Use",
              "Privacy Policy",
              "Privacy Preferences",
            ].map((item) => (
              <li key={item}>
                <FooterLink>{item}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col">
          <FooterRule label="More A24" />
          <ul className="mt-10 flex flex-col gap-1.5">
            {["A24", "Twitter", "TikTok", "Instagram", "YouTube"].map(
              (item) => (
                <li key={item}>
                  <FooterLink>{item}</FooterLink>
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="flex flex-col">
          <FooterRule label="Want more A24?" />
          <p className="a24-body mt-6 max-w-sm text-background">
            Get our emails. Letters from our filmmakers, new trailers, podcasts,
            merch, and more. Not too often — just enough.
          </p>
          <div
            className="mt-6 grid max-w-md grid-cols-[1fr_auto] border border-background"
            aria-hidden
          >
            <span className="a24-meta px-4 py-3 text-background/50">Email</span>
            <span className="a24-meta border-s border-background px-6 py-3 text-background">
              Sign up
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterRule({ label }: { label: string }) {
  return (
    <div>
      <hr className="border-background" />
      <p className="a24-body a24-footer-rule-label">{label}</p>
    </div>
  );
}

function FooterLink({ children }: { children: ReactNode }) {
  return (
    <span className="a24-body cursor-default">{children}</span>
  );
}
