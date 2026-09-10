# Zé Pneu — E-commerce Fase 1 — Documento de Design

**Data:** 2026-09-10
**Status:** aprovado para implementação
**Escopo:** primeira entrega contratada — colocar a loja online no ar e transformar o estoque existente em vendas.

---

## 1. Contexto

O Zé Pneu é um ecossistema automotivo: e-commerce nacional, aplicativo próprio,
vans de serviço móvel, motorista responsável, botão de emergência, planos de
assinatura e um sistema de franquias. A Fase 1 entrega apenas a primeira camada
— a loja online — mas precisa ser construída sabendo o que vem depois.

Isso tem uma consequência prática que atravessa todo este documento: a lógica de
negócio da Fase 1 (catálogo, estoque, pedido) é a mesma que o aplicativo da Fase
2 vai consumir. Ela não pode nascer amarrada à interface web.

### Entregas contratadas

Site responsivo e personalizado; catálogo de produtos; busca; filtros por medida,
marca e características; carrinho; checkout; integração com gateway de pagamento;
gestão de estoque; gestão de pedidos; painel administrativo; integração com
WhatsApp; cálculo e configuração de frete; opção de retirada em Brasília;
publicação e configuração em produção.

---

## 2. Decisões de arquitetura

### 2.1 Monolito modular, não monolito comum e não microsserviços

Um único app Next.js, com a lógica de domínio isolada em `src/core/*` como
serviços puros — sem React, sem `Request`, sem `Response`. A web consome esses
serviços por Server Components e Server Actions. Uma camada fina em `/api/v1`
expõe os mesmos serviços para fora.

O motivo é a Fase 2. Quando o aplicativo chegar, ele consome `/api/v1`, que é um
adaptador sobre um núcleo que já existe e já está testado — não uma reescrita.
Uma API separada desde já (NestJS ao lado do Next) custaria dois deploys, dois
pipelines e autenticação atravessando serviço, para entregar hoje um benefício
que só aparece com vários times.

A regra que sustenta isso: **`src/core` não importa nada de `src/app`.** Quebrar
essa regra é o que transforma monolito modular em monolito comum.

### 2.2 Estoque é um livro-razão, não um número

Nunca `UPDATE saldo = saldo - 1`.

Toda alteração de estoque é um movimento registrado em `stock_movements`
(entrada, reserva, baixa, estorno, ajuste). O saldo vive em `stock_balances`
como um agregado mantido dentro da mesma transação, protegido por `SELECT ...
FOR UPDATE` na linha do SKU. O livro-razão é a verdade auditável; o saldo é um
cache rápido que pode ser reconstruído a partir dele.

O checkout cria uma **reserva com expiração**, não uma baixa. A baixa acontece na
confirmação do pagamento.

A falha que isso previne é concreta: dois checkouts simultâneos do último pneu do
estoque. Sem o lock, os dois passam, os dois clientes pagam, e um deles recebe um
pedido que a operação não tem como cumprir. Numa operação nova, esse é o tipo de
erro que queima reputação antes de existir reputação.

### 2.3 Pagamento, frete e fiscal atrás de portas

Três interfaces no núcleo, com um adaptador por provedor:

- `PaymentProvider` — `criarCobranca`, `consultarStatus`, `estornar`, `validarWebhook`
- `ShippingProvider` — `cotar`, `contratar`, `rastrear`
- `FiscalProvider` — definido na Fase 1, sem adaptador real ainda

Nenhum arquivo de checkout ou de pedido menciona o nome de um provedor. Trocar de
gateway é escrever um adaptador novo, não mexer no fluxo de compra.

Escolhas iniciais, justificadas e reversíveis:

| Porta | Adaptador inicial | Por quê |
|---|---|---|
| Pagamento | Mercado Pago | Credenciamento rápido sem burocracia de KYC, Pix e cartão no mesmo checkout transparente, antifraude incluso. Operação nova precisa vender antes de negociar taxa. |
| Frete | Melhor Envio + Retirada em Brasília | Uma integração dá acesso a várias transportadoras. Pneu é volumoso e pesado; depender só dos Correios costuma inviabilizar o frete. |
| Fiscal | Nenhum (gancho preparado) | Exige CNPJ, certificado A1 e regime tributário definidos. Os campos e o gancho existem desde já; o adaptador entra quando o cliente fornecer os dados. |

### 2.4 Loja como fonte da verdade do estoque, com porta para ERP

Não há ERP definido hoje. A loja é a fonte da verdade, com importação inicial por
CSV. O acesso a estoque no núcleo passa por uma interface, então plugar Bling,
Tiny ou Omie depois é escrever um sincronizador — não reescrever pedidos.

### 2.5 Busca por medida, não por veículo

Filtros por largura, perfil, aro, marca, índice de carga e índice de velocidade,
mais busca textual. Compatibilidade por veículo (marca/modelo/ano ou consulta por
placa) exige uma base de fitment licenciada ou montada à mão — é um subprojeto
próprio e fica fora da Fase 1.

---

## 3. Stack

| Camada | Escolha | Nota |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Server Components para catálogo, bom SEO por padrão |
| Banco | Postgres no Supabase | Gerenciado, com Auth e Storage inclusos |
| ORM | Drizzle | SQL-first, leve em serverless, migrations versionadas em git |
| UI | Tailwind + shadcn/ui | Componentes acessíveis, tema customizável para a marca |
| Validação | Zod | Um schema serve a formulário, Server Action e `/api/v1` |
| Auth | Supabase Auth | Cliente e admin, com papéis |
| Testes | Vitest + Playwright | Unidade e integração no núcleo; E2E nas jornadas críticas |
| Hospedagem | Vercel | Deploy por push, SSL e domínio resolvidos |
| Observabilidade | Sentry + logs estruturados | Erro em checkout precisa chegar antes da reclamação |

Busca usa Postgres nativo — `tsvector` para texto e índices B-tree para as
facetas de medida. Um catálogo de pneus não justifica Algolia ou Elasticsearch na
Fase 1.

---

## 4. Modelo de domínio

### Catálogo

`brands`, `categories`, `products`, `product_variants`, `product_media`.

`product` é o modelo comercial (Michelin Primacy 4). `product_variant` é o SKU e
carrega a medida e os índices: largura, perfil, aro, índice de carga, índice de
velocidade, tipo (passeio, SUV, carga), EAN, peso e dimensões para frete.

Essa separação dá duas coisas ao mesmo tempo: uma página de produto com seletor
de medida, e páginas facetadas por medida para SEO. As pessoas buscam
"pneu 205 55 r16" no Google, não "Michelin Primacy 4".

Acessórios usam a mesma estrutura, com a especificação de pneu nula.

### Estoque

`stock_locations`, `stock_balances` (SKU × local: `on_hand`, `reserved`),
`stock_movements` (livro-razão), `stock_reservations` (com `expires_at`).

Na Fase 1 existe um único `stock_location`, em Brasília. Retirada e entrega
consomem o mesmo saldo; a diferença entre elas é só o método de entrega
escolhido no checkout, não um depósito separado. A tabela já é modelada por local
porque a expansão por franquia da Fase 2 vai precisar disso.

### Preço

`prices` por variante, com histórico. Cupons e promoções ficam fora do MVP, mas o
cálculo do carrinho já passa por um ponto único de desconto, para não virar
cirurgia depois.

### Carrinho e pedido

`carts`, `cart_items` — carrinho de visitante por cookie, migrado ao logar.

`orders`, `order_items`, `order_events`, `shipments`, `payments`, `payment_events`.

O pedido é uma máquina de estados com histórico auditável:

```
aguardando_pagamento → pago → em_separacao → enviado           → entregue
                                           → pronto_para_retirada → retirado
                     → cancelado
        pago         → estornado
```

Transições válidas são declaradas em um único lugar e verificadas por teste. Cada
transição grava um `order_event`. É esse evento que alimenta o rastreio do
cliente, o disparo de WhatsApp e, mais tarde, a emissão da nota fiscal.

`orders` já nasce com os campos fiscais (CPF/CNPJ do comprador, endereço fiscal,
número e chave da nota) preenchíveis à mão pelo admin enquanto não há emissor.

### Clientes

`customers`, `addresses`, via Supabase Auth. Checkout de visitante é permitido —
exigir cadastro antes de comprar derruba conversão.

---

## 5. Jornada de compra

1. **Descoberta** — home, listagem por categoria, ou página facetada de medida
   vinda do Google.
2. **Filtro** — largura, perfil, aro, marca, índices, faixa de preço. Estado dos
   filtros vive na URL, então o cliente consegue compartilhar e o Google
   consegue indexar.
3. **Produto** — fotos, especificação completa, preço, prazo estimado, seletor de
   medida, botão de WhatsApp para dúvida.
4. **Carrinho** — cálculo de frete por CEP ainda no carrinho, antes do checkout.
   Frete surpresa na última tela é a maior causa de abandono.
5. **Checkout** — dados, endereço, escolha entre entrega e retirada em Brasília,
   pagamento. Uma página, em passos.
6. **Pagamento** — Pix com QR code na tela; cartão com parcelamento.
7. **Confirmação** — pedido criado, estoque reservado, e-mail enviado.
8. **Webhook** — o gateway confirma, o estoque baixa de fato, o status vira
   `pago`, cliente notificado.
9. **Acompanhamento** — página de status do pedido por link direto, sem exigir
   login.

A reserva de estoque nasce no passo 5 e expira em 30 minutos. Uma rotina agendada
libera as vencidas.

---

## 6. Painel administrativo

Acesso por papel (`admin`, `operador`).

- **Produtos** — cadastro, edição, variantes, fotos, importação por CSV
- **Estoque** — saldo por SKU, entrada de mercadoria, ajuste com motivo
  obrigatório, extrato de movimentos por SKU
- **Pedidos** — lista com filtro por status, detalhe, mudança de status,
  registro de código de rastreio, registro manual de nota fiscal
- **Frete** — configuração de regras, prazo adicional de manuseio, faixa de frete
  grátis
- **Relatórios** — vendas por período, produtos mais vendidos, SKUs sem estoque

Todo ajuste manual de estoque exige motivo e fica no livro-razão com autor e
data. Sem isso, divergência de inventário não tem como ser investigada.

---

## 7. Tratamento de erros

O núcleo devolve resultado tipado (`Ok`/`Err`) em vez de lançar exceção para
falha esperada — estoque insuficiente, cupom inválido, CEP não atendido. Exceção
fica para o que é realmente inesperado.

- **Webhook de pagamento** é idempotente. `payment_events` tem índice único no id
  do evento do provedor. Gateway reenvia webhook; reprocessar não pode baixar
  estoque duas vezes.
- **Cotação de frete indisponível** não bloqueia a compra: o carrinho mostra o
  erro e oferece retirada em Brasília ou contato por WhatsApp.
- **Falha de pagamento** mantém o pedido em `aguardando_pagamento` com a reserva
  viva até expirar, e permite nova tentativa sem recriar o carrinho.
- **Toda operação de escrita externa** (contratar frete, criar cobrança) leva
  chave de idempotência.
- Erro em checkout vai para o Sentry com o id do pedido, sempre.

---

## 8. Estratégia de testes

Desenvolvimento guiado por teste, conforme o fluxo de trabalho do projeto.

- **Unidade (Vitest)** — o núcleo inteiro. Rápido porque é puro: máquina de
  estados do pedido, cálculo do carrinho, regras de frete, transições de estoque.
- **Integração (Vitest + Postgres real)** — repositórios e transações. O teste
  que importa mais no projeto inteiro: **duas reservas concorrentes do último
  item, uma passa e a outra falha.** Se esse teste não existir, o design da
  seção 2.2 é decorativo.
- **E2E (Playwright)** — três jornadas: busca até pagamento aprovado; compra com
  retirada em Brasília; admin muda status e o cliente vê a mudança.
- **Contrato** — adaptadores de pagamento e frete testados contra o mesmo conjunto
  de casos da porta, com o provedor simulado.

---

## 9. Infraestrutura

- **Vercel** — produção e preview por branch
- **Supabase** — Postgres, Auth, Storage de imagens de produto
- **Migrations** versionadas em git, aplicadas no deploy
- **Vercel Cron** — libera reservas expiradas, reconcilia pagamentos pendentes
- **Ambientes** — `production` e `preview`, com projetos Supabase separados
- **Segredos** apenas em variáveis de ambiente; nada de chave de gateway em código
- **Domínio e SSL** configurados na Vercel

---

## 10. Corte MVP

Sem data acordada, a linha é traçada por valor e risco. Quando a data chegar, ela
move a linha; não redesenha nada.

### Não vende sem isto

Catálogo com busca e filtros; carrinho com cálculo de frete; checkout com Pix e
cartão; frete Melhor Envio e retirada em Brasília; pedido com reserva e baixa de
estoque; admin de produtos, estoque e pedidos; e-mail transacional; WhatsApp
click-to-chat; deploy em produção com domínio e SSL.

### Depois do lançamento

Emissão automática de NF-e; cupons e promoções; notificação de status por
WhatsApp Cloud API; área do cliente com histórico; boleto; avaliações de produto;
lista de desejos; relatórios avançados; recuperação de carrinho abandonado.

### Fora da Fase 1

Aplicativo próprio; agendamento de serviço móvel; motorista responsável; botão de
emergência; planos de assinatura; portal de franquia; CRM do time comercial.

---

## 11. Premissas

Estas foram assumidas, não confirmadas. Cada uma é barata de corrigir agora e
cara depois.

1. **WhatsApp** significa botão click-to-chat no produto e no carrinho, mais aviso
   de mudança de status. Não é atendimento embutido no site nem chatbot.
2. **Retirada em Brasília** é um único local, compartilhando o estoque da loja.
3. **Não há ERP** a integrar na Fase 1.
4. O cliente fornece CNPJ, dados bancários e conta de gateway antes do
   lançamento — isso é caminho crítico e não depende de código.
5. Identidade visual (logo, cores, tipografia) vem do material de marca do Zé
   Pneu; a apresentação institucional serve de referência.
