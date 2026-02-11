import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Trace — Stop Guessing Why Your Moves Don't Look Right",
  description:
    "AI-powered motion analysis for dancers. Trace uses Ghost Mirror technology to show you exactly where your technique breaks down.",
  openGraph: {
    title: "Trace — AI-Powered Dance Analysis",
    description:
      "Stop guessing why your moves don't look right. Trace uses AI to compare your movement to a reference dancer, frame by frame.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
