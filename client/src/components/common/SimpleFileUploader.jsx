import React, { useState, useRef } from "react";
import { Plus, X, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SimpleFileUploader = ({
  files = [],
  onFilesChange,
  onDeleteFile, // 🆕 Callback for deleting uploaded files from server
  onFileClick, // 🆕 Callback for authenticated file viewing
  maxSize = 5 * 1024 * 1024, // 5MB

  className = "",
  error = null,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState(error);
  const fileInputRef = useRef(null);

  const getFileName = (file) => {
    // Support multiple file object formats
    // API responses use: originalName, filename
    // Direct uploads use: name
    return file?.name || file?.originalName || file?.filename || "unknown";
  };

  const formatFileSize = (bytes) => {
    // If already a string (already formatted), return it
    if (typeof bytes === "string") {
      return bytes;
    }

    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getTotalSize = () => {
    console.log("📊 getTotalSize - All files:", files);
    const total = files.reduce((sum, file) => {
      // Get the size value - could be number (bytes) or string (formatted)
      let fileSize = file.size || file.fileSize || 0;

      // If size is a string (e.g., "22.2 KB"), convert it back to bytes
      if (typeof fileSize === "string") {
        const match = fileSize.match(/^([\d.]+)\s*(Bytes|KB|MB|GB)$/i);
        if (match) {
          const value = parseFloat(match[1]);
          const unit = match[2].toUpperCase();
          const multipliers = {
            BYTES: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
          };
          fileSize = value * (multipliers[unit] || 1);
        } else {
          fileSize = 0;
        }
      }

      console.log("📁 File:", file.name, "Size properties:", {
        size: file.size,
        fileSize: file.fileSize,
        convertedSize: fileSize,
        allKeys: Object.keys(file),
      });
      return sum + fileSize;
    }, 0);
    console.log("📊 Total calculated size:", total);
    return total;
  };

  const handleDragEvents = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    handleDragEvents(e);
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    handleDragEvents(e);
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    handleDragEvents(e);
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileAdd(droppedFiles);
  };

  const handleFileInputChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    console.log("selectedFiles upload handler", selectedFiles);

    // Validate and create file objects with IDs
    const validFiles = selectedFiles.filter((file) => {
      if (file.size > maxSize) {
        setValidationError(
          `File ${file.name} is too large. Maximum size is ${formatFileSize(maxSize)}.`,
        );
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Check total size after adding
    const totalSize =
      getTotalSize() + validFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxSize) {
      setValidationError(
        `Total file size cannot exceed ${formatFileSize(maxSize)}.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const filesWithIds = validFiles.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
    }));

    // Call onFilesChange with updated file list
    const updatedFiles = [...files, ...filesWithIds];

    if (typeof onFilesChange === "function") {
      const result = onFilesChange(updatedFiles);
      // Wait for Promise if returned (for async upload)
      if (result && typeof result.then === "function") {
        await result;
      }
    }

    // Clear input value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileAdd = async (newFiles) => {
    setValidationError(null);

    const validFiles = newFiles.filter((file) => {
      if (file.size > maxSize) {
        setValidationError(
          `File ${file.name} is too large. Maximum size is ${formatFileSize(maxSize)}.`,
        );
        return false;
      }
      return true;
    });

    // Check total size after adding
    const totalSize =
      getTotalSize() + validFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxSize) {
      setValidationError(
        `Total file size cannot exceed ${formatFileSize(maxSize)}.`,
      );
      return;
    }

    const filesWithIds = validFiles.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
    }));

    const updatedFiles = [...files, ...filesWithIds];

    if (typeof onFilesChange === "function") {
      const result = onFilesChange(updatedFiles);
      // Wait for Promise if returned (for async upload)
      if (result && typeof result.then === "function") {
        await result;
      }
    }
  };

  const removeFile = async (fileId) => {
    // 🆕 If onDeleteFile callback is provided and file has _id (server file), call it
    const fileToRemove = files.find((f) => f.id === fileId);

    if (onDeleteFile && fileToRemove && fileToRemove._id) {
      // This is a server-uploaded file, use the delete callback
      try {
        await onDeleteFile(fileToRemove._id);
        // After successful deletion, update local state
        const updatedFiles = files.filter((file) => file.id !== fileId);
        onFilesChange(updatedFiles);
      } catch (error) {
        console.error("Failed to delete file:", error);
        // Don't remove from local state if server deletion failed
      }
    } else {
      // This is a local file (not yet uploaded), just remove from state
      const updatedFiles = files.filter((file) => file.id !== fileId);
      onFilesChange(updatedFiles);
    }

    // Clear error when removing files
    if (validationError) {
      setValidationError(null);
    }
  };

  // Use external error if provided, otherwise use internal validation error
  const displayError = error || validationError;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-sm p-3 text-center transition-all duration-200 cursor-pointer
          ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : displayError
                ? "border-red-500"
                : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
          }
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEvents}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          accept="*/*"
        />

        <div className="flex flex-col items-center gap-2">
          <div
            className={`w-12 h-12 ${displayError ? "bg-red-100" : "bg-blue-100"} rounded-full flex items-center justify-center`}
          >
            <Plus
              size={24}
              className={displayError ? "text-red-600" : "text-blue-600"}
            />
          </div>
          <div>
            <p
              className={
                displayError
                  ? "text-red-600 font-medium"
                  : "text-blue-600 font-medium"
              }
            >
              Drag & Drop files
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PDF, DOC, images supported
            </p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {displayError && (
        <div className="flex items-center gap-2 text-red-500 text-sm mt-1">
          <AlertCircle size={16} />
          <span>{displayError}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => {
            console.log("🎨 Rendering file:", file);
            const fileName = getFileName(file);
            const displaySize = file.size || file.fileSize || 0;
            console.log("🎨 Display size for", fileName, ":", displaySize);

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border"
              >
                {/* File Info */}
                <div className="flex items-center gap-3">
                  {/* File Type Badge */}
                  <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">
                      {fileName.includes(".")
                        ? fileName.split(".").pop()?.toUpperCase()
                        : "FILE"}
                    </span>
                  </div>

                  {/* File Details */}
                  <div>
                    <p
                      className="text-sm font-medium text-gray-900 truncate"
                      title={fileName}
                    >
                      {onFileClick ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onFileClick(file);
                          }}
                          className="hover:underline text-blue-600 cursor-pointer bg-transparent border-none p-0 text-left"
                        >
                          {fileName}
                        </button>
                      ) : (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {fileName}
                        </a>
                      )}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(file.size || file.fileSize || 0)}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      Uploaded by:{" "}
                      <span className="font-medium">
                        {file.createdBy?.firstName} {file.createdBy?.lastName}
                      </span>
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {file.uploadedAt}
                    </p>
                  </div>
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    removeFile(file.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  type="button"
                  title="Remove file"
                >
                  <Trash2 className="btn-icon" size={16} />
                </Button>
              </div>
            );
          })}

          {/* Total Size */}
          <div className="text-xs text-gray-500 text-right">
            Total size: {formatFileSize(getTotalSize())} /{" "}
            {formatFileSize(maxSize)}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleFileUploader;
