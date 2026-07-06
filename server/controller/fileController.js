import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import { storage } from '../mongodb-storage.js';
import * as r2Storage from '../services/r2Storage.js';
import Task from '../modals/taskModal.js';
import { User } from '../modals/userModal.js';

// Configure multer for file uploads
const multerStorage = r2Storage.isR2Enabled()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.resolve(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf', '.docx', '.xlsx', '.pptx', '.zip'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: JPG, PNG, PDF, DOCX, XLSX, PPTX, ZIP'), false);
  }
};

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: fileFilter
});

// Helper: resolve file path across environments (handles absolute path mismatch)
const resolveFilePath = (file) => {
  // 1. Try the stored absolute path directly (same environment)
  if (file.path) {
    const directPath = path.resolve(file.path);
    if (fs.existsSync(directPath)) {
      return directPath;
    }
  }

  // 2. Try to extract relative portion from stored path
  if (file.path) {
    const uploadsIdx = file.path.replace(/\\/g, '/').indexOf('uploads/');
    if (uploadsIdx !== -1) {
      const relativePart = file.path.replace(/\\/g, '/').substring(uploadsIdx);
      const reconstructed = path.join(process.cwd(), relativePart);
      if (fs.existsSync(reconstructed)) {
        return reconstructed;
      }
    }
  }

  // 3. Try uploads/task-attachments/<filename>
  if (file.filename) {
    const taskAttPath = path.join(process.cwd(), 'uploads', 'task-attachments', file.filename);
    if (fs.existsSync(taskAttPath)) {
      return taskAttPath;
    }
  }

  // 4. Try uploads/<filename>
  if (file.filename) {
    const uploadsPath = path.join(process.cwd(), 'uploads', file.filename);
    if (fs.existsSync(uploadsPath)) {
      return uploadsPath;
    }
  }

  // None found
  return null;
};

// Permission checking function - aligned with task viewing permissions
// Anyone who can view a task can also view its attachments
const checkFilePermission = async (userId, userRole, taskId, action) => {
  // Get task details
  const task = await Task.findById(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  // Handle both single role string and role array
  const roles = Array.isArray(userRole) ? userRole : [userRole];

  // Helper to extract ID from populated or plain field
  const getIdFromField = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (field._id) return field._id.toString();
    if (field.id) return field.id.toString();
    if (field.toString) return field.toString();
    return null;
  };

  const normalizedUserId = userId?.toString();
  const taskCreatedById = getIdFromField(task.createdBy);
  const taskAssignedToId = getIdFromField(task.assignedTo);

  const isTaskCreator = taskCreatedById === normalizedUserId;
  const isTaskAssignee = taskAssignedToId === normalizedUserId;

  const isCollaborator = task.collaborators?.some(c => getIdFromField(c) === normalizedUserId);
  const isContributor = task.contributors?.some(c => getIdFromField(c) === normalizedUserId);

  // Check if user is designated as an approver for this task
  const isApprover = (task.approvers || []).some((approver) => {
    const approverId = (approver && typeof approver === "object")
      ? (approver._id?.toString() || approver.id?.toString())
      : approver?.toString();
    return approverId === normalizedUserId;
  });

  console.log('🔐 checkFilePermission:', {
    userId: normalizedUserId, roles, taskId, action,
    isTaskCreator, isTaskAssignee, isCollaborator, isContributor, isApprover
  });

  // Platform admins - full access
  if (roles.includes('tasksetu-admin') || roles.includes('super-admin') || roles.includes('Super Admin')) {
    console.log('✅ File permission granted: Platform Admin');
    return true;
  }

  // Org / Company admins - full access
  if (roles.includes('org_admin') || roles.includes('company-admin') || roles.includes('Company Admin') || roles.includes('admin')) {
    console.log('✅ File permission granted: Org Admin');
    return true;
  }

  // Approver - full access to attachments/files
  if (isApprover) {
    console.log('✅ File permission granted: User is an approver');
    return true;
  }

  // Manager - own tasks + subordinate tasks + tagged as collaborator/contributor
  if (roles.includes('Manager') || roles.includes('manager')) {
    if (isTaskAssignee || isTaskCreator) {
      console.log('✅ File permission granted: Manager own task');
      return true;
    }
    // Subordinate task
    const hasEmployeeCreator = Array.isArray(task.createdByRole)
      ? task.createdByRole.includes('employee')
      : task.createdByRole === 'employee';

    if (task.assignedToRole === 'employee' || hasEmployeeCreator) {
      console.log('✅ File permission granted: Manager subordinate task');
      return true;
    }
    if (isCollaborator || isContributor) {
      console.log('✅ File permission granted: Manager tagged as collaborator/contributor');
      return true;
    }
  }

  // Employee / normal-user - own tasks + tagged as collaborator/contributor
  if (roles.includes('Employee') || roles.includes('employee') || roles.includes('normal-user') || roles.includes('user')) {
    if (isTaskAssignee || isTaskCreator) {
      console.log('✅ File permission granted: Employee own task');
      return true;
    }
    if (isCollaborator || isContributor) {
      console.log('✅ File permission granted: Employee tagged as collaborator/contributor');
      return true;
    }
  }

  // Individual - creator/assignee/collaborator/contributor
  if (roles.includes('Individual') || roles.includes('individual')) {
    if (isTaskCreator || isTaskAssignee || isCollaborator || isContributor) {
      console.log('✅ File permission granted: Individual user with task access');
      return true;
    }
    console.log('❌ File permission denied: Individual user not authorized');
    return false;
  }

  // Viewer - view only
  if ((roles.includes('Viewer') || roles.includes('viewer')) && action === 'view') {
    console.log('✅ File permission granted: Viewer access');
    return true;
  }

  console.log('❌ File permission denied: No matching role or conditions');
  return false;
};

// Get files for a task
const getTaskFiles = async (req, res) => {
  try {
    console.log('📁 GET FILES REQUEST:', {
      taskId: req.params.taskId,
      userId: req.user?.id,
      userRole: req.user?.role
    });

    const { taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'view');
    console.log('📁 FILES VIEW PERMISSION:', hasPermission);
    
    if (!hasPermission) {/* Lines 96-100 omitted */}

    const task = await Task.findById(taskId);
    
    console.log('📁 TASK FOUND:', {
      taskId,
      taskExists: !!task,
      attachmentsCount: task?.attachments?.length || 0
    });
    
    if (!task) {/* Lines 105-109 omitted */}

    // Get files (non-deleted)
    const files = task.attachments || [];
    const activeFiles = files.filter(file => !file.deleted);

    console.log('📁 FILES RETRIEVED:', {
      totalFiles: files.length,
      activeFiles: activeFiles.length
    });

    // Populate uploadedBy user details
    for (let file of activeFiles) {
      if (file.uploadedBy) {
        const user = await User.findById(file.uploadedBy).select('name email');
        file.uploadedBy = user;
      }
    }

    res.json({
      success: true,
      data: activeFiles
    });

  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files'
    });
  }
};

// Upload file to task
const uploadFile = async (req, res) => {
  try {
    console.log('📤 FILE UPLOAD REQUEST:', {
      taskId: req.params.taskId,
      userId: req.user?.id,
      userRole: req.user?.role,
      hasFile: !!req.file,
      fileName: req.file?.originalname
    });

    const { taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'upload');
    console.log('📤 FILE UPLOAD PERMISSION:', hasPermission);
    
    if (!hasPermission) {/* Lines 147-151 omitted */}

    if (!req.file) {
      console.log('❌ NO FILE IN REQUEST');
      /* Lines 154-158 omitted */}

    // Check if task exists
    const task = await Task.findById(taskId);
    console.log('📤 TASK FOUND:', {
      taskId,
      taskExists: !!task,
      currentAttachments: task?.attachments?.length || 0
    });
    
    if (!task) {/* Lines 163-167 omitted */}

    let filename = req.file.filename;
    let filePath = req.file.path;
    let fileUrl = `/uploads/${filename}`;

    if (r2Storage.isR2Enabled()) {
      try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        filename = `${uniqueSuffix}${path.extname(req.file.originalname)}`;
        const key = `task-attachments/${filename}`;
        const buffer = req.file.buffer;
        await r2Storage.uploadToR2(buffer, key, req.file.mimetype);
        
        filePath = key;
        fileUrl = r2Storage.getPublicUrl(key) || `/uploads/${key}`;
      } catch (r2Error) {
        console.error('[fileController] Failed to upload task attachment to R2:', r2Error.message);
        return res.status(500).json({ message: "Failed to upload file to R2" });
      }
    }

    const fileData = {
      _id: new ObjectId(),
      originalName: req.file.originalname,
      filename: filename,
      path: filePath,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl,
      uploadedBy: new ObjectId(userId),
      uploadedAt: new Date(),
      version: 1,
      deleted: false
    };

    console.log('📤 FILE DATA TO SAVE:', fileData);

    // Add file to task attachments
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { 
        $push: { attachments: fileData },
        $set: { updatedAt: new Date() }
      },
      { new: true } // Return updated document
    );

    console.log('📤 TASK UPDATED:', {
      taskId,
      newAttachmentsCount: updatedTask?.attachments?.length || 0,
      updateSuccess: !!updatedTask
    });    // Add activity log (using storage helper if available)
    try {
      // Try to use activity helper if it exists
      if (storage && storage.addActivity) {
        await storage.addActivity({
          taskId: taskId,
          userId: userId,
          action: 'file_uploaded',
          description: `File "${req.file.originalname}" uploaded`,
          metadata: {
            fileName: req.file.originalname,
            fileSize: req.file.size
          }
        });
      }
    } catch (activityError) {
      console.warn('Could not log activity:', activityError);
    }

    // 🔔 Create notification for file upload
    try {
      const task = await Task.findById(taskId).populate('assignedTo createdBy collaborators', 'firstName lastName email');
      
      if (task) {
        const { TriggerEvent, NotificationPriority, ChannelType } = await import('../modals/notificationModal.js');
        const { NotificationService } = await import('../services/notificationService.js');

        // Helper function to create file notification
        const createFileNotification = async (targetUserId) => {
          if (!targetUserId || targetUserId.toString() === userId) return;

          await NotificationService.createNotification({
            user_id: targetUserId,
            trigger_event: TriggerEvent.FILE_UPLOADED,
            related_entity: {
              entity_type: 'attachment',
              entity_id: task._id
            },
            title: 'File Uploaded',
            message: `A new file "${req.file.originalname}" was uploaded to task "${task.title}"`,
            priority: NotificationPriority.NORMAL,
            channels: [ChannelType.IN_APP],
            metadata: {
              fileName: req.file.originalname,
              fileSize: req.file.size,
              taskId: task._id,
              taskTitle: task.title
            }
          });
        };

        // Notify task assignee
        if (task.assignedTo) {
          await createFileNotification(task.assignedTo._id);
        }

        // Notify task creator
        if (task.createdBy && task.createdBy._id.toString() !== task.assignedTo?._id?.toString()) {
          await createFileNotification(task.createdBy._id);
        }

        // Notify collaborators
        if (task.collaborators && task.collaborators.length > 0) {
          for (const collaborator of task.collaborators) {
            if (collaborator._id.toString() !== userId &&
                collaborator._id.toString() !== task.assignedTo?._id?.toString() &&
                collaborator._id.toString() !== task.createdBy?._id?.toString()) {
              await createFileNotification(collaborator._id);
            }
          }
        }
      }
    } catch (notificationError) {
      console.error('Error creating file upload notification:', notificationError);
      // Don't fail file upload if notification fails
    }

    // Get user details for response
    const user = await User.findById(userId).select('name email');
    fileData.uploadedBy = user;

    console.log('✅ FILE UPLOADED SUCCESSFULLY:', {
      fileId: fileData._id,
      fileName: fileData.originalName,
      taskId
    });

    res.json({
      success: true,
      data: fileData,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file'
    });
  }
};

// Delete file from task
const deleteFile = async (req, res) => {
  try {
    const { taskId, fileId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'delete');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get task and file
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const file = task.attachments?.find(f => f._id.toString() === fileId && !f.deleted);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Soft delete the file
    await Task.updateOne(
      { 
        _id: taskId,
        'attachments._id': fileId
      },
      { 
        $set: { 
          'attachments.$.deleted': true,
          'attachments.$.deletedAt': new Date(),
          'attachments.$.deletedBy': userId,
          updatedAt: new Date()
        }
      }
    );

    // Move to deleted attachments for audit
    const deletedFile = {
      ...file,
      deleted: true,
      deletedAt: new Date(),
      deletedBy: userId
    };

    await Task.findByIdAndUpdate(
      taskId,
      { $push: { deletedAttachments: deletedFile } }
    );

    // Add activity log
    try {
      if (storage && storage.addActivity) {
        await storage.addActivity({
          taskId: taskId,
          userId: userId,
          action: 'file_deleted',
          description: `File "${file.originalName}" deleted`,
          metadata: {
            fileName: file.originalName,
            fileId: fileId
          }
        });
      }
    } catch (activityError) {
      console.warn('Could not log activity:', activityError);
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
};

// Get links for a task
const getTaskLinks = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'view');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const task = await Task.findById(taskId);
    console.log('📋 Found task with ID:', taskId);
    console.log('📋 Task exists:', !!task);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Get links (non-deleted)
    const links = task.links || [];
    console.log('📋 All links in task:', links.length);
    const activeLinks = links.filter(link => !link.deleted);
    console.log('📋 Active links (non-deleted):', activeLinks.length);
    console.log('📋 Active links data:', activeLinks);

    // Populate addedBy user details
    for (let link of activeLinks) {
      if (link.addedBy) {
        const user = await User.findById(link.addedBy).select('name email');
        link.addedBy = user;
      }
    }

    res.json({
      success: true,
      data: activeLinks
    });

  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch links'
    });
  }
};

// Add link to task
const addLink = async (req, res) => {
  try {
    console.log('🔗 ADD LINK REQUEST:', {
      taskId: req.params.taskId,
      userId: req.user?.id,
      userRole: req.user?.role,
      body: req.body
    });

    const { taskId } = req.params;
    const { url, title, description } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate required fields
    if (!url || !url.trim()) {
      console.log('❌ LINK VALIDATION FAILED: URL required');
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
      console.log('✅ URL FORMAT VALID:', url);
    } catch (e) {
      console.log('❌ URL FORMAT INVALID:', url);
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format'
      });
    }

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'upload');
    console.log('🔗 LINK PERMISSION CHECK:', hasPermission);
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if task exists
    const task = await Task.findById(taskId);
    console.log('🔗 TASK FOUND:', {
      taskId,
      taskExists: !!task,
      currentLinksCount: task?.links?.length || 0
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const linkData = {
      _id: new ObjectId(),
      url: url.trim(),
      title: title?.trim() || '',
      description: description?.trim() || '',
      addedBy: userId,
      createdAt: new Date(),
      deleted: false
    };

    // Add link to task
    console.log('📝 Adding link to task:', taskId, linkData);
    
    // Use a more explicit approach to ensure the update persists
    if (!task.links) {
      task.links = [];
    }
    task.links.push(linkData);
    task.updatedAt = new Date();
    
    const savedTask = await task.save();
    console.log('📝 Saved task links count:', savedTask?.links?.length || 0);
    console.log('📝 Last link added:', savedTask?.links?.[savedTask?.links?.length - 1]);
    
    // Wait a bit and verify with a fresh query including explicit field selection
    await new Promise(resolve => setTimeout(resolve, 100));
    const verifyTask = await Task.findById(taskId).select('links');
    console.log('📝 Verification - task links count:', verifyTask?.links?.length || 0);
    console.log('📝 Verification - all links:', JSON.stringify(verifyTask?.links || [], null, 2));

    // Add activity log
    try {
      if (storage && storage.addActivity) {
        await storage.addActivity({
          taskId: taskId,
          userId: userId,
          action: 'link_added',
          description: `Link "${linkData.title || linkData.url}" added`,
          metadata: {
            linkTitle: linkData.title,
            linkUrl: linkData.url
          }
        });
      }
    } catch (activityError) {
      console.warn('Could not log activity:', activityError);
    }

    // Get user details for response
    const user = await User.findById(userId).select('name email');
    linkData.addedBy = user;

    console.log('✅ LINK ADDED SUCCESSFULLY:', {
      linkId: linkData._id,
      linkTitle: linkData.title,
      linkUrl: linkData.url,
      taskId,
      totalLinks: savedTask?.links?.length || 0
    });

    res.json({
      success: true,
      data: linkData,
      message: 'Link added successfully'
    });

  } catch (error) {
    console.error('❌ ERROR ADDING LINK:', {
      error: error.message,
      stack: error.stack,
      taskId: req.params.taskId
    });
    res.status(500).json({
      success: false,
      message: 'Failed to add link',
      error: error.message
    });
  }
};

// Delete link from task
const deleteLink = async (req, res) => {
  try {
    const { taskId, linkId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'delete');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get task and link
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const link = task.links?.find(l => l._id.toString() === linkId && !l.deleted);
    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Link not found'
      });
    }

    // Soft delete the link
    await Task.updateOne(
      { 
        _id: taskId,
        'links._id': linkId
      },
      { 
        $set: { 
          'links.$.deleted': true,
          'links.$.deletedAt': new Date(),
          'links.$.deletedBy': userId,
          updatedAt: new Date()
        }
      }
    );

    // Add activity log
    try {
      if (storage && storage.addActivity) {
        await storage.addActivity({
          taskId: taskId,
          userId: userId,
          action: 'link_deleted',
          description: `Link "${link.title || link.url}" deleted`,
          metadata: {
            linkTitle: link.title,
            linkUrl: link.url,
            linkId: linkId
          }
        });
      }
    } catch (activityError) {
      console.warn('Could not log activity:', activityError);
    }

    res.json({
      success: true,
      message: 'Link deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete link'
    });
  }
};

// Download file from task
const downloadFile = async (req, res) => {
  try {
    const { taskId, fileId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'view');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get task and file
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const file = task.attachments?.find(f => f._id.toString() === fileId && !f.deleted);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Resolve file path (handles absolute path mismatch across environments)
    const filePath = resolveFilePath(file);
    if (!filePath) {
      if (r2Storage.isR2Enabled()) {
        try {
          const key = file.path || `task-attachments/${file.filename}`;
          const signedUrl = await r2Storage.getSignedUrlForGetObject(key, {
            responseContentDisposition: `attachment; filename="${encodeURIComponent(file.originalName)}"`,
            responseContentType: file.mimetype || 'application/octet-stream',
            expiresIn: 900 // 15 minutes
          });
          if (signedUrl) {
            return res.redirect(signedUrl);
          }
        } catch (r2Error) {
          console.error('[downloadFile] Failed to generate signed URL from R2:', r2Error.message);
        }
      }
      console.error('File not found on disk or R2. Stored path:', file.path, 'Filename:', file.filename);
      return res.status(404).json({
        success: false,
        message: 'File not available - it may have been uploaded on a different server'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', file.size);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }
    });

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
};

// View/preview file from task (inline, not download)
const viewFile = async (req, res) => {
  try {
    const { taskId, fileId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check permission
    const hasPermission = await checkFilePermission(userId, userRole, taskId, 'view');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get task and file
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const file = task.attachments?.find(f => f._id.toString() === fileId && !f.deleted);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Resolve file path (handles absolute path mismatch across environments)
    const filePath = resolveFilePath(file);
    if (!filePath) {
      if (r2Storage.isR2Enabled()) {
        try {
          const key = file.path || `task-attachments/${file.filename}`;
          const signedUrl = await r2Storage.getSignedUrlForGetObject(key, {
            responseContentDisposition: `inline; filename="${encodeURIComponent(file.originalName)}"`,
            responseContentType: file.mimetype || 'application/octet-stream',
            expiresIn: 3600 // 1 hour
          });
          if (signedUrl) {
            return res.redirect(signedUrl);
          }
        } catch (r2Error) {
          console.error('[viewFile] Failed to generate signed URL from R2:', r2Error.message);
        }
      }
      console.error('File not found on disk or R2. Stored path:', file.path, 'Filename:', file.filename);
      return res.status(404).json({
        success: false,
        message: 'File not available - it may have been uploaded on a different server'
      });
    }

    // Set headers for inline viewing (not download)
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', file.size);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error viewing file'
        });
      }
    });

  } catch (error) {
    console.error('Error viewing file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to view file'
    });
  }
};

export {
  upload,
  getTaskFiles,
  uploadFile,
  downloadFile,
  viewFile,
  deleteFile,
  getTaskLinks,
  addLink,
  deleteLink
};