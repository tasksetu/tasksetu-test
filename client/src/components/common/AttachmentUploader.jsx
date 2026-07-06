import React, { useState, useRef } from "react";
import {
  Upload,
  X,
  FileText,
  Image,
  Database,
  BarChart3,
  Paperclip,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  handleFileUpload,
  formatFileSize,
  validateFile,
} from "../../utils/fileUpload";

const AttachmentUploader = ({
  files = [],
  onFilesChange,
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  acceptedTypes = "image/*,application/pdf,.doc,.docx,.txt,.xlsx,.csv",
  showPreview = true,
  allowRemove = true,
  dragDropText = "Click to upload or drag and drop",
  className = "",
  compact = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const getFileIcon = (fileType, fileName = "") => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    if (fileType.startsWith("image/")) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (fileType.includes("pdf") || extension === "pdf") {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (extension === "sql" || fileType.includes("sql")) {
      return <Database className="h-4 w-4 text-green-500" />;
    }
    if (extension === "xlsx" || extension === "xls" || extension === "csv") {
      return <BarChart3 className="h-4 w-4 text-emerald-500" />;
    }
    return <Paperclip className="h-4 w-4 text-gray-500" />;
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
    handleFileSelection(droppedFiles);
  };

  const handleFileSelection = async (selectedFiles) => {
    const newFiles = [];

    for (const file of selectedFiles) {
      const validation = validateFile(file, maxSize);
      if (!validation.valid) {
        console.error(`File ${file.name}: ${validation.error}`);
        continue;
      }

      // Check if file already exists
      const exists = files.find(
        (f) => f.name === file.name && f.size === file.size,
      );
      if (exists) {
        console.warn(`File ${file.name} already uploaded`);
        continue;
      }

      // Check max files limit
      if (files.length + newFiles.length >= maxFiles) {
        console.warn(`Maximum ${maxFiles} files allowed`);
        break;
      }

      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

        // Simulate upload progress
        const uploadResult = await handleFileUpload(file);

        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
        setTimeout(() => {
          setUploadProgress((prev) => {
            const updated = { ...prev };
            delete updated[file.name];
            return updated;
          });
        }, 1000);

        newFiles.push({
          ...uploadResult,
          uploadedBy: "Current User",
          uploadedAt: new Date().toLocaleString(),
          icon: getFileIcon(file.type, file.name),
        });
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        setUploadProgress((prev) => {
          const updated = { ...prev };
          delete updated[file.name];
          return updated;
        });
      }
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFileSelection(selectedFiles);
    e.target.value = "";
  };

  const removeFile = (fileId) => {
    if (allowRemove) {
      const updatedFiles = files.filter((file) => file.id !== fileId);
      onFilesChange(updatedFiles);
    }
  };

  const downloadFile = (file) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            onChange={handleFileInputChange}
            className="hidden"
            accept={acceptedTypes}
          />
          {files.length > 0 && (
            <Badge variant="secondary">
              {files.length} file{files.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {files.length > 0 && showPreview && (
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {file.icon}
                  <span className="truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFile(file)}
                    className="h-6 w-6 p-0"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  {allowRemove && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-sm p-4 text-center transition-all duration-200 cursor-pointer
          ${
            isDragging
              ? `border-blue-500 ${className?.includes("attachment-uploader-white-bg") ? "bg-blue-50" : "bg-blue-50 dark:bg-blue-950"}`
              : `border-gray-300 hover:border-blue-400 ${className?.includes("attachment-uploader-white-bg") ? "bg-white hover:bg-gray-50" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`
          }`}
        style={
          className?.includes("attachment-uploader-white-bg")
            ? { backgroundColor: "white" }
            : {}
        }
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEvents}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          accept={acceptedTypes}
        />

        <div className="flex flex-col items-center gap-3">
          <Upload
            className={`h-8 w-8 ${isDragging ? "text-blue-500" : "text-gray-400"}`}
          />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {dragDropText}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Max {formatFileSize(maxSize)} per file, {maxFiles} files total
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="truncate" title={fileName}>
                  {fileName}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Preview */}
      {files.length > 0 && showPreview && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Uploaded Files ({files.length})
          </h4>
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.id} className="bg-white dark:bg-gray-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {file.icon}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium text-gray-900 dark:text-white truncate"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatFileSize(file.size)}</span>
                          {file.uploadedBy && (
                            <>
                              <span>•</span>
                              <span>by {file.uploadedBy}</span>
                            </>
                          )}
                          {file.uploadedAt && (
                            <>
                              <span>•</span>
                              <span>{file.uploadedAt}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(file)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {allowRemove && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentUploader;
