import type { Metadata } from "next";
import "./globals.css";

// NOTE: this sandbox's build environment blocks fonts.googleapis.com, so
// next/font/google (Fraunces / IBM Plex Sans / IBM Plex Mono, matching the
// LeaseMatch brand) can't be fetched at build time here. Falling back to a
// close system-font stack (see globals.css) for local dev. Once this is
// deployed somewhere with normal internet access (Vercel, etc.), swap this
// back to next/font/google with the brand fonts — the --font-fraunces /
// --font-plex-sans / --font-plex-mono variables are already wired up in
// globals.css and just need real font-family values.

export const metadata: Metadata = {
  title: "LeaseMatch UAE",
  description: "Trusted leasing — matched, verified, signed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
