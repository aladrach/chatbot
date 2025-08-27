import type { Metadata } from "next";
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
  title: "Incorta Chatbot",
  description: "Chatbot for Incorta Docs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" style={{background: 'transparent'}}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
        style={{background: 'transparent'}}
      >
        {children}
      </body>
    </html>
  );
}
