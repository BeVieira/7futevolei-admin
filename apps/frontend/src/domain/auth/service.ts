import { authApi } from "./api";
import { GoogleLoginClaim, Me } from "./types";

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

// Caminho pra voltar depois do login. Fica no `localStorage` (não em state
// do router) porque o fluxo de redirect sai do app pro Google e volta numa
// página nova.
const RETURN_PATH_STORAGE_KEY = "7futevolei:login-return-path";

// Segredos das tentativas de login recentes deste aparelho (ver
// `startGoogleLogin`). Guarda mais de um porque a tela pede um nonce novo de
// tempos em tempos e a pessoa pode ter clicado no botão com o anterior.
const PENDING_LOGINS_STORAGE_KEY = "7futevolei:pending-google-logins";
const MAX_PENDING_LOGINS = 3;

// Só o pedaço da API do Google Identity Services que usamos — o script é
// carregado em runtime, não vem de pacote com tipos.
type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        ux_mode: "redirect";
        login_uri: string;
        nonce: string;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "signin_with";
          shape: "pill";
          locale: string;
          width?: number;
        },
      ): void;
    };
  };
};

function getMe() {
  return authApi.getMe();
}

function logout() {
  return authApi.logout();
}

function isAdmin(me: Me | null | undefined): boolean {
  return me?.role === "ADMIN";
}

function getGoogleIdentityServices(): GoogleIdentityServices | undefined {
  return (window as Window & { google?: GoogleIdentityServices }).google;
}

let googleScriptPromise: Promise<void> | null = null;

// Carrega o script do Google uma vez só por página, mesmo que a tela de
// login monte de novo.
function loadGoogleSignIn(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(
      new Error("Login com Google não configurado (VITE_GOOGLE_CLIENT_ID)"),
    );
  }
  if (getGoogleIdentityServices()) return Promise.resolve();

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        googleScriptPromise = null;
        reject(new Error("Não foi possível carregar o login do Google"));
      };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

function readPendingLoginSecrets(): string[] {
  try {
    const raw = localStorage.getItem(PENDING_LOGINS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

function writePendingLoginSecrets(secrets: string[]) {
  try {
    if (secrets.length === 0) {
      localStorage.removeItem(PENDING_LOGINS_STORAGE_KEY);
    } else {
      localStorage.setItem(PENDING_LOGINS_STORAGE_KEY, JSON.stringify(secrets));
    }
  } catch {
    // Sem storage: o resgate não funciona, só o caminho normal (cookie).
  }
}

// Começa uma tentativa de login: o backend grava o segredo no cookie
// `login_nonce` e devolve segredo + nonce. O segredo também fica guardado
// aqui pro resgate (`claimPendingGoogleLogin`), caso o Google devolva o
// login num navegador diferente deste. Devolve o nonce pro botão.
async function startGoogleLogin(): Promise<string> {
  const { nonce, secret } = await authApi.createGoogleLoginAttempt();
  writePendingLoginSecrets(
    [secret, ...readPendingLoginSecrets()].slice(0, MAX_PENDING_LOGINS),
  );
  return nonce;
}

function hasPendingGoogleLogin(): boolean {
  return readPendingLoginSecrets().length > 0;
}

function forgetPendingGoogleLogins() {
  writePendingLoginSecrets([]);
}

// Tenta resgatar, com cada segredo guardado, um login que o callback já
// confirmou. Segredo vencido/usado sai da lista; "ainda não confirmado"
// fica pra próxima tentativa.
async function claimPendingGoogleLogin(): Promise<Me | null> {
  const remaining: string[] = [];
  let me: Me | null = null;

  for (const secret of readPendingLoginSecrets()) {
    if (me) break;
    const claim: GoogleLoginClaim = await authApi.claimGoogleLogin(secret);
    if (claim.status === "logged-in") me = claim.me;
    else if (claim.status === "pending") remaining.push(secret);
  }

  writePendingLoginSecrets(me ? [] : remaining);
  return me;
}

// Desenha o botão oficial "Fazer login com o Google" dentro de `parent`.
// `ux_mode: "redirect"` (não popup) — o porquê e o que ainda precisa ser
// validado no iPhone estão no ARCHITECTURE.md do front ("Login com
// Google"). `nonce` é o da tentativa atual (`startGoogleLogin`): o Google o
// embute no ID token e o callback confere.
function renderGoogleSignInButton(parent: HTMLElement, nonce: string) {
  const gis = getGoogleIdentityServices();
  if (!gis) return;

  gis.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    ux_mode: "redirect",
    login_uri: authApi.getGoogleLoginCallbackUrl(),
    nonce,
  });
  gis.accounts.id.renderButton(parent, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    locale: "pt-BR",
    width: Math.min(parent.clientWidth || 320, 400),
  });
}

// Aceita só caminho interno ("/algo"), nunca "//outro-site", URL absoluta
// nem barra invertida (alguns navegadores tratam "/\outro-site" como
// "//outro-site") — o valor passa pelo `localStorage` e vira destino de
// navegação.
function isSafeReturnPath(path: string | null | undefined): path is string {
  return (
    !!path &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\")
  );
}

function rememberLoginReturnPath(path: string) {
  try {
    localStorage.setItem(
      RETURN_PATH_STORAGE_KEY,
      isSafeReturnPath(path) ? path : "/",
    );
  } catch {
    // Sem storage (aba privada etc.): volta pra tela inicial depois do login.
  }
}

// Lê e apaga: o caminho só vale pra um login.
function takeLoginReturnPath(): string {
  try {
    const path = localStorage.getItem(RETURN_PATH_STORAGE_KEY);
    localStorage.removeItem(RETURN_PATH_STORAGE_KEY);
    return isSafeReturnPath(path) ? path : "/";
  } catch {
    return "/";
  }
}

// Códigos que o callback do backend devolve em `/login?erro=<código>`.
function loginErrorMessage(code: string): string {
  switch (code) {
    case "email-em-uso":
      return "Este e-mail já está vinculado a outra conta Google.";
    case "configuracao":
      return "O login com Google não está configurado no servidor.";
    case "tentativa-expirada":
      return "A tentativa de login expirou. Tente de novo.";
    default:
      return "Não foi possível entrar com o Google. Tente de novo.";
  }
}

export const authService = {
  getMe,
  logout,
  isAdmin,
  loadGoogleSignIn,
  startGoogleLogin,
  hasPendingGoogleLogin,
  forgetPendingGoogleLogins,
  claimPendingGoogleLogin,
  renderGoogleSignInButton,
  rememberLoginReturnPath,
  takeLoginReturnPath,
  loginErrorMessage,
};
