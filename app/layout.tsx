import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { baseMetadata } from "@/lib/metadata";
import { ReactNode } from "react";
import { Nav } from "@/components/layout/nav";
import { PageBackdrop } from "@/components/layout/page-backdrop";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
    display: "swap"
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
    display: "swap"
});

const fraunces = Fraunces({
    variable: "--font-fraunces",
    subsets: ["latin"],
    axes: ["opsz", "SOFT"],
    display: "swap",
});

export const metadata: Metadata = baseMetadata;

export const viewport: Viewport = {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    ],
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactNode {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} min-h-screen bg-background font-sans text-foreground antialiased`}      
        suppressHydrationWarning
      >
        <PageBackdrop />
        <Nav />
        {children}
      </body>
    </html>
  );
}
