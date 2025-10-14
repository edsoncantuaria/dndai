import type { Metadata } from "next";
import { Cinzel_Decorative, IM_Fell_English } from 'next/font/google';
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const cinzel = Cinzel_Decorative({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-cinzel',
});

const imFell = IM_Fell_English({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-im-fell',
});

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
    <html lang="pt-BR" className={`${cinzel.variable} ${imFell.variable} h-full`}>
      <body className="h-full">
          {children}
          <Toaster />
      </body>
    </html>
  );
}
