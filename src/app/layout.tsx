import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JABA SaaS - Gestor Inteligente",
  description: "Plataforma de gestión de suscripciones y asistentes IA",
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
