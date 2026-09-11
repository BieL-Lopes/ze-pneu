import type { Metadata } from "next";
import "./globals.css";
import { Cabecalho } from "@/components/layout/cabecalho";
import { Rodape } from "@/components/layout/rodape";

export const metadata: Metadata = {
  title: {
    default: "Zé Pneu — Pneus e acessórios automotivos",
    template: "%s | Zé Pneu",
  },
  description:
    "Pneus de todas as medidas e marcas, com entrega em todo o Brasil e retirada em Brasília.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased">
        <Cabecalho />
        <div className="flex-1">{children}</div>
        <Rodape />
      </body>
    </html>
  );
}
