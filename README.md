# Zé Pneu — E-commerce

Loja online de pneus e acessórios automotivos, com entrega nacional e retirada
em Brasília.

## Documentação

- [Design da Fase 1](docs/superpowers/specs/2026-09-10-ecommerce-fase1-design.md) — arquitetura, modelo de domínio e corte de escopo
- [Plano 1: Fundação e Catálogo](docs/superpowers/plans/2026-09-10-fundacao-e-catalogo.md) — plano de implementação em execução
- [Checkout — configuração](docs/checkout-configuracao.md) — credenciais do Mercado Pago e do Melhor Envio
- [Painel administrativo](docs/painel-administrativo.md) — primeiro acesso, papéis e o que cada tela faz

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL
npm run db:migrate
npm run dev
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (unidade e integração) |
| `npm run lint` | ESLint, incluindo a regra de fronteira de camada |
| `npm run build` | Build de produção |
| `npm run db:generate` | Gera migração a partir do schema |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run import:catalogo -- arquivo.csv` | Importa catálogo ([formato](docs/importacao-catalogo.md)) |
| `npm run admin:criar -- email "Nome"` | Cria o primeiro administrador do painel |

## Arquitetura em uma frase

Monolito modular: a lógica de negócio vive em `src/core` como código puro que
não conhece HTTP nem React, e é consumida tanto pelo site (Server Components)
quanto pela API pública em `/api/v1` — que é o que o aplicativo da Fase 2 vai
usar.

**A regra que sustenta isso:** `src/core` não importa de `src/app`, `src/db`,
React ou Drizzle. Há uma regra de ESLint que falha o build se alguém tentar.
