import type { Request, Response } from "express";
import {
  addPartImage,
  createPart,
  deletePartImage,
  getPartById,
  getParts,
  setPartStatus,
  updatePart,
  updatePartImage,
  type PartInput,
} from "../services/parts.service.js";
import { HttpError } from "../utils/http-error.js";
import { sendError } from "../utils/send-error.js";
import {
  optionalText,
  parseId,
  parseOptionalId,
  parseOptionalStatus,
  parsePagination,
  parsePrice,
  parseSearch,
  parseStatus,
  parseStock,
  parseUrl,
  requireText,
} from "../utils/validators.js";

const DUPLICATE = "Ya existe un repuesto con ese SKU.";
const NOT_FOUND = "Repuesto no encontrado.";
const IMAGE_NOT_FOUND = "Imagen no encontrada para este repuesto.";

const idOf = (req: Request) =>
  parseId(req.params.id, "El ID del repuesto no es válido.");
const imageIdOf = (req: Request) =>
  parseId(req.params.imageId, "El ID de la imagen no es válido.");

// Valida el cuerpo de POST y PUT. Todo se revisa antes de tocar la base de datos.
function readBody(body: unknown): PartInput {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }

  const b = body as Record<string, unknown>;
  const sku = requireText(b.sku, "El SKU", 40).toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) {
    throw new HttpError(
      400,
      "El SKU solo puede contener letras, números, punto, guion y guion bajo."
    );
  }

  return {
    sku,
    name: requireText(b.name, "El nombre", 150),
    description: optionalText(b.description, "La descripción", 2000),
    price: parsePrice(b.price),
    stock: parseStock(b.stock),
    brand_id: parseId(b.brand_id, "Seleccione una marca válida."),
    category_id: parseId(b.category_id, "Seleccione una categoría válida."),
    status: b.status === undefined ? undefined : parseStatus(b.status),
  };
}

// GET /api/parts?page=1&limit=10&search=&brand_id=&category_id=&status=
export async function listParts(req: Request, res: Response) {
  try {
    const query = req.query as Record<string, unknown>;

    const result = await getParts({
      ...parsePagination(query),
      search: parseSearch(query.search),
      brandId: parseOptionalId(query.brand_id, "El filtro de marca no es válido."),
      categoryId: parseOptionalId(
        query.category_id,
        "El filtro de categoría no es válido."
      ),
      status: parseOptionalStatus(query.status),
    });

    return res.json(result);
  } catch (error) {
    return sendError(res, error, "No fue posible consultar los repuestos.");
  }
}

// GET /api/parts/:id
export async function getPart(req: Request, res: Response) {
  try {
    const part = await getPartById(idOf(req));

    return part
      ? res.json(part)
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible consultar el repuesto.");
  }
}

// POST /api/parts
export async function createPartController(req: Request, res: Response) {
  try {
    const id = await createPart(readBody(req.body));

    return res.status(201).json({ message: "Repuesto creado correctamente.", id });
  } catch (error) {
    return sendError(res, error, "No fue posible crear el repuesto.", DUPLICATE);
  }
}

// PUT /api/parts/:id
export async function updatePartController(req: Request, res: Response) {
  try {
    const id = idOf(req);
    const input = readBody(req.body);

    return (await updatePart(id, input))
      ? res.json({ message: "Repuesto actualizado correctamente." })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(
      res,
      error,
      "No fue posible actualizar el repuesto.",
      DUPLICATE
    );
  }
}

// PATCH /api/parts/:id/status   { "status": 0 | 1 }
export async function updatePartStatus(req: Request, res: Response) {
  try {
    const id = idOf(req);
    const status = parseStatus(req.body?.status);

    return (await setPartStatus(id, status))
      ? res.json({
          message: status
            ? "Repuesto activado correctamente."
            : "Repuesto desactivado correctamente.",
        })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible cambiar el estado del repuesto.");
  }
}

// DELETE /api/parts/:id  (desactivación lógica: status = 0)
export async function deactivatePart(req: Request, res: Response) {
  try {
    return (await setPartStatus(idOf(req), 0))
      ? res.json({ message: "Repuesto desactivado correctamente." })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible desactivar el repuesto.");
  }
}

/* ------------------------------ Imágenes ------------------------------ */

// POST /api/parts/:id/images   { "url": "https://...", "is_primary": true, "sort_order": 0 }
export async function addPartImageController(req: Request, res: Response) {
  try {
    const partId = idOf(req);
    const b = (req.body ?? {}) as Record<string, unknown>;

    const url = parseUrl(b.url, "La URL de la imagen");
    const isPrimary = b.is_primary === true || b.is_primary === 1;
    const sortOrder =
      b.sort_order === undefined ? 0 : parseStock(b.sort_order);

    const imageId = await addPartImage(partId, url, isPrimary, sortOrder);

    return imageId === null
      ? res.status(404).json({ message: NOT_FOUND })
      : res
          .status(201)
          .json({ message: "Imagen agregada correctamente.", id: imageId });
  } catch (error) {
    return sendError(res, error, "No fue posible agregar la imagen.");
  }
}

// PATCH /api/parts/:id/images/:imageId   { "is_primary": true, "sort_order": 1 }
export async function updatePartImageController(req: Request, res: Response) {
  try {
    const partId = idOf(req);
    const imageId = imageIdOf(req);
    const b = (req.body ?? {}) as Record<string, unknown>;

    const isPrimary =
      b.is_primary === undefined
        ? undefined
        : b.is_primary === true || b.is_primary === 1;
    const sortOrder =
      b.sort_order === undefined ? undefined : parseStock(b.sort_order);

    if (isPrimary === undefined && sortOrder === undefined) {
      throw new HttpError(400, "Indique is_primary o sort_order.");
    }

    return (await updatePartImage(partId, imageId, { isPrimary, sortOrder }))
      ? res.json({ message: "Imagen actualizada correctamente." })
      : res.status(404).json({ message: IMAGE_NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible actualizar la imagen.");
  }
}

// DELETE /api/parts/:id/images/:imageId
export async function removePartImage(req: Request, res: Response) {
  try {
    return (await deletePartImage(idOf(req), imageIdOf(req)))
      ? res.json({ message: "Imagen eliminada correctamente." })
      : res.status(404).json({ message: IMAGE_NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible eliminar la imagen.");
  }
}
