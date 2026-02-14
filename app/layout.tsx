import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CallMe — Meaningful Phone Conversations",
  description:
    "Stay connected with friends and family through spontaneous phone calls. Know when people are available and enjoy real conversations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
