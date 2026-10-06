import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "7futevolei-admin API",
      version: "1.0.0",
      description: "API de administração de aulas do 7futevolei-admin.",
    },
    servers: [{ url: "http://localhost:3333", description: "Local" }],
    components: {
      securitySchemes: {
        cronSecret: {
          type: "http",
          scheme: "bearer",
          description:
            "Header `Authorization: Bearer <CRON_SECRET>`, exigido pelas rotas de job (/api/jobs/*) chamadas pelo cron externo.",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "access_token",
          description:
            "Cookie httpOnly setado pelo callback do login com Google, POST /api/auth/google/callback (e renovado por /api/auth/refresh). Exigido pelas rotas de usuário logado; as administrativas exigem também papel ADMIN (403 sem ele).",
        },
      },
      schemas: {
        ClassSession: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            date: { type: "string", format: "date-time" },
            startTime: { type: "string", example: "18:00" },
            endTime: { type: "string", example: "19:00" },
            classLevel: {
              type: "string",
              enum: ["Iniciante", "Intermediário", "Avançado"],
              example: "Iniciante",
            },
            capacity: { type: "integer", example: 8 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: [
            "id",
            "date",
            "startTime",
            "endTime",
            "classLevel",
            "capacity",
            "createdAt",
            "updatedAt",
          ],
        },
        Enrollment: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            classSessionId: { type: "integer", example: 1 },
            userId: {
              type: "integer",
              nullable: true,
              description: "Null quando é um convidado inscrito pelo admin.",
            },
            studentName: {
              type: "string",
              example: "Maria Silva",
              description:
                "Nome exibido: o nome atual do usuário, ou o nome do convidado.",
            },
            side: {
              type: "string",
              enum: ["LEFT", "RIGHT"],
              description: "Lado da quadra (esquerda ou direita).",
            },
            status: {
              type: "string",
              enum: ["CONFIRMED", "WAITLISTED"],
            },
            createdAt: { type: "string", format: "date-time" },
          },
          required: [
            "id",
            "classSessionId",
            "userId",
            "studentName",
            "side",
            "status",
            "createdAt",
          ],
        },
        PublicEnrollment: {
          type: "object",
          description:
            "Inscrição no detalhe público da turma: só nome exibido e lado.",
          properties: {
            id: { type: "integer", example: 1 },
            studentName: { type: "string", example: "Maria Silva" },
            side: { type: "string", enum: ["LEFT", "RIGHT"] },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["id", "studentName", "side", "createdAt"],
        },
        AdminEnrollment: {
          description:
            "Inscrição no detalhe do admin: a visão pública mais userId (null = convidado) e o comprovante.",
          allOf: [
            { $ref: "#/components/schemas/PublicEnrollment" },
            {
              type: "object",
              properties: {
                userId: { type: "integer", nullable: true },
                receipt: {
                  nullable: true,
                  allOf: [{ $ref: "#/components/schemas/Receipt" }],
                },
              },
              required: ["userId", "receipt"],
            },
          ],
        },
        Receipt: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            enrollmentId: { type: "integer", example: 1 },
            filePath: {
              type: "string",
              example:
                "https://xxxx.supabase.co/storage/v1/object/public/receipts/uuid.jpg",
            },
            mimeType: { type: "string", example: "image/jpeg" },
            status: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED"],
            },
            adminComment: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "filePath", "mimeType", "status"],
        },
        ReviewReceiptInput: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["APPROVED", "REJECTED"] },
            adminComment: {
              type: "string",
              description: "Obrigatório quando status é REJECTED.",
            },
          },
          required: ["status"],
        },
        MyEnrollment: {
          type: "object",
          properties: {
            enrollment: {
              type: "object",
              properties: {
                id: { type: "integer" },
                side: { type: "string", enum: ["LEFT", "RIGHT"] },
                status: { type: "string", enum: ["CONFIRMED", "WAITLISTED"] },
                createdAt: { type: "string", format: "date-time" },
              },
            },
            classSession: {
              type: "object",
              properties: {
                id: { type: "integer" },
                date: { type: "string", format: "date-time" },
                startTime: { type: "string", example: "18:00" },
                endTime: { type: "string", example: "19:00" },
                classLevel: { type: "string", example: "Iniciante" },
              },
            },
            receipt: {
              nullable: true,
              allOf: [{ $ref: "#/components/schemas/Receipt" }],
            },
          },
        },
        BulkCreateInput: {
          type: "object",
          description:
            "Cada timeSlot representa um horário (sempre com 1h de duração, endTime é calculado automaticamente). O array `levels` define uma quadra por posição — o tamanho do array é a quantidade de quadras naquele horário, e cada valor é o nível daquela quadra especificamente. Capacidade de cada turma é fixa em 8.",
          properties: {
            date: { type: "string", format: "date", example: "2026-08-14" },
            timeSlots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  startTime: {
                    type: "string",
                    pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
                    example: "18:00",
                  },
                  levels: {
                    type: "array",
                    description:
                      "Um nível por quadra, na ordem em que as quadras serão criadas.",
                    items: {
                      type: "string",
                      enum: ["Iniciante", "Intermediário", "Avançado"],
                    },
                    example: ["Iniciante", "Intermediário", "Avançado"],
                  },
                },
                required: ["startTime", "levels"],
              },
            },
          },
          required: ["date", "timeSlots"],
        },
        AdminEnrollInput: {
          type: "object",
          description:
            "Exatamente um entre userId (usuário cadastrado, entra no lado preferido do perfil) e guestName (convidado só pelo nome, com side obrigatório).",
          properties: {
            side: {
              type: "string",
              enum: ["LEFT", "RIGHT"],
              description:
                "Lado da quadra — só com guestName (e obrigatório nesse caso).",
            },
            userId: { type: "integer", example: 1 },
            guestName: { type: "string", example: "Maria Silva" },
          },
        },
        UserProfile: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Maria Silva" },
            email: { type: "string", example: "maria@gmail.com" },
            photoUrl: {
              type: "string",
              nullable: true,
              description: "URL da foto do Google, atualizada a cada login.",
            },
            role: { type: "string", enum: ["STUDENT", "ADMIN"] },
            preferredSide: {
              type: "string",
              enum: ["LEFT", "RIGHT"],
              nullable: true,
              description:
                "Lado da quadra em que o usuário é inscrito; null = ainda não escolheu (não pode se inscrever).",
            },
          },
          required: ["id", "name", "email", "photoUrl", "role", "preferredSide"],
        },
        UserSearchResult: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Maria Silva" },
            email: { type: "string", example: "maria@gmail.com" },
            photoUrl: { type: "string", nullable: true },
            preferredSide: {
              type: "string",
              enum: ["LEFT", "RIGHT"],
              nullable: true,
            },
          },
          required: ["id", "name", "email", "photoUrl", "preferredSide"],
        },
        UpdateMyProfileInput: {
          type: "object",
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              example: "Maria Silva",
              description: "Espaços nas pontas são removidos.",
            },
            preferredSide: {
              type: "string",
              enum: ["LEFT", "RIGHT"],
              description:
                "Lado da quadra em que o usuário é inscrito. Uma vez escolhido, só troca.",
            },
          },
          description: "Mande ao menos um dos campos.",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
