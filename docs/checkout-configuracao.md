# Checkout — configuração

O checkout está pronto e funciona sem credencial nenhuma, só que limitado:
sem Mercado Pago o cliente vê "pagamento indisponível" e um botão de comprar
pelo WhatsApp; sem Melhor Envio só a retirada em Brasília aparece. Cada
credencial abaixo liga uma parte.

As variáveis já estão no `.env.local`, vazias. Em produção, as mesmas vão em
**Vercel → ze-pneu → Settings → Environment Variables**, e o site precisa de um
novo deploy para lê-las.

## 1. Mercado Pago

| Variável | Onde pegar |
|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | Mercado Pago Developers → Suas integrações → (aplicação) → Credenciais. Em desenvolvimento, a **de teste**; na Vercel de produção, a **de produção**. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Mesma aplicação → Webhooks → Configurar notificações → "Assinatura secreta". |

Na tela de Webhooks:

- **URL de produção:** `https://<domínio>/api/webhooks/mercado-pago`
  (`https://zepneu.com.br/api/webhooks/mercado-pago`)
- **Evento:** marque só **Pagamentos**.

Sem a assinatura secreta o aviso é recusado (503): não há como saber se veio
mesmo do Mercado Pago. Mesmo assim, o pedido é confirmado quando o cliente volta
do Mercado Pago para a página do pedido — a página consulta o pagamento na API.

## 2. Melhor Envio

| Variável | Valor |
|---|---|
| `MELHOR_ENVIO_TOKEN` | Melhor Envio → Integrações → Permissões de acesso → Gerar token (permissão de cálculo de frete). |
| `MELHOR_ENVIO_AMBIENTE` | `sandbox` para o token do sandbox, `producao` para o real. Um não funciona no outro. |
| `MELHOR_ENVIO_CEP_ORIGEM` | CEP de onde o pneu sai. |
| `MELHOR_ENVIO_EMAIL` | E-mail técnico de contato; a API exige no cabeçalho. |

As três últimas precisam estar preenchidas junto com o token; faltando uma, a
entrega fica indisponível.

**Atenção:** a cotação usa o **peso estimado** de cada pneu até chegar o peso
real da FARAD (ver [importacao-catalogo.md](importacao-catalogo.md)).

## 3. Rotina de expiração

`CRON_SECRET`: um valor aleatório (`openssl rand -hex 32`). Só precisa existir
na Vercel — a Vercel envia sozinha no agendamento de `vercel.json`. Pedido não
pago em 60 minutos é cancelado e o estoque volta. A mesma limpeza roda no início
de cada checkout, então o agendamento diário do plano gratuito basta.

## 4. Endereço e horário da retirada

Editáveis sem deploy, na tabela `site_settings`:

```sql
insert into site_settings (key, value, enabled) values
  ('retirada_endereco', 'SIA Trecho 3, Lote 625 — Brasília/DF', true),
  ('retirada_horario', 'Segunda a sexta, 8h às 18h. Sábado, 8h às 12h.', true)
on conflict (key) do update set value = excluded.value, enabled = true, updated_at = now();
```

(Os valores acima são exemplo.) Sem eles, a tela diz que o horário é combinado
pelo WhatsApp após o pagamento.

## 5. Testar de ponta a ponta

1. Preencha as credenciais **de teste** no `.env.local` e rode `npm run dev`.
2. Garanta estoque no SKU do teste. **O banco do `.env.local` é o mesmo da
   produção:** estoque lançado aqui coloca o pneu à venda no site publicado, e
   `npm run seed:estoque` lança em todos os SKUs de uma vez. Prefira testar
   quando o estoque real já tiver sido lançado.
3. Adicione ao carrinho, finalize, pague no sandbox com um
   [cartão de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards).
4. Ao voltar, a página `/pedido/ZP-…` deve mostrar **Pago**.

Em `localhost` o aviso automático não chega (o Mercado Pago não alcança a sua
máquina); a confirmação acontece pela volta à página do pedido.

## O que acontece por trás

Ver [specs/2026-10-05-checkout-design.md](superpowers/specs/2026-10-05-checkout-design.md).
