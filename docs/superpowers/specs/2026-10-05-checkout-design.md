# Checkout — Documento de Design

Data: 2026-10-05. Aprovado em conversa com o Gabriel.

Fecha a entrega **Checkout** do contrato e, junto, o que ela arrasta:
pagamento (Mercado Pago), cotação de frete (Melhor Envio) e retirada em
Brasília. Segue o desenho geral de
[2026-09-10-ecommerce-fase1-design.md](2026-09-10-ecommerce-fase1-design.md).

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Pagamento | Mercado Pago **Checkout Pro** (redireciona) | Escolha do cliente. Pix e cartão parcelado sem tocar dado de cartão. |
| Frete | Melhor Envio, cotação real por CEP | O cliente tem conta. Uma integração cobre várias transportadoras. |
| Retirada | Opção gratuita, endereço e horário em `site_settings` | Muda sem deploy. |
| Cadastro | Não exige conta | Exigir cadastro derruba conversão. |
| CPF | Obrigatório | Nota fiscal e declaração de conteúdo do envio exigem. |
| Etiqueta | Fora desta etapa | A operação compra a etiqueta no painel do Melhor Envio. |

## Jornada

1. Carrinho → **Finalizar compra** → `/checkout`.
2. Dados: nome, e-mail, WhatsApp, CPF.
3. Recebimento: **Retirar em Brasília** (grátis) ou **Entregar** — CEP, endereço
   preenchido pelo ViaCEP, opções do Melhor Envio com transportadora, prazo e
   valor.
4. Resumo e **Pagar com Mercado Pago**. O cliente paga lá e volta.
5. `/pedido/ZP-XXXXXXXX?t=<token>` mostra o status. O token é secreto e
   aleatório: a referência sozinha é curta e adivinhável, e a página mostra
   nome e endereço do comprador.

## Fluxo no servidor

Ao pagar, o servidor não confia em nada vindo do navegador:

1. Expira pedidos vencidos (ver abaixo) — assim o estoque preso por checkout
   abandonado volta antes de ser disputado.
2. Relê o carrinho e os preços vigentes.
3. Recota o frete e procura o serviço escolhido pelo id. Se sumiu, devolve
   erro e pede nova escolha — nunca usa o preço que veio do formulário.
4. Reserva o estoque do pedido inteiro, válida por **60 minutos**.
5. Cria o pedido `aguardando_pagamento` com itens, preços e frete congelados.
6. Cria a cobrança no Mercado Pago com `external_reference` = referência do
   pedido, expiração do Pix em **30 minutos** e boleto excluído (não cabe na
   janela da reserva).
7. Se a cobrança falhar, cancela o pedido e libera a reserva.

A expiração da cobrança (30 min) é menor que a da reserva (60 min) de
propósito: o pagamento não consegue ser aprovado depois que o pneu já voltou
para a prateleira.

## Confirmação do pagamento

`POST /api/webhooks/mercado-pago`:

1. Valida `x-signature` (HMAC-SHA256 de
   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com a chave secreta).
   Assinatura inválida → 401.
2. Consulta o pagamento na API pelo id — o corpo da notificação não é fonte
   da verdade.
3. Grava o pagamento em `payments` (upsert pelo id do provedor).
4. **Aprovado**: troca `aguardando_pagamento → pago` com `UPDATE ... WHERE
   status = 'aguardando_pagamento'`. Só quem vence esse update consome a
   reserva e esvazia o carrinho — notificação repetida ou simultânea não baixa
   estoque duas vezes.
5. **Recusado / cancelado**: nada. O cliente pode tentar outro meio na mesma
   cobrança; se desistir, a expiração cuida.
6. **Estornado / chargeback** de pedido pago: `estornado`.
7. Aprovado para pedido já cancelado: registra evento pedindo estorno manual e
   loga erro. Não deve acontecer pela regra dos 30/60 minutos, mas o caso é
   tratado em vez de ignorado.

## Expiração

Pedido `aguardando_pagamento` com `expires_at` vencido → `cancelado`, reserva
liberada. Roda no início de cada checkout e numa rotina agendada
(`/api/cron/expirar-pedidos`, protegida por `CRON_SECRET`). A execução no
checkout existe porque o plano gratuito da Vercel só agenda uma vez por dia.

## Modelo

`orders` ganha: `access_token`, `delivery_method` (`retirada` | `entrega`),
endereço de entrega, serviço e transportadora do frete, prazo,
`cart_token`, `payment_url`, `expires_at`.

`payments`: um registro por pagamento do provedor, com status e valor.

## Frete e dimensões

Dimensões da caixa passam a sair da medida (diâmetro externo × largura), em
vez de 64×64×21 cm para todo pneu. O peso continua estimado até a FARAD
enviar o real — a cotação usa esse peso.

## Configuração

| Variável | Uso |
|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | Criar cobrança e consultar pagamento |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Validar a assinatura do aviso |
| `MELHOR_ENVIO_TOKEN` | Cotação |
| `MELHOR_ENVIO_AMBIENTE` | `sandbox` ou `producao` |
| `MELHOR_ENVIO_CEP_ORIGEM` | CEP de onde o pneu sai |
| `MELHOR_ENVIO_EMAIL` | Contato exigido no User-Agent da API |
| `CRON_SECRET` | Protege a rotina de expiração |

Sem credencial, o checkout não quebra: a entrega aparece indisponível e o
pagamento devolve erro com link para o WhatsApp.

## Fora desta etapa

Compra automática de etiqueta, e-mail transacional, painel administrativo,
aviso de status por WhatsApp, NF-e.

## Testes

- Unidade: CPF, CEP, referência, dimensões, serviço de checkout e de
  confirmação com portas falsas, adaptadores com `fetch` simulado (assinatura,
  corpo da cobrança, leitura da cotação).
- Integração (Postgres real): criação do pedido; duas confirmações
  simultâneas do mesmo pagamento baixam o estoque uma vez só; expiração
  cancela e devolve o estoque.
