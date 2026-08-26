import express from "express";
import { authenticateToken } from "../auth.js";
import {
  getOrgUsers,
  getOrgForms,
  getProcessTemplates,
  getProcessTemplateById,
  createProcessTemplate,
  updateProcessTemplate,
  deleteProcessTemplate,
  startProcessInstance,
  getProcessInstances,
} from "./processBuilderController.js";

const router = express.Router();

// Require authentication for all Process Builder endpoints
router.use(authenticateToken);

// Org Metadata for process builder
router.get("/users", getOrgUsers);
router.get("/forms", getOrgForms);

// Process Templates CRUD
router.get("/processes", getProcessTemplates);
router.get("/processes/:id", getProcessTemplateById);
router.post("/processes", createProcessTemplate);
router.put("/processes/:id", updateProcessTemplate);
router.delete("/processes/:id", deleteProcessTemplate);

// Process Launch & Active Instance tracking
router.post("/start", startProcessInstance);
router.post("/instances", startProcessInstance); // Alias
router.get("/instances", getProcessInstances);

export default router;
