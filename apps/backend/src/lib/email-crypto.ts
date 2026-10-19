import crypto from "node:crypto";

// O e-mail do usuário não fica em texto no banco. Vai em duas formas, cada
// uma com a sua chave secreta (só no env do backend):
//
// - `emailHash` — HMAC-SHA256 (`EMAIL_HASH_KEY`). Determinístico (mesmo
//   e-mail → mesmo hash), então serve pra comparar: conta Google repetida
//   (índice único), papel de admin (`ADMIN_EMAILS`) e busca exata do
//   admin. HMAC em vez de SHA-256 puro: e-mail tem pouca entropia, e quem
//   pegasse um dump do banco conseguiria testar listas de e-mails contra
//   um hash sem chave.
// - `emailEncrypted` — AES-256-GCM (`EMAIL_ENCRYPTION_KEY`), com IV
//   aleatório. Só serve pra **mostrar** o e-mail de volta (perfil); por ser
//   diferente a cada gravação, não dá pra buscar nem indexar por ele.
//
// Chaves separadas: vazar uma não entrega a outra. Trocar qualquer uma
// invalida o que já está gravado: cada conta se corrige sozinha no próximo
// login (o upsert regrava as duas a partir do e-mail que vem do Google),
// mas até lá admin perde o papel na renovação (hash) e o perfil fica sem
// e-mail (criptografia). Não troque sem necessidade.

function readKey(name: string): Buffer {
  const key = process.env[name];
  if (!key) {
    throw new Error(`${name} não configurado`);
  }
  const bytes = Buffer.from(key, "hex");
  if (bytes.length !== 32 || bytes.toString("hex") !== key.toLowerCase()) {
    throw new Error(`${name} precisa ser 32 bytes em hex (openssl rand -hex 32)`);
  }
  return bytes;
}

const EMAIL_HASH_KEY = readKey("EMAIL_HASH_KEY");
const EMAIL_ENCRYPTION_KEY = readKey("EMAIL_ENCRYPTION_KEY");

const CIPHER = "aes-256-gcm";
const IV_BYTES = 12;
// Prefixo de versão no valor gravado: permite trocar o formato/algoritmo
// depois sem ambiguidade sobre o que já está no banco.
const FORMAT_VERSION = "v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Normaliza antes de hashear (o Google já devolve em minúsculas, mas
// `ADMIN_EMAILS` e a busca do admin são digitados à mão).
export function hashEmail(email: string): string {
  return crypto
    .createHmac("sha256", EMAIL_HASH_KEY)
    .update(normalizeEmail(email))
    .digest("hex");
}

// `v1:<iv>:<tag>:<texto cifrado>`, cada parte em base64.
export function encryptEmail(email: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER, EMAIL_ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalizeEmail(email), "utf8"),
    cipher.final(),
  ]);
  return [FORMAT_VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map(part => (typeof part === "string" ? part : part.toString("base64")))
    .join(":");
}

// `null` se o valor não decifra (chave trocada, valor corrompido): quem
// chama mostra o perfil sem e-mail em vez de derrubar a requisição.
export function decryptEmail(value: string): string | null {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== FORMAT_VERSION || !iv || !tag || !ciphertext) return null;

  try {
    const decipher = crypto.createDecipheriv(
      CIPHER,
      EMAIL_ENCRYPTION_KEY,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
