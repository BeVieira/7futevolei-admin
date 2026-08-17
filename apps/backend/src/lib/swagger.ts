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
            studentName: { type: "string", example: "Maria Silva" },
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
            "studentName",
            "side",
            "status",
            "createdAt",
          ],
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
        EnrollInput: {
          type: "object",
          properties: {
            studentName: { type: "string", example: "Maria Silva" },
            side: {
              type: "string",
              enum: ["LEFT", "RIGHT"],
              description: "Lado da quadra (esquerda ou direita).",
            },
          },
          required: ["studentName", "side"],
        },
        CancelInput: {
          type: "object",
          properties: {
            studentName: { type: "string", example: "Maria Silva" },
          },
          required: ["studentName"],
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
