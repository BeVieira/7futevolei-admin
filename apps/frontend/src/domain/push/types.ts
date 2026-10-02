// Estado das notificações neste aparelho/navegador:
// - unsupported: navegador sem Web Push.
// - needs-install: iPhone/iPad no Safari — push só existe com o app
//   instalado na tela de início (iOS 16.4+).
// - denied: usuário bloqueou; só dá pra reverter nas configurações do navegador.
export type PushStatus =
  "unsupported" | "needs-install" | "denied" | "disabled" | "enabled";
