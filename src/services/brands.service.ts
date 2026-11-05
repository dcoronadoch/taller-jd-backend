import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database.js";
import { HttpError } from "../utils/http-error.js";

export interface BrandRecord extends RowDataPacket {
  id: number;
  name: string;
  status: number;
  created_at: Date;
  updated_at: Date;
}

const BRAND_COLUMNS = "id, name, status, created_at, updated_at";

// Lista de marcas (opcionalmente solo activas o solo inactivas).
export async function getBrands(status?: 0 | 1) {
  const where = status === undefined ? "" : "WHERE status = ?";

  const [rows] = await db.query<BrandRecord[]>(
    `SELECT ${BRAND_COLUMNS} FROM brands ${where} ORDER BY name`,
    status === undefined ? [] : [status]
  );

  return rows;
}

export async function getBrandById(id: number) {
  const [rows] = await db.query<BrandRecord[]>(
    `SELECT ${BRAND_COLUMNS} FROM brands WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

export async function createBrand(name: string, status: 0 | 1 = 1) {
  const [result] = await db.query<ResultSetHeader>(
    "INSERT INTO brands (name, status) VALUES (?, ?)",
    [name, status]
  );

  return result.insertId;
}

// Una marca no se puede desactivar mientras tenga repuestos activos.
async function assertNoActiveParts(brandId: number) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM parts WHERE brand_id = ? AND status = 1",
    [brandId]
  );

  if (Number(rows[0].total) > 0) {
    throw new HttpError(
      409,
      "No se puede desactivar la marca porque tiene repuestos activos."
    );
  }
}

export async function updateBrand(id: number, name: string, status?: 0 | 1) {
  const current = await getBrandById(id);

  if (!current) return false;

  const nextStatus = status ?? Number(current.status);

  if (nextStatus === 0 && Number(current.status) === 1) {
    await assertNoActiveParts(id);
  }

  await db.query("UPDATE brands SET name = ?, status = ? WHERE id = ?", [
    name,
    nextStatus,
    id,
  ]);

  return true;
}

export async function setBrandStatus(id: number, status: 0 | 1) {
  const current = await getBrandById(id);

  if (!current) return false;

  if (status === 0 && Number(current.status) === 1) {
    await assertNoActiveParts(id);
  }

  await db.query("UPDATE brands SET status = ? WHERE id = ?", [status, id]);

  return true;
}
