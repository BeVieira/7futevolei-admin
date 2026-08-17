import { prisma } from "../lib/prisma";
import { enrollStudent } from "../lib/enrollment-service";

async function main() {
  const classSession = await prisma.classSession.create({
    data: {
      date: new Date(),
      startTime: "09:00",
      endTime: "10:00",
      classLevel: "Teste",
      capacity: 4, // 2 vagas por lado
    },
  });

  const names = ["Ana", "Bruno", "Carla"];

  for (const name of names) {
    const result = await enrollStudent(classSession.id, name, "LEFT");
    console.log(`${name}: ${result.enrollment.status}`);
  }

  await prisma.classSession.delete({ where: { id: classSession.id } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
