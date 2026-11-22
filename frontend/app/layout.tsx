import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  title: "BuildOps",
  description:
    "Business management software for hardware, fittings, sanitary ware, and building-material businesses.",
  icons: {
    icon: [
      {
        url: "/my_icon.png",
        type: "image/png",
      },
    ],
    shortcut: "/my_icon.png",
    apple: "/my_icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full min-w-0 flex-col overflow-x-hidden bg-[var(--workspace)] text-[var(--charcoal-900)]">
        {children}
      </body>
    </html>
  );
}