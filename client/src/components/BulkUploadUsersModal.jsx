import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle, CheckCircle, X } from "lucide-react";
import { useShowToast } from "../utils/ToastMessage";

export function BulkUploadUsersModal({ isOpen, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);
  const { showSuccessToast, showErrorToast } = useShowToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (
        !validTypes.includes(selectedFile.type) &&
        !selectedFile.name.match(/\.(csv|xlsx|xls)$/)
      ) {
        showErrorToast("Please select a valid CSV or Excel file");
        return;
      }
      setFile(selectedFile);
      setUploadResults(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showErrorToast("Please select a file first");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/organization/users/bulk-upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResults(data);
        showSuccessToast(
          `Successfully uploaded ${data.successful} user(s)${
            data.failed > 0 ? `, ${data.failed} failed` : ""
          }`,
        );
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        showErrorToast(data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showErrorToast("Unable to upload file");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Create CSV template
    const template =
      "firstName,lastName,email,role,department,designation,licenseId\n" +
      "John,Doe,john.doe@example.com,employee,Engineering,Developer,Plan\n" +
      "Jane,Smith,jane.smith@example.com,manager,Marketing,Manager,Execute";

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_users_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setUploadResults(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Bulk Upload Users
          </DialogTitle>
          <DialogDescription>
            Upload multiple users at once using a CSV or Excel file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Download Template */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-1">
                  Download Template First
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                  Download our CSV template to ensure your file has the correct
                  format and required columns.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-sm p-4 text-center hover:border-blue-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-2">
                  Click to select a file or drag and drop
                </p>
                <p className="text-xs text-gray-400">CSV or Excel files only</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select File
                </Button>
              </div>
            )}
          </div>

          {/* Upload Results */}
          {uploadResults && (
            <div className="space-y-2">
              {uploadResults.successful > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-sm">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {uploadResults.successful} users uploaded successfully
                    </span>
                  </div>
                </div>
              )}
              {uploadResults.failed > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-sm">
                  <div className="flex items-center gap-2 text-red-800 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {uploadResults.failed} users failed to upload
                    </span>
                  </div>
                  {uploadResults.errors && uploadResults.errors.length > 0 && (
                    <ul className="text-sm text-red-700 ml-6 space-y-1">
                      {uploadResults.errors.slice(0, 5).map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {uploadResults.errors.length > 5 && (
                        <li className="italic">
                          ...and {uploadResults.errors.length - 5} more errors
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="h-9"
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="h-9 bg-blue-600 hover:bg-blue-700"
          >
            {uploading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Users
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
