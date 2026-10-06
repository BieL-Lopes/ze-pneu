# Painel administrativo

Endereço: `/admin` (ex.: `https://ze-pneu.vercel.app/admin`). Fora do Google
(`robots.txt` e `noindex`).

## Primeiro acesso

O primeiro administrador é criado pelo terminal; os demais, pelo próprio
painel em **Usuários**.

```bash
npm run admin:criar -- email@dominio.com "Nome Completo"
```

O comando mostra uma senha provisória uma única vez. Entre em `/admin/entrar`
e troque em **Minha conta**.

## Papéis

| Área | Operador | Administrador |
|---|---|---|
| Resumo (vendas, mais vendidos, sem estoque) | ✓ | ✓ |
| Pedidos — status, rastreio, nota fiscal, aviso por WhatsApp | ✓ | ✓ |
| Estoque — entrada, ajuste com motivo, extrato | ✓ | ✓ |
| Produtos — cadastro, medidas, preços, fotos, planilha | | ✓ |
| Frete e loja — manuseio, frete grátis, retirada, faixa da home | | ✓ |
| Usuários | | ✓ |

## O que acontece por trás

- **Pedidos.** Os botões oferecem só as transições válidas para o tipo de
  recebimento (entrega → enviado; retirada → pronto para retirada). "Pago" não
  é marcado à mão: é a confirmação do Mercado Pago que baixa o estoque.
  Cancelar pedido não pago devolve a reserva; cancelar pedido pago com o pneu
  ainda na loja devolve ao estoque (movimento "Devolução"), uma vez só. O
  estorno do dinheiro é feito no painel do Mercado Pago — o pedido registra o
  lembrete.
- **Aviso por WhatsApp.** O botão abre a conversa com o cliente já com a
  mensagem do status e o link de acompanhamento; o operador só envia. Envio
  automático (WhatsApp Cloud API) exige conta Business verificada e modelos
  aprovados pela Meta — fica para depois do lançamento.
- **Estoque.** Entrada e ajuste exigem motivo e gravam o autor. O ajuste não
  deixa o físico ficar abaixo do que está reservado em checkout aberto.
- **Frete.** O prazo de manuseio soma ao prazo da transportadora; o frete
  grátis zera só a opção mais barata. As regras valem na cotação e no
  fechamento da compra, então o cliente paga o que viu.
- **Acesso.** Senha com scrypt; sessão em banco, cookie httpOnly de 12 horas.
  Cinco senhas erradas seguidas travam o usuário por 15 minutos. Trocar a
  senha, gerar nova senha ou desativar o usuário encerra as sessões abertas.
- **Fotos.** Entram por endereço https (as fotos atuais vêm do site da
  Aptany). Envio de arquivo direto do computador exige um armazenamento de
  imagens (Supabase Storage ou Vercel Blob), ainda não configurado.
