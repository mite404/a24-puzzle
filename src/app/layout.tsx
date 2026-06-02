import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The A24 Oracle",
  description:
    "Consult the A24 Oracle. A short conversation, then a puzzle experience built around your taste.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(archivo.variable, "dark font-sans")}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
