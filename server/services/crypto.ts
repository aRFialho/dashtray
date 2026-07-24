import crypto from "node:crypto";
import { env } from "../config/env";

function getKey(): Buffer {
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.");
  }
  return key;
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, ivText, tagText, dataText] = payload.split(".");
  if (version !== "v1" || !ivText || !tagText || !dataText) {
    throw new Error("Token criptografado em formato inválido.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataText, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
