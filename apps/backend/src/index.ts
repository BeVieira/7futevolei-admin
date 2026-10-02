import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./lib/swagger";
import { authRouter } from "./routes/auth.routes";
import { classSessionRouter } from "./routes/class-session.routes";
import { enrollmentRouter } from "./routes/enrollment.routes";
import { jobRouter } from "./routes/job.routes";
import { pushRouter } from "./routes/push.routes";
import { userRouter } from "./routes/user.routes";
import { startReceiptReminderInterval } from "./lib/receipt-reminders";

const app = express();
const port = process.env.PORT ?? 3333;

// Quantos proxies confiáveis existem entre o usuário e o Express — o
// `req.ip` (usado pelos rate limits de login e de push) é lido do
// X-Forwarded-For pulando exatamente esse número de saltos. Errar pra menos
// faz todo mundo "ter o IP do proxy" (o limite vira global); errar pra mais
// deixa o cliente forjar o próprio IP no header. Em dev é 0 (o proxy do
// Vite não manda X-Forwarded-For). Em produção o valor depende da cadeia
// rewrite da Vercel → proxies do Render — ver TRUST_PROXY_HOPS no
// .env.example e no DEPLOY.md.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

// Em dev o front acessa a API via proxy do Vite (mesma origem), então
// CORS_ORIGIN fica vazio e nada externo é liberado. Em produção, setar
// pra origem pública do front (ou lista separada por vírgula).
const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  }),
);
// CSP desligada: o Swagger UI em /docs depende de script/style inline, que a
// CSP padrão do helmet bloqueia. Os demais headers (HSTS, X-Frame-Options,
// nosniff etc.) continuam ativos.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/class-sessions", classSessionRouter);
app.use("/api/enrollments", enrollmentRouter);
app.use("/api/push", pushRouter);
app.use("/api/users", userRouter);
app.use("/api/jobs", jobRouter);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Backend rodando em http://localhost:${port}`);
  console.log(`Documentação Swagger em http://localhost:${port}/docs`);
  startReceiptReminderInterval();
});
