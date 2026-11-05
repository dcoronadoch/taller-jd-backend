import { Router } from "express";
import {
  createCategoryController,
  deactivateCategory,
  getCategory,
  listCategories,
  updateCategoryController,
  updateCategoryStatus,
} from "../controllers/categories.controller.js";
import { requireStaff } from "../middlewares/auth.middleware.js";

const router = Router();

// Administradores y empleados.
router.use(requireStaff);

router.get("/", listCategories);
router.get("/:id", getCategory);
router.post("/", createCategoryController);
router.put("/:id", updateCategoryController);
router.patch("/:id/status", updateCategoryStatus);
router.delete("/:id", deactivateCategory);

export default router;
