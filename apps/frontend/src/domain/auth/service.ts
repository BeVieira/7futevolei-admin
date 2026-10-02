import { authApi } from "./api";
import { Me } from "./types";

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

// Caminho pra voltar depois do login. Fica no `localStorage` (não em state
// do router) porque o fluxo de redirect sai do app pro Google e volta numa
// página nova.
const RETURN_PATH_STORAGE_KEY = "7futevolei:login-return-path";

// Só o pedaço da API do Google Identity Services que usamos — o script é
// carregado em runtime, não vem de pacote com tipos.
type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        ux_mode: "redirect";
        login_uri: string;
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

// Desenha o botão oficial "Fazer login com o Google" dentro de `parent`.
// `ux_mode: "redirect"` (não popup): no iPhone, o app instalado na tela de
// início roda em modo standalone, onde o popup do Google não consegue
// devolver o resultado pra janela do app. No redirect a própria página vai
// pro Google e volta com um POST pro `login_uri` (backend), que grava os
// cookies e redireciona pra /login — tudo dentro da mesma janela, então os
// cookies ficam no app instalado. Detalhes no ARCHITECTURE.md do front.
function renderGoogleSignInButton(parent: HTMLElement) {
  const gis = getGoogleIdentityServices();
  if (!gis) return;

  gis.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    ux_mode: "redirect",
    login_uri: authApi.getGoogleLoginCallbackUrl(),
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

// Aceita só caminho interno ("/algo"), nunca "//outro-site" nem URL
// absoluta — o valor passa pelo `localStorage` e vira destino de navegação.
function isSafeReturnPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
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
    case "csrf":
      return "Não foi possível confirmar o login. Tente de novo.";
    default:
      return "Não foi possível entrar com o Google. Tente de novo.";
  }
}

export const authService = {
  getMe,
  logout,
  isAdmin,
  loadGoogleSignIn,
  renderGoogleSignInButton,
  rememberLoginReturnPath,
  takeLoginReturnPath,
  loginErrorMessage,
};
