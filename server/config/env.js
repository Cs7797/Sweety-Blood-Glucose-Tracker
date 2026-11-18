import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters");
}

const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535");
}

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const url = new URL(clientUrl);

if (!["http:", "https:"].includes(url.protocol) || url.origin !== clientUrl) {
  throw new Error("CLIENT_URL must be an HTTP or HTTPS origin without a trailing slash");
}

export { port, clientUrl };
