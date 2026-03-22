import type { Metadata } from "next";
import "./globals.css";
import StarknetProvider from "../dojo/StarknetProvider";

export const metadata: Metadata = {
  title: "House of Stark",
  description: "A top-down pixel casino on Starknet where players deploy AI agents to play, earn, and optimize autonomous strategies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
}
