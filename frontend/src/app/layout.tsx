import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FS Advisory CRM — Telesales & Sales Desk",
  description: "Enterprise Real Estate CRM for FS Advisory",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-[#FAF8F4] text-[#2C2C2C]">{children}</body>
    </html>
  );
}
