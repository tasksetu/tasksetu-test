import React, { useState, useMemo, useDeferredValue, Suspense } from "react";
import {
  Search,
  MoreHorizontal,
  Eye,
  Copy,
  Edit,
  Trash2,
  Play,
  Pause,
  BarChart2,
  File,
  FileText,
  Plus,
  SearchCheckIcon,
  Share2,
  Users,
  X,
  ArrowUpDown,
  Link as LinkIcon,
  Loader,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Pagination from "@/components/common/Pagination";
import { Link } from "wouter";
import FormUsageModal from "./FormUsageModal";
import FormSubmissionsModal from "./FormSubmissionsModal";
import FormPublishModal from "./FormPublishModal";
import FormUnpublishModal from "./FormUnpublishModal";
import ShareFormModal from "./ShareFormModal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useShowToast } from "../../utils/ToastMessage";
import CommonLoader from "../common/CommonLoader";
import { FormPreview } from "./FormPreview";
import ConfirmDialog from "../common/ConfirmDialog";

// Mock data based on your requirements

// Version list per form for the Versions UI (summary rows)

// ...existing code...

const FormLibrary = () => {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const token = localStorage.getItem("token");
  const [isPublishOpen, setIsPublishOpen] = useState(false); // <-- add
  const [selectedFormForPublish, setSelectedFormForPublish] = useState(null); // <-- add
  const [selectedDraftSchema, setSelectedDraftSchema] = useState(null); // <-- add
  const [showPreview, setShowPreview] = useState(false);
  const [layout, setLayout] = useState("1-column");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const queryClient = useQueryClient();
  // helper to snapshot (already defined)
  const snapshot = (obj) =>
    typeof structuredClone === "function"
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj));

  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "ascending",
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    fields: [],
    settings: {
      allowAnonymous: true,
      submitMessage: "Thank you for your submission!",
    },
  });
  // usage model
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [selectedFormForUsage, setSelectedFormForUsage] = useState(null);
  const [confirmFormDelete, setConfirmFormDelete] = useState({
    isOpen: false,
    formId: null,
    title: "",
  });
  const [confirmFormArchive, setConfirmFormArchive] = useState({
    isOpen: false,
    form: null,
  });
  //  submission model
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [selectedFormForSubmissions, setSelectedFormForSubmissions] =
    useState(null);
  // share modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedFormForShare, setSelectedFormForShare] = useState(null);
  // unpublish modal
  const [isUnpublishModalOpen, setIsUnpublishModalOpen] = useState(false);
  const [selectedFormForUnpublish, setSelectedFormForUnpublish] =
    useState(null);

  const statusColors = {
    PUBLISHED: "bg-green-100 text-green-800",
    DRAFT: "bg-yellow-100 text-yellow-800",
    ARCHIVED: "bg-gray-100 text-gray-800",
  };

  const roleColors = {
    OWNER: "bg-blue-100 text-blue-800",
    EDITOR: "bg-purple-100 text-purple-800",
    VIEWER: "bg-gray-100 text-gray-800",
    ORG_ADMIN: "bg-orange-100 text-orange-800",
    SUPER_ADMIN: "bg-red-100 text-red-800",
  };

  const roleLabels = {
    OWNER: "Owner",
    EDITOR: "Editor",
    VIEWER: "Viewer",
    ORG_ADMIN: "Company Admin",
    SUPER_ADMIN: "Platform Admin",
  };

  // Fetch forms with pagination
  const [formsPage, setFormsPage] = useState(1);
  const FORMS_LIMIT = 5; // number of form cards per page

  // Fetch categories
  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["formCategories"],
    queryFn: async () => {
      const res = await fetch(`/api/forms/categories`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  const categories = categoriesData || [];

  const {
    data: formsData,
    isLoading,
    isError: isFormsError,
    error: formsError,
  } = useQuery({
    queryKey: [
      "forms",
      formsPage,
      deferredSearch,
      statusFilter,
      categoryFilter,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: formsPage.toString(),
        limit: FORMS_LIMIT.toString(),
        search: deferredSearch,
        sortBy,
        sortOrder,
      });

      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (categoryFilter && categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }

      const res = await fetch(`/api/forms?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch forms");
      }
      const data = await res.json();
      return data; // { success:true, data: { forms, pagination } }
    },
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
    enabled: !!token, //
  });

  const forms = formsData?.data?.forms || [];
  const formsPagination = formsData?.data?.pagination || {
    total: forms.length,
    page: formsPage,
    limit: FORMS_LIMIT,
    pages: 1,
    hasMore: false,
  };
  const loadFormIntoBuilder = async (formId) => {
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch form");
      }
      const payload = await res.json();
      const remote = payload?.data;
      if (!remote) throw new Error("Invalid form data");

      // Map server form to client form shape
      const mappedFields = (remote.fields || []).map((f, idx) => {
        // f may have field_id (ObjectId) or _id
        const id =
          (f.field_id && String(f.field_id)) ||
          (f._id && String(f._id)) ||
          `field_${Date.now()}_${idx}`;

        // client expects options as array of strings in many places,
        // backend stores options as array of {label, value}
        let options = [];
        if (Array.isArray(f.options)) {
          options = f.options.map((o) =>
            typeof o === "string" ? o : (o.label ?? o.value ?? ""),
          );
        }

        return {
          id,
          type: f.type,
          label: f.label || "",
          placeholder: f.placeholder || "",
          description: f.description || "",
          required: f.isRequired ?? f.required ?? false,
          hasOption: f.hasOption ?? options.length > 0,
          options,
          order: typeof f.order === "number" ? f.order : idx,
          validation: f.validation || {},
          meta: f.meta || {},
          // keep any other properties that client might use later
        };
      });

      const mappedForm = {
        form_id: remote.form_id,
        title: remote.title || "",
        description: remote.description || "",
        fields: mappedFields,
        settings: {
          allowAnonymous:
            remote.settings?.allowAnonymous ??
            remote.settings?.allow_anonymous ??
            true,
          submitMessage:
            remote.settings?.submitMessage ??
            remote.settings?.submitMessage ??
            "Thank you for your submission!",
          layout: remote.settings?.layout ?? "1-column",
          maxSubmissions: remote.settings?.maxSubmissions ?? null,
          redirectUrl: remote.settings?.redirectUrl ?? null,
        },
      };

      // Load into builder and initialize history so undo/redo works naturally
      const snap = snapshot(mappedForm);
      setForm(snap);
      setShowPreview(true);
    } catch (err) {
      console.error("Failed to load form:", err);
      showErrorToast(err.message || "Unable to load form");
    }
  };
  const cloneFormMutation = useMutation({
    mutationFn: async ({ formId }) => {
      const res = await fetch(`/api/forms/clone/${formId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error("Failed to clone form");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/forms"]);
      showSuccessToast("Form cloned");
    },
    onError: (err) => {
      showErrorToast(err.message || "Unable to clone form");
    },
  });

  const buildDraftSchema = (form) => ({
    title: form.name,
    description: `${form.category_id || ""} template`,
    fields: (form.fields || []).map((f) => ({
      id: f.id,
      type: "text", // placeholder type for mock rows
      label: f.label,
      required: false,
      placeholder: "",
    })),
  });

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };
  // usage model
  const handleOpenUsageModal = (form) => {
    setSelectedFormForUsage(form);
    setIsUsageModalOpen(true);
  };

  const handleCloseUsageModal = () => {
    setIsUsageModalOpen(false);
    setSelectedFormForUsage(null);
  };

  // submission model
  const handleOpenSubmissionsModal = (form) => {
    setSelectedFormForSubmissions(form);
    setIsSubmissionsModalOpen(true);
  };

  const handleCloseSubmissionsModal = () => {
    setIsSubmissionsModalOpen(false);
    setSelectedFormForSubmissions(null);
  };

  // share modal
  const handleOpenShareModal = (form) => {
    setSelectedFormForShare(form);
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setSelectedFormForShare(null);
  };

  // unpublish modal
  const handleOpenUnpublishModal = (form) => {
    setSelectedFormForUnpublish(form);
    setIsUnpublishModalOpen(true);
  };

  const handleCloseUnpublishModal = (unpublished) => {
    setIsUnpublishModalOpen(false);
    if (unpublished) {
      queryClient.invalidateQueries(["forms"]);
    }
    setSelectedFormForUnpublish(null);
  };

  const handleOpenPublishFromLibrary = (form) => {
    setSelectedFormForPublish(form);
    setSelectedDraftSchema(buildDraftSchema(form));
    setIsPublishOpen(true);
  };
  const handleClosePublish = (published) => {
    setIsPublishOpen(false);
    if (published) {
      // Invalidate forms query to refresh the list
      queryClient.invalidateQueries(["forms"]);
    }
    setSelectedFormForPublish(null);
    setSelectedDraftSchema(null);
  };
  const openConfirmFormDelete = (form) => {
    console.log("title", form);

    setConfirmFormDelete({
      isOpen: true,
      formId: form.form_id,
      title:
        `<span class='font-semibold mt-2'> Form Code :</span> ${form.form_code} <br/> <span class='font-semibold mt-2'> Form Title :</span>  ${form.title}` ||
        "Untitled form",
    });
  };
  const closeConfirmFormDelete = () => {
    setConfirmFormDelete({ isOpen: false, formId: null, title: "" });
  };
  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`/api/forms/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete form");
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["forms"]);
      closeConfirmFormDelete();

      showSuccessToast("Form deleted");
    },
    onError: (error) => {
      showErrorToast(error.message || "Unable to delete form");
    },
  });
  const confirmRemoveForm = () => {
    if (confirmFormDelete.isOpen) {
      deleteFormMutation.mutate(confirmFormDelete.formId);
    }
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearchTerm("");
    setFormsPage(1);
  };

  const hasActiveFilters =
    statusFilter !== "all" || categoryFilter !== "all" || searchTerm;

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Role-based permission helpers
  const canEdit = (form) => {
    const role = form.user_role;
    // Can edit: OWNER, EDITOR, ORG_ADMIN, SUPER_ADMIN
    return ["OWNER", "EDITOR", "ORG_ADMIN", "SUPER_ADMIN"].includes(role);
  };

  const canDelete = (form) => {
    const role = form.user_role;
    // Can delete: OWNER, ORG_ADMIN, SUPER_ADMIN only
    // Subject to dependency rules (checked in backend)
    return ["OWNER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role);
  };

  const canPublish = (form) => {
    const role = form.user_role;
    // Can publish: OWNER, ORG_ADMIN, SUPER_ADMIN only
    // Template Editor (EDITOR role) CANNOT publish as per spec
    return ["OWNER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role);
  };

  const canShare = (form) => {
    const role = form.user_role;
    // Can share: OWNER, ORG_ADMIN, SUPER_ADMIN only
    return ["OWNER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role);
  };

  const copyPublicLink = (form) => {
    // Check if form has external submission enabled and external_token
    const externalToken =
      form.external_token || form.current_version_id?.external_token;

    if (!externalToken) {
      showErrorToast(
        "This form doesn't have a public link. Enable external submissions when publishing.",
      );
      return;
    }

    const publicUrl = `${window.location.origin}/forms/public/${externalToken}`;

    navigator.clipboard
      .writeText(publicUrl)
      .then(() => {
        showSuccessToast("Public link copied");
      })
      .catch(() => {
        showErrorToast("Unable to copy link");
      });
  };

  return (
    <div className="bg-gray-50 min-h-screen px-6 py-3 pb-6">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
              Form Library
            </h1>
            <p className="mt-0 text-sm text-blue-600">
              Manage, create, and track all your form templates.
            </p>
          </div>
          <Link href="/form-builder">
            <Button variant="primary" className="h-8">
              <Plus className="h-4 w-4 mr-2" />
              Create New Form
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200">
          {/* Toolbar */}
          <div className="mb-3">
            {/* Single Row: Search, Status, Sort By, Order, Clear */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, owner, category, or tag..."
                  className="pl-10 h-8 min-h-8 max-h-8 py-0 leading-none rounded-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFormsPage(1);
                  }}
                />
              </div>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setFormsPage(1);
                }}
              >
                <SelectTrigger className="w-[140px] h-8 min-h-8 py-0 rounded-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-sm">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              {/* <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value);
                setFormsPage(1);
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Categories</SelectItem>
                  {isCategoriesLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : categories.length === 0 ? (
                    <SelectItem value="none" disabled>No categories</SelectItem>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat._id} value={cat._id}>
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select> */}

              {/* Sort By */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px] h-8 min-h-8 py-0 rounded-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-sm">
                  <SelectItem value="created_at">Created Date</SelectItem>
                  <SelectItem value="updated_at">Updated Date</SelectItem>
                  <SelectItem value="title">Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="lastUsed">Last Used</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Order */}
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-[130px] h-8 min-h-8 py-0 rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-sm">
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-sm"
                  onClick={clearAllFilters}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <Table className="min-w-full border rounded-sm">
            <TableHeader>
              <TableRow>
                {/* <TableHead>Code</TableHead> */}
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort("title")}
                >
                  <div className="flex items-center gap-1">
                    Name
                    {sortBy === "title" && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                {/* <TableHead>Category</TableHead> */}
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortBy === "status" && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort("lastUsed")}
                >
                  <div className="flex items-center gap-1">
                    Last Used
                    {sortBy === "lastUsed" && (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <Loader className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-lg text-gray-600">
                          Loading Forms...
                        </p>
                      </div>
                  </TableCell>
                </TableRow>
              ) : forms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="text-center py-12 bg-slate-50/50 rounded-sm">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="p-3 bg-slate-100 rounded-sm">
                          <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-slate-900">
                            No forms created yet
                          </h3>
                          <p className="text-slate-500 mt-1">
                            Create your first form using the builder above
                          </p>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                forms.map((form) => (
                  <TableRow key={form._id || form.form_id}>
                    {/* <TableCell className="font-mono text-sm">
                      {form.form_code || form.form_code || "-"}
                    </TableCell> */}
                    <TableCell className="font-medium">
                      {" "}
                      {form.title || "-"}
                    </TableCell>
                    {/* <TableCell>
                      {form.category_id || "-"}
                    </TableCell> */}
                    <TableCell>
                      <Badge
                        className={`${statusColors[form.status]} hover:${
                          statusColors[form.status]
                        }`}
                      >
                        {form.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {form.current_version_id?.last_submission_at
                        ? new Date(
                            form.current_version_id.last_submission_at,
                          ).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {form.tags?.length > 0
                          ? form.tags.map((tag) => (
                              <Badge key={tag} variant="outline">
                                {tag.charAt(0).toUpperCase() +
                                  tag.slice(1).toLowerCase()}
                              </Badge>
                            ))
                          : "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        {form.visibility || "PUBLIC"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {form.scope ? (
                        <Badge variant="outline">{form.scope}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white" align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              loadFormIntoBuilder(form.form_id);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" /> Preview
                          </DropdownMenuItem>

                          {/* Edit - Only OWNER, EDITOR, ORG_ADMIN, SUPER_ADMIN */}
                          <DropdownMenuItem
                            disabled={!canEdit(form)}
                            onClick={() => {
                              if (canEdit(form)) {
                                // Use wouter navigation instead of window.location to avoid page refresh
                                // The form builder will read the edit param from URL
                                window.location.href = `/form-builder?edit=${form.form_id}`;
                              }
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                            {!canEdit(form) && (
                              <span className="ml-auto text-xs text-gray-400">
                                {form.user_role === "VIEWER"
                                  ? "View only"
                                  : "No access"}
                              </span>
                            )}
                          </DropdownMenuItem>

                          {/* Publish/Unpublish - Only OWNER, ORG_ADMIN, SUPER_ADMIN */}
                          {form.status === "PUBLISHED" ? (
                            <DropdownMenuItem
                              disabled={!canPublish(form)}
                              onClick={() => {
                                if (canPublish(form)) {
                                  handleOpenUnpublishModal(form);
                                }
                              }}
                            >
                              <Pause className="mr-2 h-4 w-4" />
                              Unpublish
                              {!canPublish(form) && (
                                <span className="ml-auto text-xs text-gray-400">
                                  Owner only
                                </span>
                              )}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={
                                !canPublish(form) || form.status === "ARCHIVED"
                              }
                              onClick={() => {
                                if (canPublish(form)) {
                                  handleOpenPublishFromLibrary(form);
                                }
                              }}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Publish
                              {!canPublish(form) && (
                                <span className="ml-auto text-xs text-gray-400">
                                  Owner only
                                </span>
                              )}
                            </DropdownMenuItem>
                          )}

                          {/* Share - Only OWNER, ORG_ADMIN, SUPER_ADMIN */}
                          <DropdownMenuItem
                            onClick={() => handleOpenShareModal(form)}
                            disabled={!canShare(form)}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                            {!canShare(form) && (
                              <span className="ml-auto text-xs text-gray-400">
                                Owner only
                              </span>
                            )}
                          </DropdownMenuItem>

                          {/* Copy Public Link - If external submission enabled */}
                          {form.external_submission_enabled &&
                            (form.external_token ||
                              form.current_version_id?.external_token) && (
                              <DropdownMenuItem
                                onClick={() => copyPublicLink(form)}
                              >
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Copy Public Link
                              </DropdownMenuItem>
                            )}

                          {/* Clone - Everyone can clone */}
                          <DropdownMenuItem
                            onClick={() =>
                              cloneFormMutation.mutate({ formId: form.form_id })
                            }
                          >
                            <Copy className="mr-2 h-4 w-4" /> Clone
                          </DropdownMenuItem>

                          {/* Submissions - VIEW permission required */}
                          <DropdownMenuItem
                            onClick={() => handleOpenSubmissionsModal(form)}
                          >
                            <FileText className="mr-2 h-4 w-4" /> Submissions
                          </DropdownMenuItem>

                          {/* Usage Stats - VIEW permission required */}
                          {/* <DropdownMenuItem
                            onClick={() => handleOpenUsageModal(form)}
                          >
                            <BarChart2 className="mr-2 h-4 w-4" /> Usage
                          </DropdownMenuItem> */}

                          {/* Delete - Only OWNER, ORG_ADMIN, SUPER_ADMIN */}
                          <DropdownMenuItem
                            className="text-red-500"
                            disabled={!canDelete(form)}
                            onClick={() => {
                              if (canDelete(form)) {
                                openConfirmFormDelete(form);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                            {!canDelete(form) && (
                              <span className="ml-auto text-xs text-gray-400">
                                Owner only
                              </span>
                            )}
                          </DropdownMenuItem>

                          {/* Archive - Only OWNER, ORG_ADMIN, SUPER_ADMIN, and not already archived */}
                          {form.status !== "ARCHIVED" && canDelete(form) && (
                            <DropdownMenuItem
                              className="text-gray-700"
                              onClick={() => {
                                setConfirmFormArchive({ isOpen: true, form });
                              }}
                            >
                              <Pause className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {showPreview && (
            <Suspense
              fallback={
                <div className="p-4">
                  <CommonLoader />
                </div>
              }
            >
              <FormPreview
                form={form}
                layout={layout}
                onClose={() => setShowPreview(false)}
              />
            </Suspense>
          )}

          {/* Submissions Modal */}
          <FormSubmissionsModal
            isOpen={isSubmissionsModalOpen}
            onClose={handleCloseSubmissionsModal}
            formId={selectedFormForSubmissions?._id}
            formName={selectedFormForSubmissions?.name}
          />

          {/* Share Modal */}
          <ShareFormModal
            open={isShareModalOpen}
            onClose={handleCloseShareModal}
            formId={selectedFormForShare?.form_id}
          />

          {/* Usage Modal */}
          {/* <FormUsageModal
            isOpen={isUsageModalOpen}
            onClose={handleCloseUsageModal}
            form={selectedFormForUsage}
          /> */}

          {/* Publish Modal from Library */}
          <FormPublishModal
            open={isPublishOpen}
            onClose={handleClosePublish}
            formId={selectedFormForPublish?._id}
            draftSchema={selectedDraftSchema}
          />

          {/* Unpublish Modal */}
          <FormUnpublishModal
            open={isUnpublishModalOpen}
            onClose={handleCloseUnpublishModal}
            formId={selectedFormForUnpublish?._id}
            formTitle={selectedFormForUnpublish?.title}
            formStatus={selectedFormForUnpublish?.status}
          />

          <ConfirmDialog
            isOpen={confirmFormDelete.isOpen}
            title="Delete this form?"
            description={confirmFormDelete.title}
            confirmLabel="Delete"
            onCancel={closeConfirmFormDelete}
            onConfirm={confirmRemoveForm}
            confirmVariant="destructive"
          />

          {/* Archive Form Confirmation */}
          <ConfirmDialog
            isOpen={confirmFormArchive.isOpen}
            title="Archive this form?"
            description="This will prevent new attachments and submissions, but keep historical data."
            confirmLabel="Archive"
            cancelLabel="Cancel"
            confirmVariant="destructive"
            onCancel={() =>
              setConfirmFormArchive({ isOpen: false, form: null })
            }
            onConfirm={async () => {
              const form = confirmFormArchive.form;
              setConfirmFormArchive({ isOpen: false, form: null });
              try {
                const res = await fetch(`/api/forms/${form.form_id}/archive`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                  },
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  showErrorToast(err.message || "Unable to archive form");
                } else {
                  showSuccessToast("Form archived");
                  queryClient.invalidateQueries(["forms"]);
                }
              } catch (e) {
                showErrorToast("Unable to archive form");
              }
            }}
          />

          {/* Pagination */}
          <Pagination
            currentPage={formsPagination.page}
            totalPages={formsPagination.pages}
            itemsPerPage={formsPagination.limit}
            totalItems={formsPagination.total}
            onPageChange={setFormsPage}
          />
        </div>
      </div>
    </div>
  );
};

export default FormLibrary;
