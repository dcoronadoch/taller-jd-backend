import { HttpError } from "./http-error.js";

// Entero positivo (IDs). El mensaje describe qué falló.
export function parseId(value: unknown, message: string): number {
  const n = typeof value === "number" || (typeof value === "string" && value.trim() !== "")
    ? Number(value)
    : NaN;

  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, message);
  }

  return n;
}

// Texto obligatorio, sin espacios sobrantes y con largo máximo.
export function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${label} es obligatorio.`);
  }

  const text = value.trim();

  if (text.length > max) {
    throw new HttpError(400, `${label} no puede superar los ${max} caracteres.`);
  }

  return text;
}

// Texto opcional: vacío o ausente se guarda como NULL.
export function optionalText(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== "string") {
    throw new HttpError(400, `${label} no es válido.`);
  }

  const text = value.trim();

  if (!text) return null;

  if (text.length > max) {
    throw new HttpError(400, `${label} no puede superar los ${max} caracteres.`);
  }

  return text;
}

// Estado: 1 (activo) o 0 (inactivo).
export function parseStatus(value: unknown): 0 | 1 {
  const n = typeof value === "number" || (typeof value === "string" && value.trim() !== "")
    ? Number(value)
    : NaN;

  if (n !== 0 && n !== 1) {
    throw new HttpError(400, "El estado debe ser 1 (activo) o 0 (inactivo).");
  }

  return n;
}

// Filtro opcional de la URL (?status=1). Si no viene, no filtra.
export function parseOptionalStatus(value: unknown): 0 | 1 | undefined {
  if (value === undefined || value === "") return undefined;
  return parseStatus(value);
}

// Filtro opcional por ID (?brand_id=3).
export function parseOptionalId(value: unknown, message: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  return parseId(value, message);
}

// Precio mayor que 0, máximo 2 decimales y que quepa en DECIMAL(10,2).
export function parsePrice(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (
    typeof n !== "number" ||
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 99999999.99 ||
    Math.round(n * 100) / 100 !== n
  ) {
    throw new HttpError(
      400,
      "El precio debe ser un número mayor que 0 con máximo 2 decimales."
    );
  }

  return n;
}

// Existencias: entero entre 0 y 1 000 000.
export function parseStock(value: unknown): number {
  const n = typeof value === "number" || (typeof value === "string" && value.trim() !== "")
    ? Number(value)
    : NaN;

  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
    throw new HttpError(400, "El stock debe ser un número entero mayor o igual a 0.");
  }

  return n;
}

// URL http(s) para las imágenes.
export function parseUrl(value: unknown, label: string, max = 500): string {
  const text = requireText(value, label, max);

  let valid = false;

  try {
    const url = new URL(text);
    valid = url.protocol === "http:" || url.protocol === "https:";
  } catch {
    valid = false;
  }

  if (!valid) {
    throw new HttpError(
      400,
      `${label} no es válida (debe iniciar con http:// o https://).`
    );
  }

  return text;
}

// Paginación: página mínima 1, límite entre 1 y 100 (por defecto 10).
export function parsePagination(query: Record<string, unknown>) {
  const requestedPage = Number(query.page);
  const requestedLimit = Number(query.limit);

  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 10;

  return { page, limit };
}

// Texto de búsqueda (máximo 100 caracteres).
export function parseSearch(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}
