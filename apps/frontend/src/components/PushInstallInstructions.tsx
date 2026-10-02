// iPhone/iPad no Safari: push só existe com o app adicionado à tela de
// início (status `needs-install`). Usado pelo controle do perfil e pelo
// convite pós-inscrição.
export function PushInstallInstructions() {
  return (
    <div className="flex flex-col gap-1 text-sm text-slate-600">
      <p className="font-medium text-slate-700">
        Quer receber notificações no iPhone?
      </p>
      <p>
        Adicione o app à tela de início: toque em{" "}
        <span className="font-medium">Compartilhar</span> (o quadrado com a
        seta) e depois em{" "}
        <span className="font-medium">Adicionar à Tela de Início</span>. Abra o
        app pelo ícone novo, entre com sua conta e ative as notificações no seu
        perfil.
      </p>
    </div>
  );
}
