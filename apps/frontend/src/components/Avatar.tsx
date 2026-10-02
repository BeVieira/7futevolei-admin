import { useState } from "react";
import { userService } from "@domain";

type Props = {
  name: string;
  photoUrl: string | null;
  className?: string;
};

// Foto do Google em círculo; sem foto (ou se ela não carregar), a inicial
// do nome. `referrerPolicy="no-referrer"`: as fotos do Google às vezes
// respondem 403 quando a requisição leva o Referer de outro site.
export function Avatar({ name, photoUrl, className = "h-8 w-8" }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = photoUrl && failedUrl !== photoUrl;

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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-teal-500 font-semibold text-white ${className}`}
    >
      {userService.initialOf(name)}
    </span>
  );
}
