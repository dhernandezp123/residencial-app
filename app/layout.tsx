import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ),
  title: "ResidentPass",
  description: "Sistema de control de acceso residencial con QR",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/branding/favicons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/favicons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/branding/favicons/favicon.ico",
    apple: { url: "/branding/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    images: ["/branding/social/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#15936A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
