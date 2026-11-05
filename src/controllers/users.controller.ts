import type { Request, Response } from "express";
import {
  createUser,
  getActiveRoles,
  getUsers,
  setUserStatus,
  updateUser,
  type UserInput,
} from "../services/users.service.js";
import { HttpError } from "../utils/http-error.js";

const validId = (value: unknown) =>
  Number.isInteger(Number(value)) && Number(value) > 0;

// Traduce los errores de los servicios a una respuesta HTTP.
const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "El correo ya está registrado." });
  }

  console.error(error);
  return res.status(500).json({ message: fallback });
};

function validateInput(
  body: unknown,
  creating: boolean
): { input?: UserInput; message?: string } {
  if (!body || typeof body !== "object") {
    return { message: "Los datos enviados no son válidos." };
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) {
    return { message: "Ingrese un correo válido (máximo 150 caracteres)." };
  }

  // Al editar, la contraseña es opcional: vacía significa "no cambiarla".
  if ((creating || password.length > 0) && password.length < 8) {
    return { message: "La contraseña debe tener al menos 8 caracteres." };
  }

  let role_id: number | undefined;

  if (b.role_id !== undefined && b.role_id !== null && b.role_id !== "") {
    role_id = Number(b.role_id);

    if (!Number.isInteger(role_id) || role_id < 1) {
      return { message: "Seleccione un rol válido." };
    }
  } else if (creating) {
    return { message: "Seleccione un rol válido." };
  }

  const status = b.status === undefined ? undefined : Number(b.status);

  if (status !== undefined && status !== 0 && status !== 1) {
    return { message: "El estado debe ser activo o inactivo." };
  }

  return {
    input: {
      email,
      password: password || undefined,
      role_id,
      status,
    },
  };
}

export async function listUsers(req: Request, res: Response) {
  try {
    const requestedPage = Number(req.query.page);
    const requestedLimit = Number(req.query.limit);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 10;
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 100)
        : "";

    return res.status(200).json(await getUsers(page, limit, search));
  } catch (error) {
    return fail(res, error, "No fue posible consultar los usuarios.");
  }
}

export async function listRoles(_req: Request, res: Response) {
  try {
    return res.json(await getActiveRoles());
  } catch (error) {
    return fail(res, error, "No fue posible consultar los roles.");
  }
}

export async function createUserController(req: Request, res: Response) {
  const validation = validateInput(req.body, true);

  if (!validation.input) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    const created = await createUser(validation.input);

    return res.status(201).json({
      message: "Usuario creado correctamente.",
      id: created.id,
    });
  } catch (error) {
    return fail(res, error, "No fue posible crear el usuario.");
  }
}

export async function updateUserController(req: Request, res: Response) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "El ID del usuario no es válido." });
  }

  const validation = validateInput(req.body, false);

  if (!validation.input) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    const updated = await updateUser(
      Number(req.params.id),
      validation.input,
      req.authUser?.id
    );

    return updated
      ? res.json({ message: "Usuario actualizado correctamente." })
      : res.status(404).json({ message: "Usuario no encontrado." });
  } catch (error) {
    return fail(res, error, "No fue posible actualizar el usuario.");
  }
}

export async function updateUserStatus(req: Request, res: Response) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "El ID del usuario no es válido." });
  }

  const status = Number(req.body?.status);

  if (status !== 0 && status !== 1) {
    return res.status(400).json({ message: "El estado debe ser 0 o 1." });
  }

  try {
    const updated = await setUserStatus(
      Number(req.params.id),
      status as 0 | 1,
      req.authUser?.id
    );

    return updated
      ? res.json({
          message: status
            ? "Usuario activado correctamente."
            : "Usuario desactivado correctamente.",
        })
      : res.status(404).json({ message: "Usuario no encontrado." });
  } catch (error) {
    return fail(res, error, "No fue posible actualizar el estado del usuario.");
  }
}
