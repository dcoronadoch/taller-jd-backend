import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database.js";
import { HttpError } from "../utils/http-error.js";

const MAX_IMAGES_PER_PART = 10;

export interface PartInput {
  sku: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  brand_id: number;
  category_id: number;
  status?: 0 | 1;
}

export interface PartFilters {
  page: number;
  limit: number;
  search: string;
  brandId?: number;
  categoryId?: number;
  status?: 0 | 1;
}

interface PartRow extends RowDataPacket {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
  brand_id: number;
  brand: string;
  category_id: number;
  category: string;
  status: number;
  image_url?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PartImageRecord extends RowDataPacket {
  id: number;
  part_id: number;
  url: string;
  is_primary: number;
  sort_order: number;
}

// MySQL devuelve DECIMAL como texto: se convierte a número para el JSON.
const withNumericPrice = (row: PartRow) => ({ ...row, price: Number(row.price) });

// Lista paginada con marca, categoría e imagen principal.
export async function getParts(filters: PartFilters) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.search) {
    // Se escapan los comodines de LIKE para que la búsqueda sea literal.
    const escaped = filters.search.replace(/[\\%_]/g, "\\$&");

    conditions.push("(p.name LIKE ? OR p.sku LIKE ?)");
    params.push(`%${escaped}%`, `%${escaped}%`);
  }

  if (filters.brandId !== undefined) {
    conditions.push("p.brand_id = ?");
    params.push(filters.brandId);
  }

  if (filters.categoryId !== undefined) {
    conditions.push("p.category_id = ?");
    params.push(filters.categoryId);
  }

  if (filters.status !== undefined) {
    conditions.push("p.status = ?");
    params.push(filters.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.limit;

  const [rows] = await db.query<PartRow[]>(
    `SELECT
       p.id, p.sku, p.name, p.description, p.price, p.stock,
       p.brand_id, b.name AS brand,
       p.category_id, c.name AS category,
       p.status,
       (SELECT pi.url
          FROM part_images pi
         WHERE pi.part_id = p.id
         ORDER BY pi.is_primary DESC, pi.sort_order, pi.id
         LIMIT 1) AS image_url,
       p.created_at, p.updated_at
     FROM parts p
     INNER JOIN brands b ON b.id = p.brand_id
     INNER JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset]
  );

  const [counts] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM parts p
     INNER JOIN brands b ON b.id = p.brand_id
     INNER JOIN categories c ON c.id = p.category_id
     ${where}`,
    params
  );

  const total = Number(counts[0]?.total ?? 0);

  return {
    data: rows.map(withNumericPrice),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// Un repuesto con todas sus imágenes, o null si no existe.
export async function getPartById(id: number) {
  const [rows] = await db.query<PartRow[]>(
    `SELECT
       p.id, p.sku, p.name, p.description, p.price, p.stock,
       p.brand_id, b.name AS brand,
       p.category_id, c.name AS category,
       p.status, p.created_at, p.updated_at
     FROM parts p
     INNER JOIN brands b ON b.id = p.brand_id
     INNER JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows.length) return null;

  const [images] = await db.query<PartImageRecord[]>(
    `SELECT id, part_id, url, is_primary, sort_order
     FROM part_images
     WHERE part_id = ?
     ORDER BY is_primary DESC, sort_order, id`,
    [id]
  );

  return { ...withNumericPrice(rows[0]), images };
}

// La marca y la categoría deben existir y estar activas.
async function assertReferences(brandId: number, categoryId: number) {
  const [brands] = await db.query<RowDataPacket[]>(
    "SELECT status FROM brands WHERE id = ? LIMIT 1",
    [brandId]
  );

  if (!brands.length) {
    throw new HttpError(400, "La marca seleccionada no existe.");
  }

  if (Number(brands[0].status) !== 1) {
    throw new HttpError(400, "La marca seleccionada está inactiva.");
  }

  const [categories] = await db.query<RowDataPacket[]>(
    "SELECT status FROM categories WHERE id = ? LIMIT 1",
    [categoryId]
  );

  if (!categories.length) {
    throw new HttpError(400, "La categoría seleccionada no existe.");
  }

  if (Number(categories[0].status) !== 1) {
    throw new HttpError(400, "La categoría seleccionada está inactiva.");
  }
}

export async function createPart(input: PartInput) {
  await assertReferences(input.brand_id, input.category_id);

  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO parts
       (sku, name, description, price, stock, brand_id, category_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sku,
      input.name,
      input.description,
      input.price,
      input.stock,
      input.brand_id,
      input.category_id,
      input.status ?? 1,
    ]
  );

  return result.insertId;
}

export async function updatePart(id: number, input: PartInput) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT brand_id, category_id, status FROM parts WHERE id = ? LIMIT 1",
    [id]
  );

  if (!rows.length) return false;

  const current = rows[0];

  const nextStatus = input.status ?? Number(current.status);
  const reactivating = nextStatus === 1 && Number(current.status) === 0;

  // Se revisan las referencias si cambiaron o si el repuesto se reactiva
  // (un repuesto inactivo puede conservar una marca que luego se desactivó).
  if (
    reactivating ||
    input.brand_id !== Number(current.brand_id) ||
    input.category_id !== Number(current.category_id)
  ) {
    await assertReferences(input.brand_id, input.category_id);
  }

  await db.query(
    `UPDATE parts
     SET sku = ?, name = ?, description = ?, price = ?, stock = ?,
         brand_id = ?, category_id = ?, status = ?
     WHERE id = ?`,
    [
      input.sku,
      input.name,
      input.description,
      input.price,
      input.stock,
      input.brand_id,
      input.category_id,
      nextStatus,
      id,
    ]
  );

  return true;
}

// Activa o desactiva (no se borran filas: se conserva el historial).
export async function setPartStatus(id: number, status: 0 | 1) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT brand_id, category_id FROM parts WHERE id = ? LIMIT 1",
    [id]
  );

  if (!rows.length) return false;

  // Para activarlo, su marca y su categoría deben estar activas.
  if (status === 1) {
    await assertReferences(Number(rows[0].brand_id), Number(rows[0].category_id));
  }

  await db.query("UPDATE parts SET status = ? WHERE id = ?", [status, id]);

  return true;
}

/* ------------------------------ Imágenes ------------------------------ */

export async function addPartImage(
  partId: number,
  url: string,
  isPrimary: boolean,
  sortOrder: number
) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [parts] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM parts WHERE id = ? FOR UPDATE",
      [partId]
    );

    if (!parts.length) {
      await conn.rollback();
      return null;
    }

    const [counts] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM part_images WHERE part_id = ?",
      [partId]
    );

    const total = Number(counts[0].total);

    if (total >= MAX_IMAGES_PER_PART) {
      throw new HttpError(
        409,
        `Un repuesto puede tener máximo ${MAX_IMAGES_PER_PART} imágenes.`
      );
    }

    // La primera imagen siempre queda como principal.
    const makePrimary = isPrimary || total === 0;

    if (makePrimary) {
      await conn.query(
        "UPDATE part_images SET is_primary = 0 WHERE part_id = ?",
        [partId]
      );
    }

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO part_images (part_id, url, is_primary, sort_order)
       VALUES (?, ?, ?, ?)`,
      [partId, url, makePrimary ? 1 : 0, sortOrder]
    );

    await conn.commit();

    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updatePartImage(
  partId: number,
  imageId: number,
  changes: { isPrimary?: boolean; sortOrder?: number }
) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [images] = await conn.query<RowDataPacket[]>(
      "SELECT id, is_primary FROM part_images WHERE id = ? AND part_id = ? FOR UPDATE",
      [imageId, partId]
    );

    if (!images.length) {
      await conn.rollback();
      return false;
    }

    if (changes.isPrimary === true) {
      await conn.query(
        "UPDATE part_images SET is_primary = 0 WHERE part_id = ?",
        [partId]
      );
      await conn.query("UPDATE part_images SET is_primary = 1 WHERE id = ?", [
        imageId,
      ]);
    }

    if (changes.isPrimary === false && Number(images[0].is_primary) === 1) {
      throw new HttpError(
        400,
        "Para cambiar la imagen principal, marque otra imagen como principal."
      );
    }

    if (changes.sortOrder !== undefined) {
      await conn.query("UPDATE part_images SET sort_order = ? WHERE id = ?", [
        changes.sortOrder,
        imageId,
      ]);
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

export async function deletePartImage(partId: number, imageId: number) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [images] = await conn.query<RowDataPacket[]>(
      "SELECT id, is_primary FROM part_images WHERE id = ? AND part_id = ? FOR UPDATE",
      [imageId, partId]
    );

    if (!images.length) {
      await conn.rollback();
      return false;
    }

    await conn.query("DELETE FROM part_images WHERE id = ?", [imageId]);

    // Si se borró la principal, la siguiente imagen pasa a ser la principal.
    if (Number(images[0].is_primary) === 1) {
      await conn.query(
        `UPDATE part_images
         SET is_primary = 1
         WHERE part_id = ?
         ORDER BY sort_order, id
         LIMIT 1`,
        [partId]
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
