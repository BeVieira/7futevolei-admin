import { authApi } from "./api";
import { Me } from "./types";

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

// Caminho pra voltar depois do login. Fica no `localStorage` (não em state
// do router) porque o fluxo de redirect sai do app pro Google e volta numa
// página nova.
const RETURN_PATH_STORAGE_KEY = "7futevolei:login-return-path";

// Convite "crie sua conta" mostrado ao convidado depois de se inscrever sem
// conta: no máximo uma vez a cada 18h por aparelho. Cookie (e não
// `localStorage`) porque o `max-age` já faz a flag vencer sozinha.
const SIGNUP_INVITE_COOKIE = "7futevolei_signup_invite";
const SIGNUP_INVITE_MAX_AGE_SECONDS = 18 * 60 * 60;

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

// Começa uma tentativa de login: o backend grava o segredo no cookie
// httpOnly `login_nonce` (inacessível daqui) e devolve só o nonce, que vai
// pro botão.
async function startGoogleLogin(): Promise<string> {
  const { nonce } = await authApi.createGoogleLoginAttempt();
  return nonce;
}

// Desenha o botão oficial "Fazer login com o Google" dentro de `parent`.
// `ux_mode: "redirect"` (não popup) — o porquê e o que ainda precisa ser
// validado no iPhone estão no ARCHITECTURE.md do front ("Login com
// Google"). `nonce` é o da tentativa atual (`startGoogleLogin`): o Google o
// embute no ID token e o callback confere contra o cookie deste navegador.
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

// Lê e marca: diz se o convite pode aparecer agora e, se sim, já grava o
// cookie — o próximo só depois de 24h, tenha ele aceitado ou fechado.
function takeSignupInvite(): boolean {
  const alreadyShown = document.cookie
    .split("; ")
    .some(cookie => cookie.startsWith(`${SIGNUP_INVITE_COOKIE}=`));
  if (alreadyShown) return false;

  document.cookie = `${SIGNUP_INVITE_COOKIE}=1; max-age=${SIGNUP_INVITE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
  return true;
}

// Códigos que o callback do backend devolve em `/login?erro=<código>`.
function loginErrorMessage(code: string): string {
  switch (code) {
    case "email-em-uso":
      return "Este e-mail já está vinculado a outra conta Google.";
    case "configuracao":
      return "O login com Google não está configurado no servidor.";
    // O callback não achou, neste navegador, o cookie da tentativa: ela
    // venceu (10 min), já foi usada, ou o Google voltou em outro navegador.
    case "tentativa-expirada":
      return "Não foi possível concluir o login neste navegador — a tentativa expirou ou o Google abriu em outro navegador. Toque no botão de novo.";
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
  renderGoogleSignInButton,
  rememberLoginReturnPath,
  takeLoginReturnPath,
  takeSignupInvite,
  loginErrorMessage,
};
