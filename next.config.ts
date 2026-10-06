import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A planilha de catálogo sobe pelo painel como Server Action. O padrão
      // de 1 MB não cabe um catálogo inteiro; 4,5 MB é o teto de corpo de
      // requisição das funções da Vercel.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
