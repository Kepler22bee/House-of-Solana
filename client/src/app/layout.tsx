import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "House of Solana - Casino RPG",
  description: "A top-down pixel art casino RPG on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
