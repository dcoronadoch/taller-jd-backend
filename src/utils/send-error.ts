import type { Response } from "express";
import { HttpError } from "./http-error.js";

// Traduce un error (de validación, de MySQL o inesperado) a una respuesta HTTP.
// Nunca devuelve detalles internos del servidor ni de la base de datos.
export function sendError(
  res: Response,
  error: unknown,
  fallback: string,
  duplicateMessage = "Ya existe un registro con esos datos."
) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  const code = (error as { code?: string })?.code;

  if (code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: duplicateMessage });
  }

  if (code === "ER_NO_REFERENCED_ROW_2") {
    return res
      .status(400)
      .json({ message: "Una de las referencias indicadas no existe." });
  }

  console.error(error);
  return res.status(500).json({ message: fallback });
}
