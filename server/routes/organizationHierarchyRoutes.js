import express from "express";
import { authenticateToken, roleAuth } from "../middleware/roleAuth.js";
import {
  createHierarchy,
  getAllHierarchies,
  getHierarchyById,
  updateHierarchy,
  deleteHierarchy,
} from "../controller/organizationHierarchyController.js";

const router = express.Router();

// Get all hierarchy entries
router.get("/", authenticateToken, roleAuth(["org_admin"]), getAllHierarchies);

// Create new hierarchy entry
router.post("/", authenticateToken, roleAuth(["org_admin"]), createHierarchy);

// Get hierarchy entry by ID
router.get("/:id", authenticateToken, roleAuth(["org_admin"]), getHierarchyById);

// Update hierarchy entry
router.put("/:id", authenticateToken, roleAuth(["org_admin"]), updateHierarchy);

// Delete hierarchy entry
router.delete("/:id", authenticateToken, roleAuth(["org_admin"]), deleteHierarchy);

export default router;
