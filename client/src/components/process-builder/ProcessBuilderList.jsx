import React, { useState } from "react";
import {
  useProcesses,
  useCreateProcess,
  useUpdateProcess,
  useDeleteProcess,
  useStartProcess,
  useProcessInstances,
  useOrgUsers,
  useOrgForms,
} from "@/hooks/useProcessBuilder";
import { ProcessBuilderForm } from "./ProcessBuilderForm";
import { StartProcessModal } from "./StartProcessModal";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Play,
  Layers,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  FileText,
  Sparkles,
  Zap,
  Activity,
} from "lucide-react";
import CommonLoader from "@/components/common/CommonLoader";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export function ProcessBuilderList() {
  const { showSuccessToast, showErrorToast } = useShowToast();

  // Queries
  const { data: processes = [], isLoading } = useProcesses();
  const { data: instances = [] } = useProcessInstances();
  const { data: orgUsers = [] } = useOrgUsers();
  const { data: orgForms = [] } = useOrgForms();

  // Mutations
  const createProcessMutation = useCreateProcess();
  const updateProcessMutation = useUpdateProcess();
  const deleteProcessMutation = useDeleteProcess();
  const startProcessMutation = useStartProcess();

  // Local states
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState(null);

  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedProcessForStart, setSelectedProcessForStart] = useState(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);

  const [showInstancesView, setShowInstancesView] = useState(false);

  // Handlers
  const handleOpenCreateForm = () => {
    setEditingProcess(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (process) => {
    setEditingProcess(process);
    setIsFormOpen(true);
  };

  const handleSaveProcess = (formData) => {
    if (editingProcess) {
      updateProcessMutation.mutate(
        { id: editingProcess.id, data: formData },
        {
          onSuccess: () => {
            showSuccessToast("Process updated successfully!");
            setIsFormOpen(false);
            setEditingProcess(null);
          },
          onError: (err) => {
            showErrorToast(err?.message || "Failed to update process");
          },
        }
      );
    } else {
      createProcessMutation.mutate(formData, {
        onSuccess: () => {
          showSuccessToast("New process created successfully!");
          setIsFormOpen(false);
        },
        onError: (err) => {
          showErrorToast(err?.message || "Failed to create process");
        },
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (!processToDelete) return;
    deleteProcessMutation.mutate(processToDelete.id, {
      onSuccess: () => {
        showSuccessToast("Process deleted successfully!");
        setIsDeleteOpen(false);
        setProcessToDelete(null);
      },
      onError: (err) => {
        showErrorToast(err?.message || "Failed to delete process");
      },
    });
  };

  const handleOpenStartModal = (process) => {
    setSelectedProcessForStart(process);
    setIsStartModalOpen(true);
  };

  const handleConfirmLaunchProcess = (launchData) => {
    startProcessMutation.mutate(launchData, {
      onSuccess: (newInstance) => {
        showSuccessToast(
          `Process "${newInstance.processName}" launched successfully!`
        );
        setIsStartModalOpen(false);
        setSelectedProcessForStart(null);
      },
      onError: (err) => {
        showErrorToast(err?.message || "Failed to launch process");
      },
    });
  };

  const getUserName = (userId) => {
    const user = orgUsers.find((u) => Number(u.id) === Number(userId));
    return user ? user.name : `User #${userId}`;
  };

  const getFormTitle = (formId) => {
    if (!formId) return null;
    const form = orgForms.find((f) => String(f.id) === String(formId));
    return form ? form.title : null;
  };

  const filteredProcesses = processes.filter((proc) => {
    const matchesSearch =
      proc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proc.description.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === "active") return matchesSearch && proc.status === "Active";
    if (activeTab === "draft") return matchesSearch && proc.status === "Draft";
    return matchesSearch;
  });

  const totalStepsCount = processes.reduce(
    (acc, proc) => acc + (proc.steps?.length || 0),
    0
  );

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden text-gray-900">
      {/* FIXED TOP SECTION (Header, Metrics, Toolbar) */}
      <div className="shrink-0 space-y-3 pb-2">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-2 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
              Process Builder
            </h1>
            <p className="mt-0 text-sm text-blue-600">
              Design multi-step workflow templates, assign organization team members, attach forms, and trigger automated processes.
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2 lg:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInstancesView(!showInstancesView)}
              className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 gap-2 h-9"
            >
              <Activity className="w-4 h-4 text-emerald-600" />
              Active Runs ({instances.length})
            </Button>
            <Button
              onClick={handleOpenCreateForm}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1.5 h-9 px-4 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Process Builder
            </Button>
          </div>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-white border-gray-200 shadow-sm rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3">
              <CardTitle className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Total Process Templates
              </CardTitle>
              <Layers className="w-4 h-4 text-indigo-600" />
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-xl font-bold text-gray-900">{processes.length}</div>
              <p className="text-[11px] text-gray-500 mt-0.5">Configured workflows in org</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3">
              <CardTitle className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Total Steps Configured
              </CardTitle>
              <Zap className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-xl font-bold text-gray-900">{totalStepsCount}</div>
              <p className="text-[11px] text-gray-500 mt-0.5">Automated steps across templates</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3">
              <CardTitle className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Active Executed Runs
              </CardTitle>
              <Activity className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-xl font-bold text-gray-900">{instances.length}</div>
              <p className="text-[11px] text-gray-500 mt-0.5">Processes launched & in-progress</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3">
              <CardTitle className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Pre-existing Forms
              </CardTitle>
              <FileText className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-xl font-bold text-gray-900">{orgForms.length}</div>
              <p className="text-[11px] text-gray-500 mt-0.5">Available organization forms</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Runs Drawer */}
        {showInstancesView && (
          <Card className="bg-white border-gray-200 shadow-md rounded-sm">
            <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" /> Active Launched Processes
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInstancesView(false)}
                  className="text-gray-500 hover:text-gray-800 h-6 text-xs"
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {instances.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">
                  No active processes launched yet. Click <strong>"Start Process"</strong> on any process card to launch one.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {instances.map((inst) => (
                    <div
                      key={inst.id}
                      className="p-2.5 rounded border border-gray-200 bg-gray-50/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 text-xs">
                          {inst.processName}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                          {inst.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-[10px]">Template: {inst.templateName}</p>
                      <div className="flex items-center justify-between text-gray-500 pt-1 border-t border-gray-200 text-[10px]">
                        <span>Started: {new Date(inst.startedAt).toLocaleDateString()}</span>
                        <span>{inst.steps.length} Steps</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Toolbar (Filter Tabs & Search) */}
        <div className="bg-white p-3 rounded-sm border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-gray-100 border border-gray-200 p-0.5">
              <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-xs h-7">
                All ({processes.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-xs h-7">
                Active ({processes.filter((p) => p.status === "Active").length})
              </TabsTrigger>
              {/* <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-xs h-7">
                Draft ({processes.filter((p) => p.status === "Draft").length})
              </TabsTrigger> */}
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
            <Input
              placeholder="Search processes or steps..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-8 border-gray-300 text-xs text-gray-900 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* SCROLLABLE TEMPLATES SECTION ONLY */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4 space-y-3">
        {isLoading ? (
          <div className="py-12 text-center">
            <CommonLoader text="Loading process templates..." />
          </div>
        ) : filteredProcesses.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded p-12 text-center bg-gray-50/50">
            <Layers className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-60" />
            <h3 className="text-base font-medium text-gray-800">No Process Templates</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
              {searchTerm
                ? `No processes match "${searchTerm}". Try clearing your search filter.`
                : "Create your first process builder workflow template to automate tasks."}
            </p>
            <Button
              onClick={handleOpenCreateForm}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Process Builder
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProcesses.map((proc) => {
              const stepCount = proc.steps?.length || 0;
              const uniqueAssignees = new Set();
              (proc.steps || []).forEach((step) => {
                if (step.assignedUserId) {
                  const val = typeof step.assignedUserId === "object"
                    ? step.assignedUserId.value || step.assignedUserId.id || step.assignedUserId._id
                    : step.assignedUserId;
                  if (val) uniqueAssignees.add(String(val));
                }
                if (Array.isArray(step.approvers)) {
                  step.approvers.forEach((app) => {
                    const val = typeof app === "object" ? app.value || app.id || app._id : app;
                    if (val && val !== "self") uniqueAssignees.add(String(val));
                  });
                }
              });
              const uniqueUserCount = uniqueAssignees.size;

              return (
                <Card
                  key={proc.id || proc._id}
                  className="border-gray-200 shadow-2xs hover:shadow-xs transition-shadow bg-white text-gray-900 overflow-hidden"
                >
                  <CardHeader className="px-4 py-3.5 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-bold text-gray-900 truncate">
                            {proc.name}
                          </CardTitle>
                          <Badge
                            className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border-0 ${
                              (proc.status || "").toLowerCase() === "active"
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {proc.status || "Active"}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-gray-600 line-clamp-2">
                          {proc.description}
                        </CardDescription>
                      </div>

                      {/* Right action group */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Start Process Button */}
                        <Button
                          onClick={() => handleOpenStartModal(proc)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 h-8 px-3 text-xs shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" /> Start Process
                        </Button>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-800">
                            <DropdownMenuItem
                              onClick={() => handleOpenEditForm(proc)}
                              className="gap-2 cursor-pointer text-xs focus:bg-gray-50 focus:text-blue-600"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit Process
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setProcessToDelete(proc);
                                setIsDeleteOpen(true);
                              }}
                              className="gap-2 cursor-pointer text-xs text-red-600 focus:bg-red-50 focus:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Process
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 py-3 border-t border-b border-gray-100 bg-gray-50/50">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="font-medium text-gray-700 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          Process Flow Steps ({stepCount})
                        </span>
                        <span className="text-[11px]">
                          Created: {new Date(proc.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Steps Flow Pills */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                        {proc.steps?.map((step, idx) => {
                          const formTitle = getFormTitle(step.formId);
                          return (
                            <div
                              key={step.id || idx}
                              className="flex items-center gap-2 shrink-0 bg-white border border-gray-200 px-2.5 py-1 rounded text-xs shadow-2xs"
                            >
                              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center border border-indigo-200">
                                {idx + 1}
                              </span>
                              <span className="font-medium text-gray-800 max-w-[130px] truncate">
                                {step.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${
                                  step.taskType === "Approval"
                                    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                    : step.taskType === "Milestone"
                                    ? "border-amber-200 text-amber-700 bg-amber-50"
                                    : "border-blue-200 text-blue-700 bg-blue-50"
                                }`}
                              >
                                {step.taskType}
                              </Badge>
                              {idx < proc.steps.length - 1 && (
                                <span className="text-gray-400 font-bold ml-1">→</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="px-4 py-2.5 text-xs text-gray-500 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Assigned: {uniqueUserCount > 0 ? `${uniqueUserCount} ${uniqueUserCount === 1 ? "User" : "Users"}` : "None"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        Forms Linked: {proc.steps?.filter((s) => s.formId).length || 0}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenEditForm(proc)}
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline text-xs"
                    >
                      View & Edit Details →
                    </button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <ProcessBuilderForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProcess(null);
        }}
        onSubmit={handleSaveProcess}
        processToEdit={editingProcess}
        isSubmitting={
          createProcessMutation.isPending || updateProcessMutation.isPending
        }
      />

      {/* Start Process Modal */}
      <StartProcessModal
        isOpen={isStartModalOpen}
        onClose={() => {
          setIsStartModalOpen(false);
          setSelectedProcessForStart(null);
        }}
        process={selectedProcessForStart}
        onConfirmLaunch={handleConfirmLaunchProcess}
        isStarting={startProcessMutation.isPending}
      />

      {/* Delete Process Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setProcessToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Process Template"
        message={`Are you sure you want to delete "${processToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="destructive"
      />
    </div>
  );
}
