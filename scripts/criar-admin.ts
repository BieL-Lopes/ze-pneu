import { criarUsuario } from "@/db/usuarios-do-painel";
import { gerarSenhaProvisoria } from "@/core/admin/senha";

/**
 * Cria o primeiro acesso ao painel — os demais são criados pelo próprio
 * painel, em Usuários.
 *
 * A senha é gerada aqui e mostrada uma vez no terminal; não passa por
 * argumento de linha de comando, que fica gravado no histórico do shell.
 */
async function main() {
  const [email, ...nome] = process.argv.slice(2);
  if (!email || nome.length === 0) {
    console.error('Uso: npm run admin:criar -- email@dominio.com "Nome Completo"');
    process.exit(1);
  }

  const senha = gerarSenhaProvisoria();
  const r = await criarUsuario({ email, nome: nome.join(" "), papel: "admin", senha });
  if (!r.ok) {
    console.error(r.error);
    process.exit(1);
  }

  console.log(`Administrador ${email} criado.`);
  console.log(`Senha provisória: ${senha}`);
  console.log("Entre em /admin/entrar e troque a senha em “Minha conta”.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
