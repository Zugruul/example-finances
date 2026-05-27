import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finances",
  description: "Reference event-sourced finance tracker for Event Sorcerer.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ImpersonationBanner />
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" richColors />
        <Suspense fallback={null}>
          <ToastFromSearchParams />
        </Suspense>
      </body>
    </html>
  );
}
