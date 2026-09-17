import crypto from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Secret key (não a publishable): esse client roda só no backend e precisa
// de acesso total ao bucket pra gravar/apagar em nome de qualquer aluno,
// sem depender de RLS — é o mesmo papel que a antiga `service_role` key
// tinha, no sistema de API keys novo do Supabase.
const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "receipts";

// Nome aleatório em vez de `enrollment-{id}-{timestamp}`: o link do
// comprovante é servido sem autenticação (o aluno vê o próprio sem login),
// então o nome do objeto é o único segredo que impede alguém de
// enumerar/adivinhar o comprovante de outro aluno pelo id sequencial.
export async function uploadReceiptObject(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string> {
  const key = `${crypto.randomUUID()}${path.extname(originalName)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: mimeType });

  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

// Best-effort: se o objeto já não existir ou a remoção falhar, ignora — não
// deve bloquear o envio do novo comprovante que está sobrescrevendo este.
export async function deleteReceiptObject(url: string): Promise<void> {
  const key = url.split(`/${BUCKET}/`).pop();
  if (!key) return;

  await supabase.storage
    .from(BUCKET)
    .remove([key])
    .catch(() => undefined);
}
