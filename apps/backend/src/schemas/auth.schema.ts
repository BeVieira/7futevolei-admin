import { z } from "zod";

// Corpo (form-urlencoded) que o Google posta no `login_uri` no fluxo de
// redirect. Outros campos que ele manda (`g_csrf_token`, `select_by`, ...)
// são ignorados — a proteção do callback é o `nonce` (ver login-nonce.ts).
export const googleRedirectLoginSchema = z.object({
  credential: z.string().min(1),
});
