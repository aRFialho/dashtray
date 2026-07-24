import { prisma } from "../server/db";
import { exchangeAuthorizationCode } from "../server/services/tray-client";
import { syncMonth } from "../server/services/order-sync";
import { currentMonth } from "../server/utils/date";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const apiAddress = getArg("api-address") || process.env.TRAY_API_ADDRESS;
  const code = getArg("code") || process.env.TRAY_AUTH_CODE;
  const storeHost = getArg("store-host") || process.env.TRAY_STORE_HOST;

  if (!apiAddress || !code) {
    console.error("Informe --api-address e --code, ou TRAY_API_ADDRESS e TRAY_AUTH_CODE no ambiente.");
    process.exitCode = 1;
    return;
  }

  const store = await exchangeAuthorizationCode({ apiAddress, code, storeHost });
  console.log(`Loja ${store.storeId} autorizada. Sincronizando ${currentMonth()}...`);
  const result = await syncMonth(store, currentMonth());
  console.log(`Concluído: ${result.items} registros processados em ${result.pages} página(s).`);
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
