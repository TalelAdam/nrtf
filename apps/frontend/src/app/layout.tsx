import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const heading = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ReTeqFusion Industrial Console",
  description: "Industrial IoT dashboard for 3D inspection and document ingestion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${mono.variable}`}>
        <QueryProvider>
          <div className="app-shell">
            <AppSidebar />
            <main className="main-panel">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
