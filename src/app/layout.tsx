import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import { VaultProvider } from "@/components/vault/VaultProvider";
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
  title: "Lockora - Secure Secrets Vault",
  description: "Secure secrets-management application",
};

import { ThemeProvider } from '@/components/providers';
import { CyberBackground } from '@/components/CyberBackground';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground dark:bg-zinc-950">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <ClerkProvider>
            <VaultProvider>
              <CyberBackground />
              {children}
            </VaultProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
