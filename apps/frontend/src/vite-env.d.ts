/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // Client ID do OAuth do Google (o mesmo GOOGLE_CLIENT_ID do backend).
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
