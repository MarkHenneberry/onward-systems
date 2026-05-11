import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.onwardsystems.ca"),
  title: "Onward Systems | Websites, Lead Intake & Automation for Halifax Service Businesses",
  description:
    "Onward Systems builds custom websites, lead intake systems, and practical automations for local service businesses across Halifax, Dartmouth, Cole Harbour, and HRM.",
  keywords: [
    "website design Halifax",
    "websites for small businesses Halifax",
    "websites for local service businesses",
    "lead intake systems",
    "business automation Halifax",
    "websites and automation for contractors",
    "websites for trades and home service businesses",
    "Halifax digital systems",
    "small business automation HRM",
  ],
  authors: [{ name: "Mark Henneberry", url: "https://www.onwardsystems.ca" }],
  creator: "Onward Systems",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://www.onwardsystems.ca",
    siteName: "Onward Systems",
    title: "Onward Systems | Websites, Lead Intake & Automation for Halifax Service Businesses",
    description:
      "Custom websites, lead intake systems, and practical automations for local service businesses across Halifax and HRM.",
    images: [
      {
        url: "/images/logo.png",
        width: 1200,
        height: 630,
        alt: "Onward Systems",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onward Systems | Websites, Lead Intake & Automation for Halifax Service Businesses",
    description:
      "Custom websites, lead intake systems, and practical automations for local service businesses across Halifax and HRM.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
