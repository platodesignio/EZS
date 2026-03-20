import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generative Power Space Explorer",
  description:
    "A reduced-order urban generative-power simulation platform. Computes Power Potential and Power-Potential Gradient Rate for future-city districts.",
  keywords: [
    "urban analytics",
    "power potential",
    "boundary conditions",
    "generative design",
    "urban simulation",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-0 text-text-primary antialiased overflow-hidden h-screen">
        {children}
      </body>
    </html>
  );
}
