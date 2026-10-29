import { useState } from "react";
import { Button, Modal } from "@components";
import {
  ClassSessionSummary,
  InstallPlatform,
  installService,
  usePromptInstall,
} from "@domain";
import { formatDateLabel } from "@utils";

type Props = {
  session: ClassSessionSummary;
  guestName: string;
  // Lado cheio na hora da inscrição: entrou na lista de espera.
  waitlisted: boolean;
  onLogin: () => void;
  onClose: () => void;
};

// Texto do passo a passo de cada sistema, ao lado do vídeo.
const INSTALL_STEPS: Record<InstallPlatform, string> = {
  ios: "No Safari, toque em Compartilhar (o quadrado com a seta) e depois em “Adicionar à Tela de Início”.",
  android:
    "No Chrome, toque nos três pontinhos (⋮) e depois em “Instalar app” ou “Adicionar à tela inicial”.",
  desktop: "",
};

// O que a conta dá a mais que a inscrição como convidado.
const ACCOUNT_BENEFITS = [
  "Aviso no celular na hora em que você sai da lista de espera",
  "Inscrição em 1 toque, sem digitar nome e lado toda vez",
  "Comprovante enviado pelo app, com lembrete",
  "Todas as suas aulas num lugar só",
];

// Mostrado ao convidado logo depois de se inscrever sem conta (no máximo uma
// vez a cada 24h — ver `authService.takeSignupInvite`): confirma a vaga e
// puxa pra criar a conta com o Google e instalar o app.
export function SignupInviteModal({
  session,
  guestName,
  waitlisted,
  onLogin,
  onClose,
}: Props) {
  const [showVideo, setShowVideo] = useState(false);
  const promptInstallMutation = usePromptInstall();

  const platform = installService.getPlatform();
  const videoUrl = installService.tutorialVideoUrl(platform);
  const canPromptInstall =
    installService.canPromptInstall() && !promptInstallMutation.isSuccess;
  // Já aberto pelo ícone, ou num computador sem botão de instalar: não há
  // o que ensinar.
  const showInstall =
    !installService.isInstalled() &&
    (canPromptInstall || platform !== "desktop");
  const firstName = guestName.trim().split(/\s+/)[0];

  return (
    <Modal
      title={waitlisted ? "Você está na lista de espera" : "Vaga garantida!"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink">
          {firstName}, sua inscrição na turma{" "}
          <span className="font-medium">{session.classLevel}</span> de{" "}
          {formatDateLabel(session.date)} às {session.startTime}{" "}
          {waitlisted ? "entrou na lista de espera." : "está confirmada."}
        </p>

        <div className="flex flex-col gap-2.5 rounded-md bg-accent-soft p-4">
          <p className="text-sm font-semibold text-accent-ink">
            {waitlisted
              ? "Mas... se abrir uma vaga, como você vai ficar sabendo?"
              : "Mas... como convidado, você está jogando no modo difícil"}
          </p>
          <ul className="flex flex-col gap-1.5 text-sm text-ink">
            {ACCOUNT_BENEFITS.map(benefit => (
              <li key={benefit} className="flex gap-2.5">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mark"
                  aria-hidden="true"
                />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <Button type="button" onClick={onLogin} className="sm:w-full">
            Criar minha conta com o Google
          </Button>
          <p className="text-center text-xs text-muted">
            Leva 10 segundos — sua vaga continua garantida.
          </p>
        </div>

        {showInstall && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink">
              E deixe o app na tela de início
            </p>
            {promptInstallMutation.data === true ? (
              // O Android pode passar por uma verificação de segurança
              // (Play Protect) antes de o ícone aparecer.
              <div className="flex flex-col gap-1 rounded-md bg-accent-soft p-3 text-sm text-ink">
                <p className="font-medium text-accent-ink">
                  Instalando o app!
                </p>
                <p>
                  Se aparecer uma verificação de segurança do Google, toque em
                  continuar e confirme a instalação.
                </p>
                <p>
                  Depois, procure o ícone da 7Futevôlei na tela de início do
                  celular e abra o app por ele.
                </p>
              </div>
            ) : canPromptInstall ? (
              <Button
                type="button"
                variant="outline"
                className="sm:w-full"
                disabled={promptInstallMutation.isPending}
                onClick={() => promptInstallMutation.mutate()}
              >
                Instalar o app
              </Button>
            ) : (
              <>
                <p className="text-sm text-muted">
                  {INSTALL_STEPS[platform]}
                </p>
                {platform === "ios" && (
                  <p className="text-xs text-muted">
                    No iPhone, o app não compartilha o login com o Safari: abra
                    pelo ícone novo e entre com o Google por lá.
                  </p>
                )}
                {videoUrl &&
                  (showVideo ? (
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      muted
                      playsInline
                      className="max-h-[60vh] w-full rounded-md bg-ink"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowVideo(true)}
                      className="text-action self-start text-accent-ink"
                    >
                      Ver o vídeo de como instalar
                    </button>
                  ))}
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="py-1 text-center text-sm text-muted hover:text-ink"
        >
          Agora não, continuar como convidado
        </button>
      </div>
    </Modal>
  );
}
