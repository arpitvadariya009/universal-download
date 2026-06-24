import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Universal Video Downloader | DharitriX Infotech - Free MP4 & MP3 Downloads",
  description: "The #1 free video downloader by DharitriX Infotech. Download videos and audio from YouTube, Instagram, TikTok, Facebook, and 1000+ sites instantly. High quality 4K and 1080p supported.",
  keywords: [
    "DharitriX Infotech", "video downloader", "youtube downloader free", "instagram reels download", 
    "tiktok mp4 download", "facebook video downloader", "fastest video downloader online",
    "download music from youtube", "hd video downloader 2026", "universal downloader"
  ],
  authors: [{ name: "DharitriX Infotech" }],
  creator: "DharitriX Infotech",
  publisher: "DharitriX Infotech",
  robots: "index, follow",
  openGraph: {
    title: "Universal Video Downloader | DharitriX Infotech",
    description: "Download any video from any platform in seconds. 100% Free and Secure.",
    url: "https://universal-downloader.tech", // Should be updated to actual domain
    siteName: "DharitriX Infotech Downloader",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Universal Video Downloader | DharitriX Infotech",
    description: "Download videos from 1000+ sites in high quality.",
  },
  alternates: {
    canonical: "/",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "DharitriX Universal Downloader",
    "operatingSystem": "All",
    "applicationCategory": "MultimediaApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "A high-performance universal video and audio downloader supporting 1000+ platforms.",
    "publisher": {
      "@type": "Organization",
      "name": "DharitriX Infotech"
    }
  };

  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
