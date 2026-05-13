import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.onwardsystems.ca"),
  title: "Onward Systems | Websites, Lead Systems & Automations for Halifax Businesses",
  description:
    "Onward Systems builds custom websites, lead intake systems, workflow automations, and AI-assisted business tools for local service businesses across Halifax and HRM.",
  keywords: [
    "Halifax web design",
    "HRM business systems",
    "Dartmouth websites",
    "workflow automation Halifax",
    "lead intake systems",
    "local business websites Halifax",
    "AI business systems",
    "websites for contractors Halifax",
    "small business automation HRM",
    "lead capture systems",
    "service business websites Nova Scotia",
  ],
  authors: [{ name: "Mark Henneberry", url: "https://www.onwardsystems.ca" }],
  creator: "Onward Systems",
  alternates: {
    canonical: "https://www.onwardsystems.ca",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://www.onwardsystems.ca",
    siteName: "Onward Systems",
    title: "Onward Systems | Websites, Lead Systems & Automations for Halifax Businesses",
    description:
      "Custom websites, lead intake systems, workflow automations, and AI-assisted business tools for local service businesses across Halifax and HRM.",
    images: [
      {
        url: "/images/logo.png",
        width: 1200,
        height: 630,
        alt: "Onward Systems - Websites and Business Systems for Halifax Service Businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onward Systems | Websites, Lead Systems & Automations for Halifax Businesses",
    description:
      "Custom websites, lead intake systems, workflow automations, and AI-assisted business tools for local service businesses across Halifax and HRM.",
    images: ["/images/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
