import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  BarChart3,
  Database,
  Image,
  Folder,
  Cloud,
  Download,
  Trash2,
  ExternalLink,
  Plus,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleFileUploader from "../../components/common/SimpleFileUploader";
import { useShowToast } from "@/utils/ToastMessage";
import "../../components/common/AttachmentUploader.css";

export default function TaskAttachments({ taskId, task }) {
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [newLink, setNewLink] = useState({
    title: "",
    url: "",
    description: "",
  });
  const fileInputRef = useRef(null);

  const taskStatus = task?.status?.toUpperCase?.();
  const approvalStatus = task?.approvalStatus?.toLowerCase?.();
  const isUploadDisabled =
    taskStatus === "DONE" ||
    taskStatus === "CANCELLED" ||
    taskStatus === "REJECTED" ||
    taskStatus === "APPROVED" ||
    approvalStatus === "approved" ||
    approvalStatus === "rejected";

  // Helper function to extract clean file object from Mongoose document
  const extractFileData = (mongooseFile) => {
    // If it has _doc property (Mongoose document), extract from there
    const fileData = mongooseFile?._doc || mongooseFile;

    return {
      _id: fileData._id || mongooseFile._id,
      originalName: fileData.originalName,
      filename: fileData.filename,
      size: fileData.size,
      mimetype: fileData.mimetype,
      uploadedBy: fileData.uploadedBy,
      uploadedAt: fileData.uploadedAt,
      url: fileData.url,
      deleted: fileData.deleted,
    };
  };

  // API Functions
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const getAuthHeadersForFile = () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("authToken");
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  // Load files and links from backend - USING NEW GET ATTACHMENTS API
  const loadTaskFiles = useCallback(async () => {
    console.log("� LOAD ATTACHMENTS START (NEW API):", { taskId });

    if (!taskId) {
      console.log("⚠️ No taskId, skipping attachments load");
      return;
    }

    try {
      // 🆕 NEW API: GET /api/tasks/:taskId/attachments
      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      console.log("� Load attachments response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("� Load attachments result:", result);

        if (result.success && result.data) {
          const attachments = result.data.attachments || [];
          console.log("✅ ATTACHMENTS LOADED (NEW API):", {
            count: attachments.length,
            totalCount: result.data.totalCount,
          });

          const cleanedFiles = attachments.map((file) => {
            // Extract clean file data from Mongoose document if wrapped
            const cleanFile = extractFileData(file);

            // ✅ Ensure we have a valid filename to work with
            const fileName =
              cleanFile.originalName || cleanFile.filename || "unknown";
            const fileExtension = fileName.includes(".")
              ? fileName.split(".").pop().toLowerCase()
              : "unknown";

            // Fix URL if it's incorrect
            let fileUrl = cleanFile.url;
            if (fileUrl && !fileUrl.includes("/task-attachments/")) {
              // URL doesn't have the correct path, reconstruct it
              const filename = cleanFile.filename || "";
              fileUrl = `/uploads/task-attachments/${filename}`;
            }

            return {
              _id: cleanFile._id,
              id: cleanFile._id,
              name: fileName,
              originalName: cleanFile.originalName,
              filename: cleanFile.filename,
              size: cleanFile.size,
              fileSize: cleanFile.size,
              type: fileExtension,
              mimetype: cleanFile.mimetype,
              url: fileUrl,
              uploadedAt:
                new Date(cleanFile.uploadedAt).toLocaleDateString() +
                " at " +
                new Date(cleanFile.uploadedAt).toLocaleTimeString(),
              createdBy: { firstName: "Unknown", lastName: "User" },
            };
          });

          setFiles(cleanedFiles);
        }
      } else {
        const errorText = await response.text();
        console.error(
          "❌ Failed to load attachments:",
          response.status,
          errorText,
        );
      }
    } catch (error) {
      console.error("❌ Error loading attachments:", error);
    }
  }, [taskId]); // Removed formatFileSize and getFileIcon from dependencies

  const loadTaskLinks = useCallback(async () => {
    console.log("🔗 LOAD LINKS START:", { taskId });

    if (!taskId) {
      console.log("⚠️ No taskId, skipping links load");
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}/links`, {
        headers: getAuthHeaders(),
      });

      console.log("🔗 Load links response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("🔗 Load links result:", result);

        if (result.success && result.data) {
          console.log("✅ LINKS LOADED:", {
            count: result.data?.length || 0,
            links: result.data,
          });

          const processedLinks = result.data.map((link) => ({
            ...link,
            id: link._id,
            addedBy: link.addedBy?.name || "Unknown",
            addedAt:
              new Date(link.createdAt).toLocaleDateString() +
              " at " +
              new Date(link.createdAt).toLocaleTimeString(),
            favicon: "🔗",
          }));
          console.log("🔗 Processed links:", processedLinks);
          setLinks(processedLinks);
        }
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to load links:", response.status, errorText);
      }
    } catch (error) {
      console.error("❌ Error loading links:", error);
    }
  }, [taskId]);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadTaskFiles(), loadTaskLinks()]);
      setLoading(false);
    };

    if (taskId) {
      loadData();
    }
  }, [taskId, loadTaskFiles, loadTaskLinks]);

  // Define utility functions first
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }, []);

  const getFileIcon = useCallback((filename) => {
    // ✅ Handle undefined or empty filenames
    if (!filename || typeof filename !== "string") {
      return "📄";
    }

    const ext = filename.includes(".")
      ? filename.split(".").pop().toLowerCase()
      : "";

    const icons = {
      pdf: <FileText size={16} className="text-red-500" />,
      doc: "📝",
      docx: "📝",
      xls: <BarChart3 size={16} className="text-green-500" />,
      xlsx: <BarChart3 size={16} className="text-green-500" />,
      ppt: "📊",
      pptx: "📊",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      zip: "📦",
      sql: "🗄️",
      txt: "📄",
    };
    return icons[ext] || "📄";
  }, []);

  // File handling functions - USING NEW ADD ATTACHMENTS API
  const uploadFileToServer = useCallback(
    async (file) => {
      console.log("📤 UPLOAD ATTACHMENT START (NEW API):", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        taskId,
      });

      if (!taskId) {
        console.log("❌ UPLOAD FAILED: No taskId");
        return null;
      }

      const formData = new FormData();
      formData.append("attachments", file); // 🆕 Changed from 'file' to 'attachments'

      try {
        // 🆕 NEW API: POST /api/tasks/:taskId/attachments
        console.log(
          "📤 Sending upload request to:",
          `/api/tasks/${taskId}/attachments`,
        );

        const response = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: "POST",
          headers: getAuthHeadersForFile(),
          body: formData,
        });

        console.log("📤 Upload response status:", response.status);

        if (response.ok) {
          const result = await response.json();
          console.log("📤 Upload result (NEW API):", result);

          if (result.success && result.data) {
            console.log(
              "✅ ATTACHMENT UPLOADED SUCCESSFULLY (NEW API):",
              result.data,
            );
            return result.data.addedAttachments[0]; // Return first added attachment
          }
        } else {
          const errorText = await response.text();
          console.error(
            "❌ Upload failed with status:",
            response.status,
            errorText,
          );
        }
        throw new Error("Upload failed");
      } catch (error) {
        console.error("❌ Error uploading attachment:", error);
        throw error;
      }
    },
    [taskId],
  );

  const handleFiles = useCallback(
    async (fileList) => {
      console.log("📁 HANDLE FILES START (ADD ATTACHMENTS API):", {
        fileCount: fileList.length,
        uploading,
        taskId,
      });

      if (uploading) {
        console.log("⚠️ Already uploading, skipping");
        return;
      }

      if (fileList.length === 0) {
        console.log("⚠️ No files to upload");
        return;
      }

      setUploading(true);

      try {
        const formData = new FormData();
        const filesArray = Array.from(fileList);

        filesArray.forEach((file) => {
          formData.append("attachments", file);
        });

        console.log(
          "📁 Uploading",
          filesArray.length,
          "files via ADD ATTACHMENTS API...",
        );
        console.log("📁 API endpoint:", `/api/tasks/${taskId}/attachments`);

        const response = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: "POST",
          headers: getAuthHeadersForFile(),
          body: formData,
        });

        let result;
        try {
          result = await response.json();
        } catch (e) {
          result = {
            success: false,
            message: `Server error (${response.status})`,
          };
        }

        if (response.ok && result.success) {
          const count =
            result.data?.addedAttachments?.length || filesArray.length;
          showSuccessToast(
            `${count} file${count > 1 ? "s" : ""} uploaded successfully`,
          );
          console.log("✅ ATTACHMENTS ADDED SUCCESSFULLY:", result);
          // Invalidate notifications cache to show file upload notification immediately
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        } else {
          const errorMsg =
            result.message || `Upload failed (${response.status})`;
          console.error("❌ Add attachments failed:", response.status, result);
          showErrorToast(errorMsg);
        }

        console.log("📁 Upload complete, reloading attachments...");
        await loadTaskFiles();
      } catch (error) {
        console.error("❌ Error uploading files:", error);
        showErrorToast(error.message || "Failed to upload file");
      } finally {
        setUploading(false);
        console.log("✅ FILES HANDLING COMPLETE");
      }
    },
    [
      loadTaskFiles,
      uploading,
      taskId,
      showSuccessToast,
      showErrorToast,
      queryClient,
    ],
  );

  const handleDeleteFile = useCallback(
    async (fileId) => {
      if (!taskId) return;

      console.log("🗑️ DELETE ATTACHMENT:", { taskId, fileId });

      try {
        // 🆕 Using new DELETE /api/tasks/:taskId/attachments/:attachmentId API
        const response = await fetch(
          `/api/tasks/${taskId}/attachments/${fileId}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
          },
        );

        if (response.ok) {
          const result = await response.json();
          console.log("✅ Attachment deleted successfully:", result);
          await loadTaskFiles(); // Reload attachments from server using NEW API
        } else {
          const error = await response.json();
          console.error("❌ Failed to delete attachment:", error);
          showErrorToast(error.message || "Failed to delete attachment");
        }
      } catch (error) {
        console.error("❌ Error deleting attachment:", error);
        showErrorToast("Error deleting attachment");
      }
    },
    [taskId, loadTaskFiles, showErrorToast],
  );

  // Check if file type can be previewed inline in browser
  const isPreviewable = useCallback((file) => {
    const ext = (file.name || file.originalName || "")
      .split(".")
      .pop()
      ?.toLowerCase();
    const mime = file.mimetype || file.type || "";
    // Images, PDF, plain text, CSV, HTML, SVG are previewable
    const previewableExts = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "bmp",
      "webp",
      "svg",
      "pdf",
      "txt",
      "csv",
      "html",
      "htm",
    ];
    const previewableMimes = ["image/", "application/pdf", "text/"];
    if (previewableExts.includes(ext)) return true;
    if (previewableMimes.some((m) => mime.startsWith(m))) return true;
    return false;
  }, []);

  // 🆕 Authenticated file view handler - handles all file types
  const handleViewFile = useCallback(
    (file) => {
      const fileId = file.id || file._id;
      const token = localStorage.getItem("token");

      if (!token) {
        console.error("No token available for file view");
        showErrorToast?.("Authentication required");
        return;
      }

      // For previewable files: open inline in new tab
      // For non-previewable files (docx, xlsx, zip, pptx): trigger download
      const canPreview = isPreviewable(file);
      const endpoint = canPreview
        ? `/api/tasks/${taskId}/files/${fileId}/view`
        : `/api/tasks/${taskId}/files/${fileId}/download`;

      fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          if (response.ok) {
            return response.blob();
          }
          // Try to extract error message from JSON response
          let errorMsg = "Failed to load file";
          try {
            const data = await response.json();
            errorMsg = data.message || errorMsg;
          } catch (e) {
            /* response wasn't JSON */
          }
          throw new Error(errorMsg);
        })
        .then((blob) => {
          if (canPreview) {
            // Open inline in new tab
            const blobWithType = new Blob([blob], {
              type: file.mimetype || blob.type,
            });
            const url = window.URL.createObjectURL(blobWithType);
            window.open(url, "_blank");
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
          } else {
            // Trigger download for non-previewable files
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = file.name || file.originalName || "download";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(url), 5000);
          }
        })
        .catch((error) => {
          console.error("File view failed:", error);
          showErrorToast?.(error.message || "Failed to open file");
        });
    },
    [taskId, isPreviewable, showErrorToast],
  );

  const handleDownloadFile = useCallback(
    (file) => {
      // Use the backend download API instead of direct file URLs
      const downloadUrl = `/api/tasks/${taskId}/files/${file.id}/download`;

      // Add authorization header by creating a fetch request
      const token = localStorage.getItem("token");

      if (token) {
        // For authenticated downloads, we need to use fetch and create a blob
        fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then((response) => {
            if (response.ok) {
              return response.blob();
            }
            throw new Error("Download failed");
          })
          .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = file.name || file.originalName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          })
          .catch((error) => {
            console.error("Download failed:", error);
          });
      } else {
        console.error("No token available for download");
      }
    },
    [taskId],
  );

  const handleAddLink = useCallback(async () => {
    if (newLink.title && newLink.url && taskId) {
      try {
        console.log("🔗 Adding link:", newLink);
        const response = await fetch(`/api/tasks/${taskId}/links`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            url: newLink.url,
            title: newLink.title,
            description: newLink.description,
          }),
        });

        console.log("🔗 Add link response status:", response.status);

        if (response.ok) {
          const result = await response.json();
          console.log("🔗 Add link result:", result);
          await loadTaskLinks(); // Reload links from server
          setNewLink({ title: "", url: "", description: "" });
          setShowAddLink(false);
          showSuccessToast("Link added successfully");
        } else {
          let errorMsg = "Failed to add link";
          try {
            const result = await response.json();
            errorMsg = result.message || errorMsg;
          } catch (e) {
            // response was not JSON, let's try to get response text
            try {
              const text = await response.text();
              if (text) errorMsg = text;
            } catch (textErr) {}
          }
          console.error("🔗 Add link error:", response.status, errorMsg);
          showErrorToast(errorMsg);
        }
      } catch (error) {
        console.error("Error adding link:", error);
        showErrorToast(error.message || "Error adding link");
      }
    } else {
      console.log("🔗 Add link validation failed:", {
        hasTitle: !!newLink.title,
        hasUrl: !!newLink.url,
        hasTaskId: !!taskId,
      });
    }
  }, [newLink, taskId, loadTaskLinks, showSuccessToast, showErrorToast]);

  const handleDeleteLink = useCallback(
    async (linkId) => {
      if (!taskId) return;

      try {
        const response = await fetch(`/api/tasks/${taskId}/links/${linkId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          await loadTaskLinks(); // Reload links from server
        }
      } catch (error) {
        console.error("Error deleting link:", error);
      }
    },
    [taskId, loadTaskLinks],
  );

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  // Memoized file list to prevent unnecessary re-renders
  const memoizedFiles = useMemo(() => files, [files]);
  const memoizedLinks = useMemo(() => {
    console.log("🔗 Memoizing links:", links);
    return links;
  }, [links]);

  return (
    <div className="space-y-3">
      {/* Files Section */}
      <div className="files-section">
        <div className="section-header flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">📁</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Files ({memoizedFiles.length})
              </h2>
              <p className="text-sm text-gray-600">Attachments and documents</p>
            </div>
          </div>
        </div>

        {/* Disabled message */}
        {isUploadDisabled && (
          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-sm">
            <p className="text-sm text-gray-500 text-center">
              You cannot upload files because the task is{" "}
              {taskStatus === "DONE"
                ? "completed"
                : taskStatus === "CANCELLED"
                  ? "cancelled"
                  : approvalStatus === "approved" || taskStatus === "APPROVED"
                    ? "approved"
                    : "rejected"}
              .
            </p>
          </div>
        )}

        {/* File Upload Area */}
        {!isUploadDisabled && (
          <div className="mb-2">
            {uploading && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-sm flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-blue-700 font-medium">
                  Uploading files...
                </span>
              </div>
            )}

            <SimpleFileUploader
              files={memoizedFiles}
              onFilesChange={async (updatedFiles) => {
                const newFiles = updatedFiles.filter(
                  (f) => !files.find((ef) => ef.id === f.id),
                );

                if (newFiles.length > 0) {
                  console.log("🆕 New files detected:", newFiles.length);
                  await handleFiles(
                    newFiles.map((f) => f.file).filter(Boolean),
                  );
                } else {
                  console.log("📝 Files state updated (no upload needed)");
                  setFiles(updatedFiles);
                }
              }}
              onDeleteFile={handleDeleteFile}
              onFileClick={handleViewFile}
              maxSize={5 * 1024 * 1024}
              maxFiles={20}
              className="w-full"
            />
          </div>
        )}

        {/* Read-only file list when disabled */}
        {isUploadDisabled && files.length > 0 && (
          <div className="space-y-2">
            {memoizedFiles.map((file) => (
              <div
                key={file.id || file._id}
                className="flex items-center gap-3 bg-white rounded-md border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => handleViewFile(file)}
              >
                <div className="w-10 h-10 bg-gray-100 rounded-sm flex items-center justify-center flex-shrink-0">
                  {getFileIcon(file.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size || file.fileSize)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-sm text-gray-600"
                  title="Download"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadFile(file);
                  }}
                >
                  <Download size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
        {files.length <= 0 ? (
          <div className="empty-state text-center py-3">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📄</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No files attached
            </h3>
            <p className="text-gray-600">Upload files to get started</p>
          </div>
        ) : null}
      </div>

      {/* Links Section */}
      <div className="links-section">
        <div className="section-header flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">🔗</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Links ({memoizedLinks.length})
              </h2>
              <p className="text-sm text-gray-600">
                External references and resourcess
              </p>
            </div>
          </div>
          {isUploadDisabled && (
            <div className="text-sm text-gray-500">
              You cannot add links because the task is{" "}
              {taskStatus === "DONE"
                ? "completed"
                : taskStatus === "CANCELLED"
                  ? "cancelled"
                  : approvalStatus === "approved" || taskStatus === "APPROVED"
                    ? "approved"
                    : "rejected"}
              .
            </div>
          )}
          {!isUploadDisabled && (
            <Button
              variant="primary"
              onClick={() => setShowAddLink(true)}
              className="h-9 flex items-center gap-2 px-6 py-3 min-w-[140px] justify-center"
            >
              <LinkIcon size={16} />
              <span>Add Link</span>
            </Button>
          )}
        </div>

        {/* Add Link Modal */}
        {showAddLink && !isUploadDisabled && (
          <div className="add-link-modal bg-white rounded-2xl border border-gray-200 p-4 mb-3 shadow-lg animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <LinkIcon size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Add New Link
                  </h3>
                  <p className="text-sm text-gray-600">
                    Add an external reference or resource
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddLink(false)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-sm flex items-center justify-center text-gray-600 transition-colors"
              >
                <span className="text-sm">✕</span>
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <LinkIcon size={14} className="inline mr-1" />
                  Link Title *
                </label>
                <input
                  type="text"
                  value={newLink.title}
                  onChange={(e) =>
                    setNewLink((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                  placeholder="Enter a descriptive title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ExternalLink size={14} className="inline mr-1" />
                  URL *
                </label>
                <input
                  type="url"
                  value={newLink.url}
                  onChange={(e) =>
                    setNewLink((prev) => ({ ...prev, url: e.target.value }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText size={14} className="inline mr-1" />
                  Description (Optional)
                </label>
                <textarea
                  value={newLink.description}
                  onChange={(e) =>
                    setNewLink((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none transition-all duration-200 shadow-sm hover:shadow-md"
                  rows={3}
                  placeholder="Brief description of this link and its relevance to the task"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="primary"
                  onClick={handleAddLink}
                  className="flex-1 h-9 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium transition-all duration-200 hover:from-green-600 hover:to-emerald-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={!newLink.title || !newLink.url}
                >
                  <Plus size={16} />
                  Add Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddLink(false)}
                  className="flex-1 h-9 border border-gray-300 text-gray-700 rounded-xl font-medium transition-all duration-200 hover:bg-gray-50 hover:shadow-md"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Links List */}
        {memoizedLinks.length > 0 ? (
          <div className="links-list space-y-3">
            {memoizedLinks.map((link) => (
              <div
                key={link.id}
                className="link-card bg-white rounded-md border border-gray-200 p-4 hover:shadow-ms transition-all duration-300 group"
              >
                <div className="flex items-start gap-3">
                  <div className="link-favicon w-12 h-12 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {link.favicon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 mb-1">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 transition-colors"
                          >
                            {link.title}
                          </a>
                        </h4>
                        <p
                          className="text-sm text-blue-600 mb-2 truncate"
                          title={link.url}
                        >
                          {link.url}
                        </p>
                        {link.description && (
                          <p className="text-sm text-gray-600 mb-3">
                            {link.description}
                          </p>
                        )}
                        <div className="text-xs text-gray-500">
                          Added by {link.addedBy} • {link.addedAt}
                        </div>
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(link.url, "_blank")}
                          className="w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-sm flex items-center justify-center text-blue-600 transition-colors"
                          title="Open Link"
                        >
                          <ExternalLink size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLink(link.id)}
                          className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-sm flex items-center justify-center text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🔗</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No links added
            </h3>
            <p className="text-gray-600">
              Add external references and resources
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
