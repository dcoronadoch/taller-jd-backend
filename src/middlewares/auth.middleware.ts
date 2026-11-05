import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type AuthPayload = {
  id: number;
  email: string;
  role: string;
};

// Exige un JWT válido y que el rol del usuario esté entre los permitidos.
export function requireRoles(...allowedRoles: string[]) {
  const normalizedRoles = allowedRoles.map((role) => role.trim().toUpperCase());

  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({ message: "Autenticación requerida." });
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;

      if (
        !payload ||
        !Number.isInteger(payload.id) ||
        typeof payload.email !== "string" ||
        typeof payload.role !== "string"
      ) {
        return res.status(401).json({ message: "La sesión no es válida." });
      }

      const role = payload.role.trim().toUpperCase();

      if (!normalizedRoles.includes(role)) {
        return res.status(403).json({
          message: "No tiene permisos para realizar esta operación.",
        });
      }

      req.authUser = { id: payload.id, email: payload.email, role };

      return next();
    } catch {
      return res.status(401).json({
        message: "La sesión no es válida o ha expirado.",
      });
    }
  };
}

// Solo administradores.
export const requireAdmin = requireRoles("ADMIN");

// Personal del taller (administradores y empleados).
export const requireStaff = requireRoles("ADMIN", "EMPLOYEE");
