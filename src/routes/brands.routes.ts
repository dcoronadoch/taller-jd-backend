import { Router } from "express";
import {
  createBrandController,
  deactivateBrand,
  getBrand,
  listBrands,
  updateBrandController,
  updateBrandStatus,
} from "../controllers/brands.controller.js";
import { requireStaff } from "../middlewares/auth.middleware.js";

const router = Router();

// Administradores y empleados.
router.use(requireStaff);

router.get("/", listBrands);
router.get("/:id", getBrand);
router.post("/", createBrandController);
router.put("/:id", updateBrandController);
router.patch("/:id/status", updateBrandStatus);
router.delete("/:id", deactivateBrand);

export default router;
