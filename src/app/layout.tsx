import type { Metadata } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import "./globals.css";

// Carregando as fontes do projeto
const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: '--font-source-code-pro',
});

export const metadata: Metadata = {
  title: "RPG de Cria",
  description: "Uma aventura de RPG guiada por IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sourceCodePro.variable}`}>
      <body className="font-sans bg-stone-900/90 bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/background.png')" }}>
        {children}
      </body>
    </html>
  );
}
