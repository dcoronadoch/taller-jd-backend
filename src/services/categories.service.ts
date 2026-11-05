import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database.js";
import { HttpError } from "../utils/http-error.js";

export interface CategoryRecord extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  status: number;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryInput {
  name: string;
  description: string | null;
  status?: 0 | 1;
}

const CATEGORY_COLUMNS = "id, name, description, status, created_at, updated_at";

// Lista de categorías (opcionalmente solo activas o solo inactivas).
export async function getCategories(status?: 0 | 1) {
  const where = status === undefined ? "" : "WHERE status = ?";

  const [rows] = await db.query<CategoryRecord[]>(
    `SELECT ${CATEGORY_COLUMNS} FROM categories ${where} ORDER BY name`,
    status === undefined ? [] : [status]
  );

  return rows;
}

export async function getCategoryById(id: number) {
  const [rows] = await db.query<CategoryRecord[]>(
    `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

export async function createCategory(input: CategoryInput) {
  const [result] = await db.query<ResultSetHeader>(
    "INSERT INTO categories (name, description, status) VALUES (?, ?, ?)",
    [input.name, input.description, input.status ?? 1]
  );

  return result.insertId;
}

// Una categoría no se puede desactivar mientras tenga repuestos activos.
async function assertNoActiveParts(categoryId: number) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM parts WHERE category_id = ? AND status = 1",
    [categoryId]
  );

  if (Number(rows[0].total) > 0) {
    throw new HttpError(
      409,
      "No se puede desactivar la categoría porque tiene repuestos activos."
    );
  }
}

export async function updateCategory(id: number, input: CategoryInput) {
  const current = await getCategoryById(id);

  if (!current) return false;

  const nextStatus = input.status ?? Number(current.status);

  if (nextStatus === 0 && Number(current.status) === 1) {
    await assertNoActiveParts(id);
  }

  await db.query(
    "UPDATE categories SET name = ?, description = ?, status = ? WHERE id = ?",
    [input.name, input.description, nextStatus, id]
  );

  return true;
}

export async function setCategoryStatus(id: number, status: 0 | 1) {
  const current = await getCategoryById(id);

  if (!current) return false;

  if (status === 0 && Number(current.status) === 1) {
    await assertNoActiveParts(id);
  }

  await db.query("UPDATE categories SET status = ? WHERE id = ?", [status, id]);

  return true;
}
