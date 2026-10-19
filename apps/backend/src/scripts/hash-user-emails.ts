import "dotenv/config";
import { prisma } from "../lib/prisma";
import { encryptEmail, hashEmail } from "../lib/email-crypto";

// Converte contas criadas antes do hash: grava `emailHash` e
// `emailEncrypted` a partir do `email` em texto e apaga o `email`. Idempotente (só pega quem ainda tem
// `email`), uma conta por update — se cair no meio, é só rodar de novo.
//
// Precisa da MESMA `EMAIL_HASH_KEY` e `EMAIL_ENCRYPTION_KEY` do backend do
// ambiente, senão os hashes não batem e o perfil não consegue decifrar. `--dry-run` só conta e confere
// colisões, sem gravar nada.
//
//   DATABASE_URL=... EMAIL_HASH_KEY=... EMAIL_ENCRYPTION_KEY=... pnpm tsx src/scripts/hash-user-emails.ts --dry-run
async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const users = await prisma.user.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, emailHash: true },
  });

  console.log(`${users.length} conta(s) com e-mail em texto.`);

  // Dois e-mails que só diferem em maiúsculas/espaços viram o mesmo hash e
  // quebrariam o índice único — melhor descobrir antes de gravar.
  const seen = new Map<string, number>();
  for (const user of users) {
    const hash = hashEmail(user.email!);
    const other = seen.get(hash);
    if (other !== undefined) {
      throw new Error(`Usuários #${other} e #${user.id} têm o mesmo e-mail normalizado`);
    }
    seen.set(hash, user.id);
  }

  if (dryRun) {
    console.log("--dry-run: nada gravado.");
    return;
  }

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailHash: hashEmail(user.email!),
        emailEncrypted: encryptEmail(user.email!),
        email: null,
      },
    });
  }

  const remaining = await prisma.user.count({ where: { email: { not: null } } });
  console.log(`Convertidas: ${users.length}. Restando com e-mail em texto: ${remaining}.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
