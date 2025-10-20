import type { Metadata } from "next";
import { Geist, Geist_Mono, Assistant } from "next/font/google";
import "./globals.css";
import TanstackQueryClientProvider from "@/components/providers/query-client-provider";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Trends",
  description: "You had Google Trends, now checkout out trends in different AI models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${assistant.variable} antialiased`}
      >
        <TanstackQueryClientProvider>
          {children}
        </TanstackQueryClientProvider>
      </body>
    </html>
  );
}
