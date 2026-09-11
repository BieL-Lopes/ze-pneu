type Props = {
  mensagem: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Click-to-chat. Não renderiza nada se o número não estiver configurado —
 * melhor não ter o botão do que ter um botão que abre uma conversa vazia.
 */
export function WhatsAppLink({ mensagem, children, className }: Props) {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO;
  if (!numero) return null;

  const href = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
