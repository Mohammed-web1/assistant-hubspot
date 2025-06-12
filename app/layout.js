import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
export const metadata = {
  metadataBase: new URL('https://assistant-hubspot.vercel.app'),
  title: "Assistant HubSpot",
  description: "Assistant intelligent pour HubSpot",
  keywords: "HubSpot, AI, assistant, chatbot",
  authors: [{ name: "Mohammed" }],
  robots: "index, follow",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  },
  openGraph: {
    title: "Assistant HubSpot",
    description: "Assistant intelligent pour HubSpot",
    type: "website",
    locale: "fr_FR",
    siteName: "Assistant HubSpot",
    url: "https://assistant-hubspot.vercel.app"
  },
  twitter: {
    card: "summary_large_image",
    title: "Assistant HubSpot",
    description: "Assistant intelligent pour HubSpot",
    site: "@assistant_hubspot"
  }
};
export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
