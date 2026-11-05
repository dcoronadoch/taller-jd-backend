import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database.js";
import { env } from "../config/env.js";

interface UserRecord extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  role_id: number;
  status: number;
  role: string;
}

// Error para credenciales incorrectas o cuenta inactiva (responde 401).
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Credenciales inválidas");
    this.name = "InvalidCredentialsError";
  }
}

// Hash de relleno: se compara aunque el correo no exista, para que el
// tiempo de respuesta no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync("contrasena-de-relleno", 10);

export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const [rows] = await db.query<UserRecord[]>(
    `
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.role_id,
      u.status,
      r.name AS role
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE u.email = ?
    LIMIT 1
    `,
    [normalizedEmail]
  );

  const user = rows[0];

  const passwordValid = await bcrypt.compare(
    password,
    user ? user.password_hash : DUMMY_HASH
  );

  if (!user || !passwordValid || Number(user.status) !== 1) {
    throw new InvalidCredentialsError();
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: "2h" }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}
