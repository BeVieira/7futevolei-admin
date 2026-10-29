import { useState } from "react";
import { userService } from "@domain";

type Props = {
  name: string;
  photoUrl: string | null;
  className?: string;
};

// Tom estável por pessoa, a partir do nome: a mesma pessoa tem sempre a
// mesma cor clara de fundo na inicial, e pessoas diferentes se distinguem.
function hueOf(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

// Foto do Google em círculo; sem foto (ou se ela não carregar), a inicial
// do nome. `referrerPolicy="no-referrer"`: as fotos do Google às vezes
// respondem 403 quando a requisição leva o Referer de outro site.
export function Avatar({ name, photoUrl, className = "h-8 w-8" }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = photoUrl && failedUrl !== photoUrl;
  const hue = hueOf(name);

  return showPhoto ? (
    <img
      src={photoUrl}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(photoUrl)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <span
      aria-label={name}
      style={{
        backgroundColor: `hsl(${hue} 55% 90%)`,
        color: `hsl(${hue} 45% 26%)`,
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
    >
      {userService.initialOf(name)}
    </span>
  );
}
