import { Router } from "express";
import {
  getCatalogPart,
  listCatalogParts,
} from "../controllers/catalog.controller.js";

const router = Router();

// Rutas públicas de solo lectura para el Front Office (no requieren token).
// La administración sigue en /api/parts, /api/brands y /api/categories (protegidas).
router.get("/parts", listCatalogParts);
router.get("/parts/:id", getCatalogPart);

export default router;
