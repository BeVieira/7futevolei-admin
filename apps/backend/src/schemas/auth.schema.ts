import { z } from "zod";

export const googleLoginSchema = z.object({
  credential: z.string().min(1),
});

// Corpo (form-urlencoded) que o Google posta no `login_uri` no fluxo de
// redirect. Outros campos que ele manda (`select_by`, ...) são ignorados.
export const googleRedirectLoginSchema = z.object({
  credential: z.string().min(1),
  g_csrf_token: z.string().min(1),
});
