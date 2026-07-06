import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar as CalendarIcon,
  MapPin,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useShowToast } from "../../utils/ToastMessage";
import SafeHtml from "../common/SafeHtml";

/**
 * Authenticated file opener for form submission files.
 * Fetches the file via authenticated API and opens as blob URL.
 * Falls back to direct open for base64 data URIs (legacy).
 */
const openFormFile = (submissionId, attachmentId, fileName, mimeType) => {
  if (!submissionId || !attachmentId) return;

  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Authentication required to view file");
    return;
  }

  const endpoint = `/api/forms/submissions/${submissionId}/files/${attachmentId}/view`;

  fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      if (response.ok) return response.blob();
      let errorMsg = "Failed to load file";
      try {
        const data = await response.json();
        errorMsg = data.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    })
    .then((blob) => {
      const blobWithType = new Blob([blob], { type: mimeType || blob.type });
      const url = window.URL.createObjectURL(blobWithType);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    })
    .catch((error) => {
      console.error("Error opening form file:", error);
    });
};

/**
 * Legacy file opener for base64 data URIs only (fallback for old submissions).
 */
const openFileInNewTab = (dataUri, fileName, mimeType) => {
  if (!dataUri || !dataUri.startsWith("data:")) return;

  try {
    const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return;
    const mime = matches[1];
    const base64 = matches[2];
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    console.error("Error opening base64 file:", err);
  }
};

const FormSubmissionsModal = ({ isOpen, onClose, formId, formName }) => {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const token = localStorage.getItem("token");

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [searchSubmitter, setSearchSubmitter] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [addressCache, setAddressCache] = useState({});

  // Reverse geocoding function
  const getAddressFromCoordinates = async (lat, lng) => {
    const cacheKey = `${lat},${lng}`;

    // Check cache first
    if (addressCache[cacheKey]) {
      return addressCache[cacheKey];
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      );
      const data = await response.json();

      const address =
        data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      // Cache the result
      setAddressCache((prev) => ({ ...prev, [cacheKey]: address }));

      return address;
    } catch (error) {
      console.error("Geocoding error:", error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  // Fetch submissions with filters
  const { data: submissionsData, isLoading } = useQuery({
    queryKey: [
      "formSubmissions",
      formId,
      page,
      statusFilter,
      startDate,
      endDate,
      searchSubmitter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });

      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (startDate) {
        params.append("start_date", startDate.toISOString());
      }
      if (endDate) {
        params.append("end_date", endDate.toISOString());
      }
      if (searchSubmitter) {
        params.append("submitted_by", searchSubmitter);
      }

      const response = await fetch(`/api/forms/${formId}/responses?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch submissions");
      }

      return response.json();
    },
    enabled: isOpen && !!formId,
  });

  // CSV Export
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ format: "csv" });

      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (startDate) {
        params.append("start_date", startDate.toISOString());
      }
      if (endDate) {
        params.append("end_date", endDate.toISOString());
      }

      const response = await fetch(`/api/forms/${formId}/responses?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to export CSV");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formName || "form"}_submissions_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showSuccessToast("CSV exported");
    } catch (error) {
      showErrorToast(error.message || "Failed to export CSV");
    }
  };

  const submissions = submissionsData?.data?.submissions || [];
  const pagination = submissionsData?.data?.pagination || {};

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-sm p-4 max-w-7xl w-full shadow-xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 border-b pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Submissions:{" "}
            <span className="text-gray-700">{formName || "Form"}</span>
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCSV} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-4 gap-3 mb-3 pb-4 border-b">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Status
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Start Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PP") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              End Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PP") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => startDate && date < startDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Search Submitter
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Name or email..."
                value={searchSubmitter}
                onChange={(e) => setSearchSubmitter(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading submissions...</div>
            </div>
          ) : submissions.length > 0 ? (
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow>
                  <TableHead className="w-32">Submission ID</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <React.Fragment key={submission.submission_id}>
                    <TableRow className="hover:bg-gray-50">
                      <TableCell className="font-mono text-xs">
                        {submission.submission_id?.slice(0, 8) || "N/A"}
                      </TableCell>
                      <TableCell>
                        {submission.submitted_by?.firstName ? (
                          <div>
                            <div className="font-medium">
                              {submission.submitted_by.firstName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {submission.submitted_by.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">
                            Anonymous
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {submission.submitted_at
                          ? format(new Date(submission.submitted_at), "PPp")
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "px-2 py-1 text-xs rounded-full font-medium",
                            submission.status === "APPROVED" &&
                              "bg-green-100 text-green-700",
                            submission.status === "REJECTED" &&
                              "bg-red-100 text-red-700",
                            submission.status === "PENDING" &&
                              "bg-yellow-100 text-yellow-700",
                          )}
                        >
                          {submission.status || "PENDING"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={cn(
                            "px-2 py-1 text-xs rounded font-medium",
                            submission.source === "EXTERNAL" &&
                              "bg-purple-100 text-purple-700",
                            submission.source === "TASK" &&
                              "bg-blue-100 text-blue-700",
                            submission.source === "SUBTASK" &&
                              "bg-cyan-100 text-cyan-700",
                          )}
                        >
                          {submission.source || "UNKNOWN"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === submission.submission_id
                                ? null
                                : submission.submission_id,
                            )
                          }
                        >
                          {expandedRow === submission.submission_id
                            ? "Hide"
                            : "View"}{" "}
                          Data
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRow === submission.submission_id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-gray-50 p-3">
                          <div className="text-xs font-semibold mb-2 text-gray-700">
                            Submission Data:
                          </div>
                          <div className="bg-white rounded border overflow-hidden">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-200">
                              {submission.form_version_id?.snapshot_data?.fields?.map(
                                (field) => {
                                  // Try both field_code and field.label (field.label for backend transformed data)
                                  const value =
                                    submission.submission_data_json?.[
                                      field.label
                                    ] ||
                                    submission.submission_data_json?.[
                                      field.field_code
                                    ] ||
                                    submission.submission_data_json?.[
                                      field.field_id
                                    ];

                                  // Skip null/undefined values
                                  if (
                                    value === null ||
                                    value === undefined ||
                                    value === ""
                                  )
                                    return null;

                                  return (
                                    <div
                                      key={field.field_id}
                                      className="bg-white p-2"
                                    >
                                      <div
                                        className="text-[10px] font-medium text-gray-500 mb-0.5 truncate"
                                        title={field.label}
                                      >
                                        {field.label}
                                      </div>
                                      <div className="text-xs text-gray-900">
                                        {/* Rich Text */}
                                        {field.type === "rich_text" && (
                                          <SafeHtml
                                            html={value}
                                            className="prose prose-xs max-w-none line-clamp-2"
                                          />
                                        )}

                                        {/* Arrays (Multiselect, Checkboxes) */}
                                        {Array.isArray(value) &&
                                          field.type !== "file_upload" && (
                                            <div className="flex flex-wrap gap-0.5">
                                              {value
                                                .slice(0, 3)
                                                .map((val, idx) => {
                                                  const option =
                                                    field.options?.find(
                                                      (opt) =>
                                                        opt.value === val,
                                                    );
                                                  return (
                                                    <span
                                                      key={idx}
                                                      className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]"
                                                    >
                                                      {option?.label || val}
                                                    </span>
                                                  );
                                                })}
                                              {value.length > 3 && (
                                                <span className="text-[10px] text-gray-500">
                                                  +{value.length - 3}
                                                </span>
                                              )}
                                            </div>
                                          )}

                                        {/* Dropdown/Radio (Single Select) */}
                                        {!Array.isArray(value) &&
                                          field.hasOption &&
                                          typeof value === "string" && (
                                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] inline-block">
                                              {field.options?.find(
                                                (opt) => opt.value === value,
                                              )?.label || value}
                                            </span>
                                          )}

                                        {/* Boolean (Toggle) */}
                                        {typeof value === "boolean" && (
                                          <span
                                            className={cn(
                                              "px-1.5 py-0.5 rounded text-[10px] font-medium inline-block",
                                              value
                                                ? "bg-green-100 text-green-700"
                                                : "bg-gray-100 text-gray-700",
                                            )}
                                          >
                                            {value ? "Yes" : "No"}
                                          </span>
                                        )}

                                        {/* Date */}
                                        {field.type === "date" &&
                                          typeof value === "string" && (
                                            <span className="text-gray-700 text-[11px]">
                                              {format(new Date(value), "PP")}
                                            </span>
                                          )}

                                        {/* DateTime */}
                                        {field.type === "datetime" &&
                                          typeof value === "string" && (
                                            <span className="text-gray-700 text-[11px]">
                                              {format(new Date(value), "Pp")}
                                            </span>
                                          )}

                                        {/* Number/Decimal */}
                                        {typeof value === "number" && (
                                          <span className="font-mono text-gray-700 text-[11px]">
                                            {value}
                                          </span>
                                        )}

                                        {/* Signature */}
                                        {field.type === "signature" &&
                                          typeof value === "string" &&
                                          value.startsWith("data:image") && (
                                            <img
                                              src={value}
                                              alt="Signature"
                                              className="border rounded w-full h-12 object-contain bg-gray-50"
                                            />
                                          )}

                                        {/* Location */}
                                        {field.type === "location_picker" &&
                                          typeof value === "object" &&
                                          value.lat && (
                                            <LocationDisplay
                                              lat={value.lat}
                                              lng={value.lng}
                                              getAddress={
                                                getAddressFromCoordinates
                                              }
                                            />
                                          )}

                                        {/* URL */}
                                        {field.type === "url" &&
                                          typeof value === "string" && (
                                            <a
                                              href={value}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:underline text-[10px] break-all line-clamp-1"
                                              title={value}
                                            >
                                              {value}
                                            </a>
                                          )}

                                        {/* Email */}
                                        {field.type === "email" &&
                                          typeof value === "string" && (
                                            <a
                                              href={`mailto:${value}`}
                                              className="text-blue-600 hover:underline text-[11px] truncate block"
                                              title={value}
                                            >
                                              {value}
                                            </a>
                                          )}

                                        {/* Phone */}
                                        {field.type === "phone" &&
                                          typeof value === "string" && (
                                            <a
                                              href={`tel:${value}`}
                                              className="text-blue-600 hover:underline text-[11px]"
                                            >
                                              {value}
                                            </a>
                                          )}

                                        {/* File Upload */}
                                        {field.type === "file_upload" &&
                                          Array.isArray(value) &&
                                          value.length > 0 && (
                                            <div className="space-y-0.5">
                                              {value
                                                .slice(0, 2)
                                                .map((file, idx) => {
                                                  const fileName =
                                                    file.filename ||
                                                    file.name ||
                                                    file.original_filename ||
                                                    `File ${idx + 1}`;
                                                  const filePath =
                                                    file.file_path ||
                                                    file.url ||
                                                    file.path ||
                                                    file.data;
                                                  // Find matching attachment by field_id and filename
                                                  const fieldCode =
                                                    field.field_code ||
                                                    field.field_id;
                                                  const matchingAttachment =
                                                    submission.attachments?.find(
                                                      (a) =>
                                                        a.field_id ===
                                                          fieldCode &&
                                                        a.filename ===
                                                          file.filename,
                                                    ) ||
                                                    submission.attachments?.find(
                                                      (a) =>
                                                        a.field_id ===
                                                          fieldCode &&
                                                        a.file_path ===
                                                          filePath,
                                                    );
                                                  return (
                                                    <div
                                                      key={idx}
                                                      className="flex items-center gap-1 text-[10px] text-blue-600"
                                                    >
                                                      <FileText className="h-2.5 w-2.5 flex-shrink-0" />
                                                      {matchingAttachment?._id ? (
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            openFormFile(
                                                              submission._id,
                                                              matchingAttachment._id,
                                                              fileName,
                                                              file.type ||
                                                                file.mime_type,
                                                            )
                                                          }
                                                          className="truncate hover:underline text-left cursor-pointer"
                                                          title={`Click to open: ${fileName}`}
                                                        >
                                                          {fileName}
                                                        </button>
                                                      ) : filePath?.startsWith(
                                                          "data:",
                                                        ) ? (
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            openFileInNewTab(
                                                              filePath,
                                                              fileName,
                                                              file.type ||
                                                                file.mime_type,
                                                            )
                                                          }
                                                          className="truncate hover:underline text-left cursor-pointer"
                                                          title={`Click to open: ${fileName}`}
                                                        >
                                                          {fileName}
                                                        </button>
                                                      ) : (
                                                        <span
                                                          className="truncate"
                                                          title={fileName}
                                                        >
                                                          {fileName}
                                                        </span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              {value.length > 2 && (
                                                <span className="text-[10px] text-gray-500">
                                                  +{value.length - 2} more
                                                </span>
                                              )}
                                            </div>
                                          )}

                                        {/* File Upload - Handle single file object (base64 or server-stored) */}
                                        {field.type === "file_upload" &&
                                          !Array.isArray(value) &&
                                          typeof value === "object" &&
                                          value !== null &&
                                          (value.filename ||
                                            value.name ||
                                            value.data ||
                                            value.file_path) && (
                                            <div className="space-y-0.5">
                                              {(() => {
                                                const fileName =
                                                  value.filename ||
                                                  value.name ||
                                                  "File";
                                                const filePath =
                                                  value.file_path ||
                                                  value.url ||
                                                  value.path ||
                                                  value.data;
                                                const fieldCode =
                                                  field.field_code ||
                                                  field.field_id;
                                                const matchingAttachment =
                                                  submission.attachments?.find(
                                                    (a) =>
                                                      a.field_id ===
                                                        fieldCode &&
                                                      a.filename ===
                                                        value.filename,
                                                  ) ||
                                                  submission.attachments?.find(
                                                    (a) =>
                                                      a.field_id ===
                                                        fieldCode &&
                                                      a.file_path === filePath,
                                                  );
                                                return (
                                                  <div className="flex items-center gap-1 text-[10px] text-blue-600">
                                                    <FileText className="h-2.5 w-2.5 flex-shrink-0" />
                                                    {matchingAttachment?._id ? (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          openFormFile(
                                                            submission._id,
                                                            matchingAttachment._id,
                                                            fileName,
                                                            value.type ||
                                                              value.mime_type,
                                                          )
                                                        }
                                                        className="truncate hover:underline text-left cursor-pointer"
                                                        title={`Click to open: ${fileName}`}
                                                      >
                                                        {fileName}{" "}
                                                        {value.size
                                                          ? `(${(value.size / 1024).toFixed(1)} KB)`
                                                          : ""}
                                                      </button>
                                                    ) : filePath?.startsWith(
                                                        "data:",
                                                      ) ? (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          openFileInNewTab(
                                                            filePath,
                                                            fileName,
                                                            value.type ||
                                                              value.mime_type,
                                                          )
                                                        }
                                                        className="truncate hover:underline text-left cursor-pointer"
                                                        title={`Click to open: ${fileName}`}
                                                      >
                                                        {fileName}{" "}
                                                        {value.size
                                                          ? `(${(value.size / 1024).toFixed(1)} KB)`
                                                          : ""}
                                                      </button>
                                                    ) : (
                                                      <span
                                                        className="truncate"
                                                        title={fileName}
                                                      >
                                                        {fileName}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          )}

                                        {/* File Upload - Handle string (URL/path) */}
                                        {field.type === "file_upload" &&
                                          typeof value === "string" &&
                                          value && (
                                            <div className="space-y-0.5">
                                              {(() => {
                                                const fieldCode =
                                                  field.field_code ||
                                                  field.field_id;
                                                const matchingAttachment =
                                                  submission.attachments?.find(
                                                    (a) =>
                                                      a.field_id === fieldCode,
                                                  );
                                                const displayName =
                                                  value.split("/").pop() ||
                                                  "File";
                                                return (
                                                  <div className="flex items-center gap-1 text-[10px] text-blue-600">
                                                    <FileText className="h-2.5 w-2.5 flex-shrink-0" />
                                                    {matchingAttachment?._id ? (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          openFormFile(
                                                            submission._id,
                                                            matchingAttachment._id,
                                                            displayName,
                                                            matchingAttachment.mime_type,
                                                          )
                                                        }
                                                        className="truncate hover:underline text-left cursor-pointer"
                                                        title={`Click to open: ${displayName}`}
                                                      >
                                                        {displayName}
                                                      </button>
                                                    ) : value.startsWith(
                                                        "data:",
                                                      ) ? (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          openFileInNewTab(
                                                            value,
                                                            displayName,
                                                          )
                                                        }
                                                        className="truncate hover:underline text-left cursor-pointer"
                                                        title={displayName}
                                                      >
                                                        {displayName}
                                                      </button>
                                                    ) : (
                                                      <span
                                                        className="truncate"
                                                        title={displayName}
                                                      >
                                                        {displayName}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          )}

                                        {/* Default: Text */}
                                        {typeof value === "string" &&
                                          !field.hasOption &&
                                          field.type !== "rich_text" &&
                                          field.type !== "signature" &&
                                          field.type !== "url" &&
                                          field.type !== "email" &&
                                          field.type !== "phone" &&
                                          field.type !== "date" &&
                                          field.type !== "datetime" &&
                                          field.type !== "file_upload" && (
                                            <span
                                              className="text-gray-700 text-[11px] line-clamp-2 break-words"
                                              title={value}
                                            >
                                              {value}
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="h-12 w-12 mb-2 text-gray-400" />
              <div>No submissions found for this form.</div>
              <div className="text-sm">Try adjusting your filters.</div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {(pagination.current_page - 1) * pagination.limit + 1} to{" "}
              {Math.min(
                pagination.current_page * pagination.limit,
                pagination.total_count,
              )}{" "}
              of {pagination.total_count} submissions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.current_page} of {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.total_pages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Location Display Component with Address Conversion
const LocationDisplay = ({ lat, lng, getAddress }) => {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAddress = async () => {
      setLoading(true);
      const addr = await getAddress(lat, lng);
      setAddress(addr);
      setLoading(false);
    };
    fetchAddress();
  }, [lat, lng, getAddress]);

  if (loading) {
    return (
      <div className="flex items-start gap-1 text-[10px] text-gray-500">
        <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1 text-[10px] text-gray-600">
      <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5 text-blue-600" />
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline line-clamp-2 break-words"
        title={address}
      >
        {address}
      </a>
    </div>
  );
};

export default FormSubmissionsModal;
