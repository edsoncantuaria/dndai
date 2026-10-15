import type { Metadata, Viewport } from 'next';
import { Cinzel_Decorative, IM_Fell_English, Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppProviders from '@/components/AppProviders';

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

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Crônicas de Aventuras',
  description: 'Um RPG de texto gerado por IA.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${imFell.variable} ${inter.variable} h-full`}>
      <body className="h-full">
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
