import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import AppCanvas from "@/components/AppCanvas";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const lora = Lora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ThriftBuddy",
  description: "An App Designed for Thrifters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${lora.variable} min-h-screen antialiased`}> 
        <AppCanvas />
        <AppHeader />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
