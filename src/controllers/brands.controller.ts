import type { Request, Response } from "express";
import {
  createBrand,
  getBrandById,
  getBrands,
  setBrandStatus,
  updateBrand,
} from "../services/brands.service.js";
import { HttpError } from "../utils/http-error.js";
import { sendError } from "../utils/send-error.js";
import {
  parseId,
  parseOptionalStatus,
  parseStatus,
  requireText,
} from "../utils/validators.js";

const DUPLICATE = "Ya existe una marca con ese nombre.";
const NOT_FOUND = "Marca no encontrada.";
const idOf = (req: Request) =>
  parseId(req.params.id, "El ID de la marca no es válido.");

function readBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }

  const b = body as Record<string, unknown>;

  return {
    name: requireText(b.name, "El nombre de la marca", 80),
    status: b.status === undefined ? undefined : parseStatus(b.status),
  };
}

// GET /api/brands?status=1
export async function listBrands(req: Request, res: Response) {
  try {
    const status = parseOptionalStatus(req.query.status);
    return res.json(await getBrands(status));
  } catch (error) {
    return sendError(res, error, "No fue posible consultar las marcas.");
  }
}

// GET /api/brands/:id
export async function getBrand(req: Request, res: Response) {
  try {
    const brand = await getBrandById(idOf(req));

    return brand
      ? res.json(brand)
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible consultar la marca.");
  }
}

// POST /api/brands
export async function createBrandController(req: Request, res: Response) {
  try {
    const { name, status } = readBody(req.body);
    const id = await createBrand(name, status ?? 1);

    return res.status(201).json({ message: "Marca creada correctamente.", id });
  } catch (error) {
    return sendError(res, error, "No fue posible crear la marca.", DUPLICATE);
  }
}

// PUT /api/brands/:id
export async function updateBrandController(req: Request, res: Response) {
  try {
    const id = idOf(req);
    const { name, status } = readBody(req.body);

    return (await updateBrand(id, name, status))
      ? res.json({ message: "Marca actualizada correctamente." })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible actualizar la marca.", DUPLICATE);
  }
}

// PATCH /api/brands/:id/status   { "status": 0 | 1 }
export async function updateBrandStatus(req: Request, res: Response) {
  try {
    const id = idOf(req);
    const status = parseStatus(req.body?.status);

    return (await setBrandStatus(id, status))
      ? res.json({
          message: status
            ? "Marca activada correctamente."
            : "Marca desactivada correctamente.",
        })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible cambiar el estado de la marca.");
  }
}

// DELETE /api/brands/:id  (desactivación lógica)
export async function deactivateBrand(req: Request, res: Response) {
  try {
    return (await setBrandStatus(idOf(req), 0))
      ? res.json({ message: "Marca desactivada correctamente." })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible desactivar la marca.");
  }
}
