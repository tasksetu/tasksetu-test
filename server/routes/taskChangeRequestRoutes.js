import express from "express";
import { authenticateToken } from "../middleware/roleAuth.js";
import { TaskChangeRequestService } from "../services/taskChangeRequestService.js";
import { ActionSource } from "../modals/taskChangeRequestModal.js";

const router = express.Router();

/**
 * GET /api/task-change-requests/action/verify?token=...
 * Verify one-time token and get request details for the email action page.
 * Public endpoint (secured by one-time token).
 */
router.get("/action/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        state: "INVALID_TOKEN",
        message: "Action token is required.",
      });
    }

    const verificationResult = await TaskChangeRequestService.verifyActionToken(token);

    if (!verificationResult.valid) {
      return res.status(200).json({
        success: false,
        ...verificationResult,
      });
    }

    return res.status(200).json({
      success: true,
      ...verificationResult,
    });
  } catch (error) {
    console.error("❌ Error verifying action token:", error);
    return res.status(500).json({
      success: false,
      valid: false,
      state: "SERVER_ERROR",
      message: "An unexpected error occurred while verifying the approval link.",
    });
  }
});

/**
 * POST /api/task-change-requests/action/approve
 * Approve via one-time token from email action page.
 * Public endpoint (secured by one-time token).
 */
router.post("/action/approve", async (req, res) => {
  try {
    const { token, reason, confirmConflict } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Approval token is required.",
      });
    }

    const verification = await TaskChangeRequestService.verifyActionToken(token);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        state: verification.state,
        message: verification.message,
      });
    }

    const requestId = verification.changeRequest._id;
    const result = await TaskChangeRequestService.approveChangeRequest({
      requestId,
      approverReason: reason,
      actionSource: ActionSource.EMAIL,
      rawToken: token,
      confirmConflict: Boolean(confirmConflict),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error approving via email token:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to approve task changes.",
      conflictDetails: error.conflictDetails,
    });
  }
});

/**
 * POST /api/task-change-requests/action/reject
 * Reject via one-time token from email action page.
 * Public endpoint (secured by one-time token).
 */
router.post("/action/reject", async (req, res) => {
  try {
    const { token, reason } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Action token is required.",
      });
    }

    const verification = await TaskChangeRequestService.verifyActionToken(token);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        state: verification.state,
        message: verification.message,
      });
    }

    const requestId = verification.changeRequest._id;
    const result = await TaskChangeRequestService.rejectChangeRequest({
      requestId,
      approverReason: reason,
      actionSource: ActionSource.EMAIL,
      rawToken: token,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error rejecting via email token:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to reject task changes.",
    });
  }
});

/**
 * GET /api/task-change-requests/task/:taskId/pending
 * Get pending change request for a specific task.
 * Authenticated endpoint.
 */
router.get("/task/:taskId/pending", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const pendingRequest = await TaskChangeRequestService.getPendingRequestForTask(taskId);

    return res.status(200).json({
      success: true,
      hasPending: !!pendingRequest,
      data: pendingRequest,
    });
  } catch (error) {
    console.error("❌ Error fetching pending change request:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pending change request.",
    });
  }
});

/**
 * GET /api/task-change-requests/:id
 * Get change request details by ID.
 * Authenticated endpoint.
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const details = await TaskChangeRequestService.getChangeRequestById(id);

    if (!details || !details.request) {
      return res.status(404).json({
        success: false,
        message: "Task change request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: details.request,
      hasConflict: details.hasConflict,
      conflictingFields: details.conflictingFields,
    });
  } catch (error) {
    console.error("❌ Error fetching change request by id:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch change request.",
    });
  }
});

/**
 * POST /api/task-change-requests/:id/approve
 * Approve change request via in-app modal.
 * Authenticated endpoint.
 */
router.post("/:id/approve", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, confirmConflict } = req.body;
    const user = req.user;

    const result = await TaskChangeRequestService.approveChangeRequest({
      requestId: id,
      approverId: user.id || user._id,
      approverReason: reason,
      actionSource: ActionSource.IN_APP,
      confirmConflict: Boolean(confirmConflict),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error approving change request in-app:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to approve task changes.",
      conflictDetails: error.conflictDetails,
    });
  }
});

/**
 * POST /api/task-change-requests/:id/reject
 * Reject change request via in-app modal.
 * Authenticated endpoint.
 */
router.post("/:id/reject", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    const result = await TaskChangeRequestService.rejectChangeRequest({
      requestId: id,
      approverId: user.id || user._id,
      approverReason: reason,
      actionSource: ActionSource.IN_APP,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error rejecting change request in-app:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to reject task changes.",
    });
  }
});

export default router;
