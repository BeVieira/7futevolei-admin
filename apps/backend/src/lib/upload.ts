import { NextFunction, Request, Response } from "express";
import multer from "multer";

const receiptUpload = multer({
  // Em memória em vez de disco: o arquivo é enviado pro Supabase Storage
  // logo em seguida (ver src/lib/storage.ts), não fica persistido localmente.
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isAllowed =
      file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";

    if (!isAllowed) {
      cb(new Error("Arquivo deve ser imagem ou PDF"));
      return;
    }
    cb(null, true);
  },
}).single("file");

// Multer chama `next(err)` sozinho em vez de rejeitar uma Promise, então
// não passa pelo `asyncHandler` — sem esse wrapper, um arquivo grande ou de
// tipo inválido cairia no error handler global e voltaria 500 em vez de 400.
export function uploadReceiptFile(req: Request, res: Response, next: NextFunction) {
  receiptUpload(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : "Upload inválido";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}
