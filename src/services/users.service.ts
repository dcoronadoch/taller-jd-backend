import bcrypt from "bcryptjs";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { db } from "../config/database.js";
import { HttpError } from "../utils/http-error.js";

// Roles con los que se puede crear una cuenta desde el Backoffice.
// Los clientes (CUSTOMER) se registrarán desde el sitio público.
const BACKOFFICE_ROLES = ["ADMIN", "EMPLOYEE"];

export interface UserListItem extends RowDataPacket {
  id: number;
  email: string;
  role_id: number;
  role: string;
  status: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserInput {
  email: string;
  password?: string;
  role_id?: number;
  status?: number;
}

interface CurrentUser extends RowDataPacket {
  id: number;
  role_id: number;
  role: string;
  status: number;
}

// Lista paginada de usuarios con su rol. Admite búsqueda por correo o rol.
export async function getUsers(page: number, limit: number, search: string) {
  const offset = (page - 1) * limit;

  // Se escapan los comodines de LIKE para que la búsqueda sea literal.
  const escaped = search.replace(/[\\%_]/g, "\\$&");
  const where = search ? "WHERE (u.email LIKE ? OR r.name LIKE ?)" : "";
  const params = search ? [`%${escaped}%`, `%${escaped}%`] : [];

  const [rows] = await db.query<UserListItem[]>(
    `SELECT
       u.id,
       u.email,
       u.role_id,
       r.name AS role,
       u.status,
       u.created_at,
       u.updated_at
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     ${where}
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [counts] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     ${where}`,
    params
  );

  const total = Number(counts[0]?.total ?? 0);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Roles disponibles en el formulario de usuarios del Backoffice.
export async function getActiveRoles() {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, name, description
     FROM roles
     WHERE status = 1 AND UPPER(name) IN ('ADMIN', 'EMPLOYEE')
     ORDER BY name`
  );

  return rows;
}

// Todos los roles (uso exclusivo de administradores).
export async function getAllRoles() {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, name, description, status FROM roles ORDER BY id"
  );

  return rows;
}

// Devuelve el nombre (en mayúsculas) de un rol activo, o null si no existe.
async function activeRoleName(
  conn: PoolConnection,
  roleId: number
): Promise<string | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT name
     FROM roles
     WHERE id = ? AND status = 1
     LIMIT 1`,
    [roleId]
  );

  return rows.length ? String(rows[0].name).toUpperCase() : null;
}

// Reglas de seguridad para los cambios de rol o estado de una cuenta:
// - Nadie puede desactivarse ni cambiarse el rol a sí mismo.
// - Siempre debe quedar al menos un ADMIN activo.
async function assertAdminSafety(
  conn: PoolConnection,
  current: CurrentUser,
  next: { role: string; status: number },
  actorId?: number
) {
  if (
    current.id === actorId &&
    (next.status === 0 || next.role !== current.role)
  ) {
    throw new HttpError(
      400,
      "No puede desactivar su propia cuenta ni cambiar su propio rol."
    );
  }

  const wasActiveAdmin =
    current.role === "ADMIN" && Number(current.status) === 1;
  const stillActiveAdmin = next.role === "ADMIN" && next.status === 1;

  if (wasActiveAdmin && !stillActiveAdmin) {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE UPPER(r.name) = 'ADMIN'
         AND u.status = 1
         AND u.id <> ?
       FOR UPDATE`,
      [current.id]
    );

    if (Number(rows[0].total) === 0) {
      throw new HttpError(400, "Debe existir al menos un administrador activo.");
    }
  }
}

export async function createUser(input: UserInput) {
  const email = input.email.trim().toLowerCase();

  if (!email) {
    throw new HttpError(400, "El correo electrónico es obligatorio.");
  }

  if (!input.password || input.password.length < 8) {
    throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.");
  }

  if (!input.role_id) {
    throw new HttpError(400, "Seleccione un rol válido.");
  }

  const conn = await db.getConnection();

  try {
    const role = await activeRoleName(conn, input.role_id);

    if (!role) {
      throw new HttpError(400, "El rol seleccionado no existe o está inactivo.");
    }

    if (!BACKOFFICE_ROLES.includes(role)) {
      throw new HttpError(
        400,
        "Solo se pueden crear cuentas para administradores y empleados."
      );
    }

    const hash = await bcrypt.hash(input.password, 12);

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role_id, status)
       VALUES (?, ?, ?, ?)`,
      [email, hash, input.role_id, input.status ?? 1]
    );

    return {
      id: result.insertId,
      email,
      role_id: input.role_id,
      status: input.status ?? 1,
    };
  } finally {
    conn.release();
  }
}

export async function updateUser(
  id: number,
  input: UserInput,
  actorId?: number
) {
  const email = input.email.trim().toLowerCase();

  if (!email) {
    throw new HttpError(400, "El correo electrónico es obligatorio.");
  }

  if (input.password !== undefined && input.password.length < 8) {
    throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.");
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<CurrentUser[]>(
      `SELECT u.id, u.role_id, r.name AS role, u.status
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await conn.rollback();
      return false;
    }

    const current = rows[0];
    current.role = String(current.role).toUpperCase();

    // Rol nuevo (solo si se envió y es distinto al actual).
    let roleId = current.role_id;
    let roleName = current.role;

    if (input.role_id !== undefined && input.role_id !== current.role_id) {
      if (!BACKOFFICE_ROLES.includes(current.role)) {
        throw new HttpError(400, "No se puede cambiar el rol de esta cuenta.");
      }

      const newRole = await activeRoleName(conn, input.role_id);

      if (!newRole || !BACKOFFICE_ROLES.includes(newRole)) {
        throw new HttpError(
          400,
          "El rol debe ser administrador o empleado y estar activo."
        );
      }

      roleId = input.role_id;
      roleName = newRole;
    }

    const status = input.status ?? Number(current.status);

    await assertAdminSafety(
      conn,
      current,
      { role: roleName, status },
      actorId
    );

    if (input.password) {
      const hash = await bcrypt.hash(input.password, 12);

      await conn.query(
        `UPDATE users
         SET email = ?,
             password_hash = ?,
             role_id = ?,
             status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [email, hash, roleId, status, id]
      );
    } else {
      await conn.query(
        `UPDATE users
         SET email = ?,
             role_id = ?,
             status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [email, roleId, status, id]
      );
    }

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function setUserStatus(
  id: number,
  status: 0 | 1,
  actorId?: number
) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<CurrentUser[]>(
      `SELECT u.id, u.role_id, r.name AS role, u.status
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await conn.rollback();
      return false;
    }

    const current = rows[0];
    current.role = String(current.role).toUpperCase();

    await assertAdminSafety(
      conn,
      current,
      { role: current.role, status },
      actorId
    );

    await conn.query(
      `UPDATE users
       SET status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, id]
    );

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
