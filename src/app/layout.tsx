import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crônicas de Aventuras",
  description: "Um RPG de texto gerado por IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
