import React, { useMemo, useState } from "react";
import { Clock, Search, Eye, RotateCcw } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Pagination from "@/components/common/Pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Importing existing mock data from FormLibrary

import { FormVersionDetailsDialog } from "./FormVersionDetailsDialog";

const ITEMS_PER_PAGE = 2;

const statusColors = {
  published: "bg-green-100 text-green-800",
  draft: "bg-yellow-100 text-yellow-800",
  archived: "bg-gray-100 text-gray-800",
};

function formatDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

const FormVersionHistory = () => {
  const [selectedFormId, setSelectedFormId] = useState(
    mockFormList?.[0]?.formId || "",
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailsVersion, setDetailsVersion] = useState(null);
  const versions = useMemo(() => {
    const list = mockFormVersions[selectedFormId] ?? [];
    // search across version, notes, tags
    const q = searchTerm.trim().toLowerCase();
    let filtered = list.filter((v) => {
      const matchesStatus = statusFilter === "all" || v.status === statusFilter;
      const matchesSearch =
        !q ||
        v.version.toLowerCase().includes(q) ||
        (v.notes || "").toLowerCase().includes(q) ||
        (v.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });

    // sort by createdAt desc by default
    filtered.sort((a, b) => {
      const aT = new Date(a.createdAt).getTime();
      const bT = new Date(b.createdAt).getTime();
      return bT - aT;
    });

    return filtered;
  }, [selectedFormId, statusFilter, searchTerm]);

  const totalPages = Math.ceil(versions.length / ITEMS_PER_PAGE) || 1;
  const pageSlice = versions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const selectedFormName =
    mockFormList.find((f) => f.formId === selectedFormId)?.formName || "";

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-xl bg-blue-500  flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {" "}
                  Form Version History
                </h1>
                <p className="text-sm text-gray-600">
                  Review and manage versions of your form templates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4 bg-gray-50 min-h-screen">
        <div className="bg-white p-4 rounded-sm shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="flex gap-3 w-full md:w-auto">
              <Select
                value={selectedFormId}
                onValueChange={(val) => {
                  setSelectedFormId(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a form" />
                </SelectTrigger>
                <SelectContent>
                  {mockFormList.map((f) => (
                    <SelectItem key={f.formId} value={f.formId}>
                      {f.formName} (v{f.currentVersion})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full md:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search version, notes, or tags..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          <TooltipProvider delayDuration={150}>
            {/* Table */}
            <Table className="min-w-full border rounded-sm">
              <TableHeader>
                <TableRow className="bg-gray-300">
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>

                  <TableHead>Changes</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead
                    className="max-w-[320px] truncate"
                    title="Created At"
                  >
                    Created At
                  </TableHead>
                  <TableHead
                    className="max-w-[320px] truncate"
                    title="Created By"
                  >
                    Created By
                  </TableHead>
                  <TableHead
                    className="max-w-[320px] truncate"
                    title="Published At"
                  >
                    Published At
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageSlice.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      No versions found for{" "}
                      {selectedFormName || "selected form"}.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageSlice.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">
                        <Badge variant="outline">v{v.version}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[v.status] || ""}>
                          {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <TooltipProvider>
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="cursor-default"
                                  aria-label={`${
                                    v.changes?.added ?? 0
                                  } fields added`}
                                >
                                  +{v.changes?.added ?? 0}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="center"
                                sideOffset={6}
                                className="z-[60] bg-gray-900 text-white px-2 py-1 rounded shadow-lg"
                              >
                                Fields added
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="cursor-default"
                                  aria-label={`${
                                    v.changes?.removed ?? 0
                                  } fields removed`}
                                >
                                  -{v.changes?.removed ?? 0}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="center"
                                sideOffset={6}
                                className="z-[60] bg-gray-900 text-white px-2 py-1 rounded shadow-lg"
                              >
                                Fields removed
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="cursor-default"
                                  aria-label={`${
                                    v.changes?.modified ?? 0
                                  } fields modified`}
                                >
                                  ~{v.changes?.modified ?? 0}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="center"
                                sideOffset={6}
                                className="z-[60] bg-gray-900 text-white px-2 py-1 rounded shadow-lg"
                              >
                                Fields modified
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell
                        className="max-w-[320px] truncate"
                        title={v.notes || "-"}
                      >
                        {v.notes || "-"}
                      </TableCell>
                      <TableCell>{formatDate(v.createdAt)}</TableCell>
                      <TableCell>{v.createdBy?.name || "-"}</TableCell>
                      <TableCell>{formatDate(v.publishedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailsVersion(v)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!v.canRollback}
                            title={
                              v.canRollback
                                ? "Rollback to this version"
                                : "Not eligible for rollback"
                            }
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Rollback
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TooltipProvider>

          {/* Details Dialog */}
          <FormVersionDetailsDialog
            open={!!detailsVersion}
            onOpenChange={(open) => {
              if (!open) setDetailsVersion(null);
            }}
            version={detailsVersion}
            versions={versions}
            formId={selectedFormId}
            // baseline="previous" // or "published"
          />
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={versions.length}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );
};

export default FormVersionHistory;
