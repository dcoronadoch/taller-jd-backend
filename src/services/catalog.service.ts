import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database.js";

// Catálogo PÚBLICO (Front Office): solo lectura y solo registros visibles.
// Un repuesto se publica únicamente si él, su marca y su categoría están activos.
// No expone datos internos (estado, fechas, cantidad exacta en inventario).

interface CatalogRow extends RowDataPacket {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: string | number;
  available: number;
  brand: string;
  category: string;
  image_url: string | null;
}

interface CatalogImageRow extends RowDataPacket {
  id: number;
  url: string;
  is_primary: number;
}

const MAX_CATALOG_ITEMS = 500;

const CATALOG_SELECT = `
  SELECT
    p.id, p.sku, p.name, p.description, p.price,
    (p.stock > 0) AS available,
    b.name AS brand,
    c.name AS category,
    (SELECT pi.url
       FROM part_images pi
      WHERE pi.part_id = p.id
      ORDER BY pi.is_primary DESC, pi.sort_order, pi.id
      LIMIT 1) AS image_url
  FROM parts p
  INNER JOIN brands b ON b.id = p.brand_id AND b.status = 1
  INNER JOIN categories c ON c.id = p.category_id AND c.status = 1
`;

const toPublicPart = (row: CatalogRow) => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  available: Number(row.available) === 1,
  brand: row.brand,
  category: row.category,
  image_url: row.image_url,
});

export async function getCatalogParts() {
  const [rows] = await db.query<CatalogRow[]>(
    `${CATALOG_SELECT} WHERE p.status = 1 ORDER BY p.id LIMIT ?`,
    [MAX_CATALOG_ITEMS]
  );

  return rows.map(toPublicPart);
}

export async function getCatalogPartById(id: number) {
  const [rows] = await db.query<CatalogRow[]>(
    `${CATALOG_SELECT} WHERE p.status = 1 AND p.id = ? LIMIT 1`,
    [id]
  );

  if (!rows.length) return null;

  const [images] = await db.query<CatalogImageRow[]>(
    `SELECT id, url, is_primary
     FROM part_images
     WHERE part_id = ?
     ORDER BY is_primary DESC, sort_order, id`,
    [id]
  );

  return {
    ...toPublicPart(rows[0]),
    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      is_primary: Number(image.is_primary) === 1,
    })),
  };
}
