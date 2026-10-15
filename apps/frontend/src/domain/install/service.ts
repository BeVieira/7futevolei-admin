import { BeforeInstallPromptEvent, InstallPlatform } from "./types";

// Vídeos de "como instalar" de cada sistema, servidos de `public/tutoriais/`.
// Desktop não tem: lá só aparece o botão de instalar quando o navegador
// oferece.
const TUTORIAL_VIDEOS: Partial<Record<InstallPlatform, string>> = {
  ios: "/tutoriais/instalar-iphone.mp4",
  android: "/tutoriais/instalar-android.mp4",
};

// O Chrome/Edge disparam `beforeinstallprompt` uma vez, logo no
// carregamento — muito antes de alguém abrir o convite. Guardado aqui pra o
// botão "Instalar o app" abrir o pedido nativo depois.
let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Chamado uma vez na inicialização do app (`main.tsx`).
function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

// iPadOS se identifica como Mac no user agent; o toque denuncia.
function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function getPlatform(): InstallPlatform {
  if (isIos()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

// Aberto pelo ícone da tela de início (app instalado).
function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

// O pedido nativo só pode ser usado uma vez — depois disso o navegador
// decide se dispara o evento de novo.
async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome === "accepted";
}

function tutorialVideoUrl(platform: InstallPlatform): string | null {
  return TUTORIAL_VIDEOS[platform] ?? null;
}

export const installService = {
  listenForInstallPrompt,
  isIos,
  getPlatform,
  isInstalled,
  canPromptInstall,
  promptInstall,
  tutorialVideoUrl,
};
