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

export const metadata = {
  title: "Assistant HubSpot",
  description: "Assistant intelligent pour HubSpot",
  keywords: "HubSpot, AI, assistant, chatbot",
  authors: [{ name: "Mohammed" }],
  robots: "index, follow",
  openGraph: {
    title: "Assistant HubSpot",
    description: "Assistant intelligent pour HubSpot",
    type: "website",
    locale: "fr_FR",
    url: "https://assistant-hubspot.vercel.app",
    siteName: "Assistant HubSpot"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
