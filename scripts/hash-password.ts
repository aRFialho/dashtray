import bcrypt from "bcryptjs";

async function main(): Promise<void> {
  const password = process.argv.slice(2).join(" ");
  if (!password) {
    console.error('Uso: npm run admin:hash -- "sua-senha-forte"');
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  console.log(hash);
}

void main();
