import { BRAND } from "@/lib/brandTokens";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Space_Mono, Outfit, DM_Sans, Plus_Jakarta_Sans, Raleway, Calistoga, Nunito } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import PostHogProvider from "@/components/PostHogProvider";
import ActivationGuard from "@/components/ActivationGuard";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import InstallPrompt from "@/components/InstallPrompt";
import MotionProvider from "@/components/MotionProvider";
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

/**
 * The display face — headings and big numbers only.
 *
 * DM Sans at `font-extrabold` is close to Duolingo's Feather Bold but
 * geometrically cooler: flatter terminals, tighter apertures, more neutral. On
 * a heading or a 5.5rem score that neutrality reads as "dashboard", which is
 * the opposite of the register this app wants at the moment it tells you how
 * you did. Nunito is the closest free analogue — rounded terminals, a warmer
 * bowl, and it holds up heavy.
 *
 * Deliberately *not* applied to body copy and **not** to the stage HUD. DM
 * Sans's tighter, more upright forms are more legible at ten feet, and the HUD
 * is the one place in the app where legibility at distance outranks character
 * entirely. Rounded terminals cost a little of exactly that.
 *
 * One weight subset, so this is a few KB rather than a family download.
 */
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-nunito",
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
  themeColor: BRAND.primary,
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
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/trace_logo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
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
        className={`${inter.variable} ${spaceMono.variable} ${outfit.variable} ${dmSans.variable} ${plusJakarta.variable} ${raleway.variable} ${calistoga.variable} ${nunito.variable} font-sans antialiased`}
      >
        <MotionProvider>
          <AuthProvider>
            <ActivationGuard>
              <Suspense fallback={null}>
                <PostHogProvider>{children}</PostHogProvider>
              </Suspense>
            </ActivationGuard>
          </AuthProvider>
          <ServiceWorkerRegistrar />
          <InstallPrompt />
        </MotionProvider>
      </body>
    </html>
  );
}
