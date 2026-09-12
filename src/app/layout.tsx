import type { Metadata } from "next";
import { Roboto_Flex, Roboto_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

import PwaProvider from "@/components/pwa-provider";

// Material 3 type: Roboto Flex for UI, Roboto Mono for codes and data.
// The CSS variable names are kept so every existing class keeps working.
const robotoFlex = Roboto_Flex({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MapDispenser",
  description: "Assign, track, and manage map territories.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MapDispenser",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCFF" },
    { media: "(prefers-color-scheme: dark)", color: "#131314" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${robotoFlex.variable} ${robotoMono.variable} antialiased`}
      >
        <NextTopLoader color="#4285F4" height={3} showSpinner={false} shadow="0 0 8px #4285F4" />
        <PwaProvider />
        {children}
      </body>
    </html>
  );
}
