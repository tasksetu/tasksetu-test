import { OrganizationHierarchy } from "../models.js";
import { User } from "../modals/userModal.js";

// Get all hierarchy entries for an organization
export const getAllHierarchies = async (req, res) => {
  try {
    const hierarchies = await OrganizationHierarchy.find({
      organization_id: req.user.organizationId,
      status: "active",
    })
      .populate("manager", "firstName lastName email")
      .populate("reporty", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: hierarchies,
      message: "Hierarchy entries retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching hierarchies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hierarchy entries",
      error: error.message,
    });
  }
};

// Create new hierarchy entry
export const createHierarchy = async (req, res) => {
  try {
    const { managerId, reportyId, notes } = req.body;

    // Validate required fields
    if (!managerId || !reportyId) {
      return res.status(400).json({
        success: false,
        message: "Manager and Reporty are required",
      });
    }

    // Check if manager exists and is actually a manager
    const manager = await User.findOne({
      _id: managerId,
      organization_id: req.user.organizationId,
      role: { $in: ["manager"] },
    });

    if (!manager) {
      return res.status(400).json({
        success: false,
        message: "Invalid manager selected",
      });
    }

    // Check if reporty exists and is an employee
    const reporty = await User.findOne({
      _id: reportyId,
      organization_id: req.user.organizationId,
      role: { $in: ["employee"] },
    });

    if (!reporty) {
      return res.status(400).json({
        success: false,
        message: "Invalid reporty selected",
      });
    }

    // Check if this hierarchy already exists
    const existingHierarchy = await OrganizationHierarchy.findOne({
      manager: managerId,
      reporty: reportyId,
      organization_id: req.user.organizationId,
      status: "active",
    });

    if (existingHierarchy) {
      return res.status(400).json({
        success: false,
        message: "This hierarchy relationship already exists",
      });
    }

    // Create new hierarchy entry
    const newHierarchy = new OrganizationHierarchy({
      manager: managerId,
      reporty: reportyId,
      organization_id: req.user.organizationId,
      createdBy: req.user._id,
      notes: notes || "",
      status: "active",
    });

    await newHierarchy.save();

    // Populate response data
    const populatedHierarchy = await OrganizationHierarchy.findById(
      newHierarchy._id,
    )
      .populate("manager", "firstName lastName email")
      .populate("reporty", "firstName lastName email");

    res.status(201).json({
      success: true,
      data: populatedHierarchy,
      message: "Hierarchy entry created successfully",
    });
  } catch (error) {
    console.error("Error creating hierarchy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create hierarchy entry",
      error: error.message,
    });
  }
};

// Get hierarchy entry by ID
export const getHierarchyById = async (req, res) => {
  try {
    const hierarchy = await OrganizationHierarchy.findOne({
      _id: req.params.id,
      organization_id: req.user.organizationId,
      status: "active",
    })
      .populate("manager", "firstName lastName email")
      .populate("reporty", "firstName lastName email");

    if (!hierarchy) {
      return res.status(404).json({
        success: false,
        message: "Hierarchy entry not found",
      });
    }

    res.json({
      success: true,
      data: hierarchy,
      message: "Hierarchy entry retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching hierarchy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hierarchy entry",
      error: error.message,
    });
  }
};

// Update hierarchy entry
export const updateHierarchy = async (req, res) => {
  try {
    const { managerId, reportyId, notes, status } = req.body;

    // Find existing hierarchy
    const hierarchy = await OrganizationHierarchy.findOne({
      _id: req.params.id,
      organization_id: req.user.organizationId,
      status: "active",
    });

    if (!hierarchy) {
      return res.status(404).json({
        success: false,
        message: "Hierarchy entry not found",
      });
    }

    // Validate new manager if provided
    if (managerId) {
      const manager = await User.findOne({
        _id: managerId,
        organization_id: req.user.organizationId,
        role: { $in: ["manager"] },
      });

      if (!manager) {
        return res.status(400).json({
          success: false,
          message: "Invalid manager selected",
        });
      }
    }

    // Validate new reporty if provided
    if (reportyId) {
      const reporty = await User.findOne({
        _id: reportyId,
        organization_id: req.user.organizationId,
        role: { $in: ["employee"] },
      });

      if (!reporty) {
        return res.status(400).json({
          success: false,
          message: "Invalid reporty selected",
        });
      }
    }

    // Check for duplicates if manager or reporty changed
    if (managerId && reportyId) {
      const existingHierarchy = await OrganizationHierarchy.findOne({
        _id: { $ne: req.params.id },
        manager: managerId,
        reporty: reportyId,
        organization_id: req.user.organizationId,
        status: "active",
      });

      if (existingHierarchy) {
        return res.status(400).json({
          success: false,
          message: "This hierarchy relationship already exists",
        });
      }
    }

    // Update hierarchy
    const updatedHierarchy = await OrganizationHierarchy.findByIdAndUpdate(
      req.params.id,
      {
        manager: managerId || hierarchy.manager,
        reporty: reportyId || hierarchy.reporty,
        notes: notes !== undefined ? notes : hierarchy.notes,
        status: status !== undefined ? status : hierarchy.status,
      },
      { new: true },
    );

    // Populate response data
    const populatedHierarchy = await OrganizationHierarchy.findById(
      updatedHierarchy._id,
    )
      .populate("manager", "firstName lastName email")
      .populate("reporty", "firstName lastName email");

    res.json({
      success: true,
      data: populatedHierarchy,
      message: "Hierarchy entry updated successfully",
    });
  } catch (error) {
    console.error("Error updating hierarchy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update hierarchy entry",
      error: error.message,
    });
  }
};

// Delete hierarchy entry
export const deleteHierarchy = async (req, res) => {
  try {
    // Find existing hierarchy
    const hierarchy = await OrganizationHierarchy.findOne({
      _id: req.params.id,
      organization_id: req.user.organizationId,
    });

    if (!hierarchy) {
      return res.status(404).json({
        success: false,
        message: "Hierarchy entry not found",
      });
    }

    // Soft delete by setting status to inactive
    await OrganizationHierarchy.findByIdAndUpdate(req.params.id, {
      status: "inactive",
    });

    res.json({
      success: true,
      message: "Hierarchy entry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting hierarchy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete hierarchy entry",
      error: error.message,
    });
  }
};
