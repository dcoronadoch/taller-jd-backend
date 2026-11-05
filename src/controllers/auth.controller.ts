import type { Request, Response } from "express";
import { InvalidCredentialsError, loginUser } from "../services/auth.service.js";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      message: "Email y contraseña son obligatorios",
    });
  }

  try {
    const result = await loginUser(email, password);

    return res.status(200).json({
      message: "Login exitoso",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    console.error("Error en login:", error);

    return res.status(500).json({
      message: "No fue posible iniciar sesión. Intente de nuevo.",
    });
  }
}
