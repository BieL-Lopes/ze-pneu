import type { Metadata } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: {
    default: "Zé Pneu — Pneus e acessórios automotivos",
    template: "%s | Zé Pneu",
  },
  description:
    "Pneus de todas as medidas e marcas, com entrega em todo o Brasil e retirada em Brasília.",
  metadataBase: siteUrl(),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
