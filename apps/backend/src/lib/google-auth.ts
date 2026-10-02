import { OAuth2Client } from "google-auth-library";

export class GoogleLoginNotConfiguredError extends Error {
  constructor(message = "Login com Google não configurado no servidor") {
    super(message);
    this.name = "GoogleLoginNotConfiguredError";
  }
}

export class InvalidGoogleCredentialError extends Error {
  constructor(message = "Não foi possível validar o login com o Google") {
    super(message);
    this.name = "InvalidGoogleCredentialError";
  }
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  photoUrl: string | null;
};

const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const client = clientId ? new OAuth2Client(clientId) : null;

// Valida o ID token que o Google Identity Services entrega pro front
// (`credential`): assinatura do Google, validade e `aud` igual ao nosso
// Client ID — um token emitido pra outro app não serve aqui. Só aceita
// e-mail verificado, já que o e-mail decide quem é admin.
export async function verifyGoogleCredential(
  credential: string,
): Promise<GoogleProfile> {
  if (!client) throw new GoogleLoginNotConfiguredError();

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new InvalidGoogleCredentialError();
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new InvalidGoogleCredentialError();
  }

  const email = payload.email.toLowerCase();

  return {
    googleId: payload.sub,
    email,
    // Conta Google sem nome público: usa a parte antes do @ até o usuário
    // editar no perfil.
    name: (payload.name?.trim() || email.split("@")[0]).slice(0, 100),
    photoUrl: payload.picture ?? null,
  };
}
