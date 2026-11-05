import type { Request, Response } from "express";
import {
  getCatalogPartById,
  getCatalogParts,
} from "../services/catalog.service.js";
import { sendError } from "../utils/send-error.js";
import { parseId } from "../utils/validators.js";

// GET /api/catalog/parts
export async function listCatalogParts(_req: Request, res: Response) {
  try {
    return res.json(await getCatalogParts());
  } catch (error) {
    return sendError(res, error, "No fue posible consultar el catálogo.");
  }
}

// GET /api/catalog/parts/:id
export async function getCatalogPart(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id, "El ID del repuesto no es válido.");
    const part = await getCatalogPartById(id);

    return part
      ? res.json(part)
      : res.status(404).json({ message: "Repuesto no encontrado." });
  } catch (error) {
    return sendError(res, error, "No fue posible consultar el repuesto.");
  }
}
