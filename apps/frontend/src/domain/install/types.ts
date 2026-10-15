// Sistema do aparelho, pra mostrar o tutorial de instalação certo.
export type InstallPlatform = "ios" | "android" | "desktop";

// `beforeinstallprompt` (Chrome/Edge/Android) não está nos tipos do DOM:
// só o pedaço que usamos.
export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
