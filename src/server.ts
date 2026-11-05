import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { db, describeDbError } from "./config/database.js";
import { requireAdmin } from "./middlewares/auth.middleware.js";
import { getAllRoles } from "./services/users.service.js";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import brandsRoutes from "./routes/brands.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // Permite herramientas sin Origin (curl, health checks) y, en desarrollo
      // sin FRONTEND_URLS configurado, cualquier origen local.
      if (!origin || (!env.isProduction && env.frontendUrls.length === 0)) {
        return callback(null, true);
      }

      if (env.frontendUrls.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido por la política CORS."));
    },
    credentials: false,
  })
);
app.use(express.json({ limit: "1mb" }));

// Rutas de la API.
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/brands", brandsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/catalog", catalogRoutes);

// Ruta principal.
app.get("/", (_req, res) => {
  res.json({ message: "Taller y Repuestos JD API funcionando correctamente" });
});

// Prueba de conexión con MySQL.
app.get("/api/test-db", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS resultado");

    res.json({ message: "Conexión con MySQL correcta", data: rows });
  } catch (error) {
    console.error("Error de conexión:", describeDbError(error));

    res.status(500).json({ message: "Error al conectar con MySQL" });
  }
});

// Consulta de roles (solo administradores).
app.get("/api/roles", requireAdmin, async (_req, res) => {
  try {
    res.json(await getAllRoles());
  } catch (error) {
    console.error("Error al consultar roles:", error);

    res.status(500).json({ message: "Error al consultar los roles" });
  }
});

// Ruta inexistente.
app.use((_req, res) => {
  res.status(404).json({ message: "Ruta no encontrada." });
});

// Manejo final de errores (CORS, JSON mal formado, etc.).
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const err = error as { status?: number; type?: string; message?: string };

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "El cuerpo de la solicitud no es un JSON válido." });
  }

  if (err.message === "Origen no permitido por la política CORS.") {
    return res.status(403).json({ message: err.message });
  }

  console.error(error);
  return res.status(err.status ?? 500).json({ message: "Error interno del servidor." });
});

async function start() {
  await db.query("SELECT 1 AS resultado");

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`Taller y Repuestos JD API escuchando en el puerto ${env.port}`);
  });
}

start().catch((error) => {
  console.error("No fue posible iniciar el backend:", describeDbError(error));
  process.exit(1);
});