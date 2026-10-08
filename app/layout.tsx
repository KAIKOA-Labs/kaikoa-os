import type { Metadata } from "next";
import "./globals.css";
import PrivateSessionBoundary from "./private-session-boundary";

export const metadata: Metadata = {
  title: "KAIKOA OS",
  description: "Personal operating system for House of Kaikoa",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PrivateSessionBoundary>{children}</PrivateSessionBoundary></body>
    </html>
  );
}
