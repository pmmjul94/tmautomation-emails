import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "Zoho Email Automator",
  description: "Create email campaign automations in plain English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <ToastProvider>
          <Nav />
          <main className="container py-6">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
