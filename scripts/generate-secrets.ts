import crypto from "node:crypto";

console.log(`JWT_SECRET=${crypto.randomBytes(48).toString("base64url")}`);
console.log(`TOKEN_ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64")}`);
console.log(`TRAY_WEBHOOK_TOKEN=${crypto.randomBytes(32).toString("base64url")}`);
