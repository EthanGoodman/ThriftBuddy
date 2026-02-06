import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import AppCanvas from "@/components/AppCanvas";

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThriftBuddy",
  description: "An App Desgined for Thrifters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${manrope.variable} min-h-screen bg-slate-950 text-slate-100 antialiased`}
      >
        <AppCanvas />
        <AppHeader />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
