import { prisma } from "../server/db";
import { currentMonth, daysInMonth, parseMonthKey } from "../server/utils/date";

async function main(): Promise<void> {
  const store = await prisma.trayStore.findFirst({ where: { active: true } });
  if (!store) {
    throw new Error("Conecte uma loja antes de gerar dados demonstrativos.");
  }

  const month = currentMonth();
  const parts = parseMonthKey(month);
  const maxDay = Math.min(new Date().getUTCDate(), daysInMonth(parts));

  for (let index = 1; index <= 80; index += 1) {
    const day = 1 + ((index * 7) % Math.max(1, maxDay));
    await prisma.order.upsert({
      where: {
        storeRecordId_trayOrderId: {
          storeRecordId: store.id,
          trayOrderId: `DEMO-${index}`
        }
      },
      create: {
        storeRecordId: store.id,
        trayOrderId: `DEMO-${index}`,
        orderDate: new Date(Date.UTC(parts.year, parts.month - 1, day, 12)),
        modifiedAt: new Date(),
        status: index % 8 === 0 ? "PENDENTE" : "APROVADO",
        total: 89.9 + index * 3.17,
        pointSale: "DEMONSTRAÇÃO"
      },
      update: {}
    });
  }

  await prisma.goal.upsert({
    where: { storeRecordId_year_month: { storeRecordId: store.id, year: parts.year, month: parts.month } },
    create: { storeRecordId: store.id, year: parts.year, month: parts.month, targetOrders: 150 },
    update: { targetOrders: 150 }
  });

  console.log("Dados demonstrativos criados.");
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
