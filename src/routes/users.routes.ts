import { Router } from "express";
import {
  createUserController,
  listRoles,
  listUsers,
  updateUserController,
  updateUserStatus,
} from "../controllers/users.controller.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Toda la gestión de usuarios es exclusiva de administradores.
router.use(requireAdmin);

router.get("/roles", listRoles);
router.get("/", listUsers);
router.post("/", createUserController);
router.put("/:id", updateUserController);
router.patch("/:id/status", updateUserStatus);

export default router;
