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
        <p className="text-sm text-slate-700">
          {firstName}, sua inscrição na turma{" "}
          <span className="font-medium">{session.classLevel}</span> de{" "}
          {formatDateLabel(session.date)} às {session.startTime}{" "}
          {waitlisted ? "entrou na lista de espera." : "está confirmada."}
        </p>

        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-slate-800">
            {waitlisted
              ? "Mas... se abrir uma vaga, como você vai ficar sabendo?"
              : "Mas... como convidado, você está jogando no modo difícil"}
          </p>
          <ul className="flex flex-col gap-1 text-sm text-slate-700">
            <li>
              🔔 Aviso no celular na hora em que você sai da lista de espera
            </li>
            <li>⚡ Inscrição em 1 toque, sem digitar nome e lado toda vez</li>
            <li>🧾 Comprovante enviado pelo app, com lembrete</li>
            <li>📅 Todas as suas aulas num lugar só</li>
          </ul>
        </div>

        <div className="flex flex-col gap-1">
          <Button type="button" onClick={onLogin} className="sm:w-full">
            Criar minha conta com o Google
          </Button>
          <p className="text-center text-xs text-slate-500">
            Leva 10 segundos — sua vaga continua garantida.
          </p>
        </div>

        {showInstall && (
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-800">
              📲 E deixe o app na tela de início
            </p>
            {promptInstallMutation.data === true ? (
              // O Android pode passar por uma verificação de segurança
              // (Play Protect) antes de o ícone aparecer.
              <div className="flex flex-col gap-1 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-800">
                  Instalando o app! ✅
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
                <p className="text-sm text-slate-600">
                  {INSTALL_STEPS[platform]}
                </p>
                {platform === "ios" && (
                  <p className="text-xs text-slate-500">
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
                      className="max-h-[60vh] w-full rounded-lg bg-slate-900"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowVideo(true)}
                      className="self-start text-sm font-medium text-teal-500 underline"
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
          className="text-center text-xs text-slate-400 hover:text-slate-600"
        >
          Agora não, continuar como convidado
        </button>
      </div>
    </Modal>
  );
}
