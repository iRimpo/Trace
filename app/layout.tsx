import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Space_Mono, Outfit, DM_Sans, Plus_Jakarta_Sans, Raleway, Calistoga } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import PostHogProvider from "@/components/PostHogProvider";
import ActivationGuard from "@/components/ActivationGuard";
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

const calistoga = Calistoga({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-calistoga",
});

export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080808",
};

export const metadata: Metadata = {
  title: "Trace",
  description:
    "AI-powered motion analysis for dancers. Trace uses Ghost Mirror technology to show you exactly where your technique breaks down.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trace",
  },
  icons: {
    icon: [{ url: "/trace_logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/trace_logo.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Trace",
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
        className={`${inter.variable} ${spaceMono.variable} ${outfit.variable} ${dmSans.variable} ${plusJakarta.variable} ${raleway.variable} ${calistoga.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <ActivationGuard>
            <Suspense fallback={null}>
              <PostHogProvider>{children}</PostHogProvider>
            </Suspense>
          </ActivationGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
