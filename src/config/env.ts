import "dotenv/config";

// Variables obligatorias. DB_PASSWORD puede ir vacía en un entorno local.
const required = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"] as const;
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Faltan variables en el archivo .env: ${missing.join(", ")}. ` +
      "Copie .env.example a .env y complete los datos."
  );
}

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET as string;

if (isProduction && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción.");
}

export const env = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD ?? "",
    name: process.env.DB_NAME as string,
  },
  jwtSecret,
  frontendUrls: (process.env.FRONTEND_URLS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
