import type { Metadata } from "next";
import { fraunces, plexSans, plexMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weave — The Social Graph Stellar Was Missing",
  description:
    "A decentralized, permissionless social graph protocol on Stellar. Identity, follows, and reputation on-chain — payments woven in from day one.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-ink text-star antialiased">{children}</body>
    </html>
  );
}
