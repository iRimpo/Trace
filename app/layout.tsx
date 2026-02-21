import type { Metadata } from "next";
import { Inter, Space_Mono, Outfit, DM_Sans, Plus_Jakarta_Sans, Raleway } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
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

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  title: "Trace — Stop Guessing Why Your Moves Don't Look Right",
  description:
    "AI-powered motion analysis for dancers. Trace uses Ghost Mirror technology to show you exactly where your technique breaks down.",
  icons: {
    icon: [
      { url: "/logos/trace-icon.png", sizes: "32x32", type: "image/png" },
      { url: "/logos/trace-icon.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/logos/trace-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
        className={`${inter.variable} ${spaceMono.variable} ${outfit.variable} ${dmSans.variable} ${plusJakarta.variable} ${raleway.variable} font-sans antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
