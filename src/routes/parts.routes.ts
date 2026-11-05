import { Router } from "express";
import {
  addPartImageController,
  createPartController,
  deactivatePart,
  getPart,
  listParts,
  removePartImage,
  updatePartController,
  updatePartImageController,
  updatePartStatus,
} from "../controllers/parts.controller.js";
import { requireStaff } from "../middlewares/auth.middleware.js";

const router = Router();

// Administradores y empleados.
router.use(requireStaff);

router.get("/", listParts);
router.get("/:id", getPart);
router.post("/", createPartController);
router.put("/:id", updatePartController);
router.patch("/:id/status", updatePartStatus);
router.delete("/:id", deactivatePart);

// Imágenes del repuesto
router.post("/:id/images", addPartImageController);
router.patch("/:id/images/:imageId", updatePartImageController);
router.delete("/:id/images/:imageId", removePartImage);

export default router;
