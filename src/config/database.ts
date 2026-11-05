import mysql from "mysql2/promise";
import { env } from "./env.js";

// Pool de conexiones compartido por todos los servicios.
export const db = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  charset: "utf8mb4",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Convierte los errores más comunes de MySQL en mensajes entendibles.
export function describeDbError(error: unknown): string {
  const err = error as { code?: string; message?: string };

  switch (err?.code) {
    case "ECONNREFUSED":
      return "No se pudo conectar con MySQL. Verifique que el servicio esté iniciado y que DB_HOST y DB_PORT sean correctos.";
    case "ER_ACCESS_DENIED_ERROR":
      return "MySQL rechazó el usuario o la contraseña. Revise DB_USER y DB_PASSWORD en el archivo .env.";
    case "ER_BAD_DB_ERROR":
      return `La base de datos "${env.db.name}" no existe. Ejecute primero el script SQL.`;
    default:
      return err?.message ?? "Error desconocido al consultar la base de datos.";
  }
}
