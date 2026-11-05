import type { Request, Response } from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  setCategoryStatus,
  updateCategory,
  type CategoryInput,
} from "../services/categories.service.js";
import { HttpError } from "../utils/http-error.js";
import { sendError } from "../utils/send-error.js";
import {
  optionalText,
  parseId,
  parseOptionalStatus,
  parseStatus,
  requireText,
} from "../utils/validators.js";

const DUPLICATE = "Ya existe una categoría con ese nombre.";
const NOT_FOUND = "Categoría no encontrada.";
const idOf = (req: Request) =>
  parseId(req.params.id, "El ID de la categoría no es válido.");

function readBody(body: unknown): CategoryInput {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }

  const b = body as Record<string, unknown>;

  return {
    name: requireText(b.name, "El nombre de la categoría", 80),
    description: optionalText(b.description, "La descripción", 255),
    status: b.status === undefined ? undefined : parseStatus(b.status),
  };
}

// GET /api/categories?status=1
export async function listCategories(req: Request, res: Response) {
  try {
    const status = parseOptionalStatus(req.query.status);
    return res.json(await getCategories(status));
  } catch (error) {
    return sendError(res, error, "No fue posible consultar las categorías.");
  }
}

// GET /api/categories/:id
export async function getCategory(req: Request, res: Response) {
  try {
    const category = await getCategoryById(idOf(req));

    return category
      ? res.json(category)
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible consultar la categoría.");
  }
}

// POST /api/categories
export async function createCategoryController(req: Request, res: Response) {
  try {
    const id = await createCategory(readBody(req.body));

    return res
      .status(201)
      .json({ message: "Categoría creada correctamente.", id });
  } catch (error) {
    return sendError(res, error, "No fue posible crear la categoría.", DUPLICATE);
  }
}

// PUT /api/categories/:id
export async function updateCategoryController(req: Request, res: Response) {
  try {
    const id = idOf(req);
    const input = readBody(req.body);

    return (await updateCategory(id, input))
      ? res.json({ message: "Categoría actualizada correctamente." })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(
      res,
      error,
      "No fue posible actualizar la categoría.",
      DUPLICATE
    );
  }
}

// PATCH /api/categories/:id/status   { "status": 0 | 1 }
export async function updateCategoryStatus(req: Request, res: Response) {
  try {
    const id = idOf(req);
    const status = parseStatus(req.body?.status);

    return (await setCategoryStatus(id, status))
      ? res.json({
          message: status
            ? "Categoría activada correctamente."
            : "Categoría desactivada correctamente.",
        })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(
      res,
      error,
      "No fue posible cambiar el estado de la categoría."
    );
  }
}

// DELETE /api/categories/:id  (desactivación lógica)
export async function deactivateCategory(req: Request, res: Response) {
  try {
    return (await setCategoryStatus(idOf(req), 0))
      ? res.json({ message: "Categoría desactivada correctamente." })
      : res.status(404).json({ message: NOT_FOUND });
  } catch (error) {
    return sendError(res, error, "No fue posible desactivar la categoría.");
  }
}
