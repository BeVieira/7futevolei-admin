import "dotenv/config";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./lib/swagger";
import { authRouter } from "./routes/auth.routes";
import { classSessionRouter } from "./routes/class-session.routes";
import { enrollmentRouter } from "./routes/enrollment.routes";

const app = express();
const port = process.env.PORT ?? 3333;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRouter);
app.use("/api/class-sessions", classSessionRouter);
app.use("/api/enrollments", enrollmentRouter);

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
});
