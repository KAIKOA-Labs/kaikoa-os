import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAIKOA OS",
  description: "Personal operating system for House of Kaikoa",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
