import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TheLook",
  description: "Complete the look — virtual try-on storefront.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions inject attributes onto <html>/<body>
    // before React hydrates (e.g. data-__host_prefix…-filters-channel). This scopes the
    // warning suppression to attribute mismatches on these elements only — not real bugs.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
        {/* <model-viewer> web component for the "See as 3D" feature */}
        <Script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
