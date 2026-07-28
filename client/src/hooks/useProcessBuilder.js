import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const STORAGE_KEYS = {
  PROCESSES: "tasksetu_process_builder_processes",
  INSTANCES: "tasksetu_process_builder_instances",
};

// Initial Demo Users (List of existing users of that organization)
const DEMO_ORG_USERS = [
  {
    id: 101,
    name: "Alex Morgan",
    email: "alex.morgan@company.com",
    role: "Project Lead",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
  },
  {
    id: 102,
    name: "Sarah Connor",
    email: "sarah.c@company.com",
    role: "HR Specialist",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
  },
  {
    id: 103,
    name: "David Miller",
    email: "david.m@company.com",
    role: "Compliance Manager",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
  },
  {
    id: 104,
    name: "Emily Chen",
    email: "emily.chen@company.com",
    role: "IT Admin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  },
  {
    id: 105,
    name: "Michael Scott",
    email: "michael.s@company.com",
    role: "Regional Manager",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
  },
];

// Initial Demo Forms (List of existing pre-existing forms of that organization)
const DEMO_ORG_FORMS = [
  {
    id: "form_1",
    title: "Employee Personal Information Form",
    category: "HR",
    fieldsCount: 8,
  },
  {
    id: "form_2",
    title: "ID & Background Verification Form",
    category: "Compliance",
    fieldsCount: 5,
  },
  {
    id: "form_3",
    title: "IT Hardware & Equipment Request Form",
    category: "IT",
    fieldsCount: 6,
  },
  {
    id: "form_4",
    title: "Manager Sign-off Checklist",
    category: "Approval",
    fieldsCount: 4,
  },
  {
    id: "form_5",
    title: "Project Requirements Intake Form",
    category: "Operations",
    fieldsCount: 10,
  },
];

// Seed initial process templates if not already present in localStorage
const INITIAL_PROCESSES = [
  {
    id: "proc_1",
    name: "Employee Onboarding Workflow",
    description:
      "Standard end-to-end workflow for onboarding new team members across HR verification, IT hardware setup, and Manager review.",
    status: "Active",
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-20T14:30:00.000Z",
    steps: [
      {
        id: "step_101",
        taskType: "Regular",
        name: "Document Verification",
        assignedUserId: 102,
        dueDays: 2,
        approvalRequired: true,
        formId: "form_2",
      },
      {
        id: "step_102",
        taskType: "Regular",
        name: "IT Hardware Provisioning",
        assignedUserId: 104,
        dueDays: 3,
        approvalRequired: false,
        formId: "form_3",
      },
      {
        id: "step_103",
        taskType: "Approval",
        name: "Manager Welcome & Sign-off",
        assignedUserId: 105,
        dueDays: 5,
        approvalRequired: true,
        formId: "form_4",
      },
      {
        id: "step_104",
        taskType: "Milestone",
        name: "30-Day Orientation Completed",
        assignedUserId: 101,
        dueDays: 30,
        approvalRequired: false,
        formId: null,
      },
    ],
  },
  {
    id: "proc_2",
    name: "Vendor Onboarding & Legal Verification",
    description:
      "Multi-tier approval process for vetting new third-party suppliers, verifying compliance, and securing manager sign-off.",
    status: "Active",
    createdAt: "2026-07-18T09:15:00.000Z",
    updatedAt: "2026-07-22T11:20:00.000Z",
    steps: [
      {
        id: "step_201",
        taskType: "Regular",
        name: "Vendor Intake Form Submission",
        assignedUserId: 101,
        dueDays: 1,
        approvalRequired: false,
        formId: "form_5",
      },
      {
        id: "step_202",
        taskType: "Approval",
        name: "Legal & Compliance Audit",
        assignedUserId: 103,
        dueDays: 4,
        approvalRequired: true,
        formId: "form_2",
      },
      {
        id: "step_203",
        taskType: "Milestone",
        name: "Final Contract Execution",
        assignedUserId: 105,
        dueDays: 7,
        approvalRequired: true,
        formId: null,
      },
    ],
  },
  {
    id: "proc_3",
    name: "Quarterly Financial Audit Process",
    description:
      "Structured process for gathering financial disclosures, verifying expense logs, and getting CFO milestone approval.",
    status: "Draft",
    createdAt: "2026-07-21T16:45:00.000Z",
    updatedAt: "2026-07-21T16:45:00.000Z",
    steps: [
      {
        id: "step_301",
        taskType: "Regular",
        name: "Financial Data Gathering",
        assignedUserId: 101,
        dueDays: 5,
        approvalRequired: false,
        formId: "form_1",
      },
      {
        id: "step_302",
        taskType: "Approval",
        name: "Audit Committee Sign-off",
        assignedUserId: 103,
        dueDays: 10,
        approvalRequired: true,
        formId: "form_4",
      },
    ],
  },
];

// Helper functions for LocalStorage persistence
const getStoredProcesses = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROCESSES);
    if (!raw) {
      localStorage.setItem(
        STORAGE_KEYS.PROCESSES,
        JSON.stringify(INITIAL_PROCESSES)
      );
      return INITIAL_PROCESSES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading processes from storage:", err);
    return INITIAL_PROCESSES;
  }
};

const saveStoredProcesses = (processes) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(processes));
  } catch (err) {
    console.error("Error saving processes to storage:", err);
  }
};

const getStoredInstances = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INSTANCES);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Error reading process instances:", err);
    return [];
  }
};

const saveStoredInstances = (instances) => {
  try {
    localStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));
  } catch (err) {
    console.error("Error saving process instances:", err);
  }
};

// -------------------------------------------------------------
// TANSTACK QUERY HOOKS
// -------------------------------------------------------------

/** Fetch list of pre-existing organization users */
export function useOrgUsers() {
  return useQuery({
    queryKey: ["/api/process-builder/users"],
    queryFn: async () => {
      // Frontend mock API call delay
      await new Promise((res) => setTimeout(res, 150));
      return DEMO_ORG_USERS;
    },
  });
}

/** Fetch list of pre-existing organization forms */
export function useOrgForms() {
  return useQuery({
    queryKey: ["/api/process-builder/forms"],
    queryFn: async () => {
      await new Promise((res) => setTimeout(res, 150));
      return DEMO_ORG_FORMS;
    },
  });
}

/** Fetch all processes */
export function useProcesses() {
  return useQuery({
    queryKey: ["/api/process-builder/processes"],
    queryFn: async () => {
      await new Promise((res) => setTimeout(res, 200));
      return getStoredProcesses();
    },
  });
}

/** Fetch single process by ID */
export function useProcess(id) {
  return useQuery({
    queryKey: ["/api/process-builder/processes", id],
    queryFn: async () => {
      await new Promise((res) => setTimeout(res, 150));
      const processes = getStoredProcesses();
      const found = processes.find((p) => String(p.id) === String(id));
      if (!found) throw new Error("Process not found");
      return found;
    },
    enabled: !!id,
  });
}

/** Create new process mutation */
export function useCreateProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (processData) => {
      await new Promise((res) => setTimeout(res, 300));
      const current = getStoredProcesses();
      const newProcess = {
        ...processData,
        id: `proc_${Date.now()}`,
        status: processData.status || "Active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: processData.steps || [],
      };
      const updated = [newProcess, ...current];
      saveStoredProcesses(updated);
      return newProcess;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes"],
      });
    },
  });
}

/** Update existing process mutation */
export function useUpdateProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      await new Promise((res) => setTimeout(res, 300));
      const current = getStoredProcesses();
      const index = current.findIndex((p) => String(p.id) === String(id));
      if (index === -1) throw new Error("Process not found");

      const updatedProcess = {
        ...current[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      current[index] = updatedProcess;
      saveStoredProcesses(current);
      return updatedProcess;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes", updated.id],
      });
    },
  });
}

/** Delete process mutation */
export function useDeleteProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await new Promise((res) => setTimeout(res, 250));
      const current = getStoredProcesses();
      const filtered = current.filter((p) => String(p.id) !== String(id));
      saveStoredProcesses(filtered);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes"],
      });
    },
  });
}

/** Start/Launch process instance mutation */
export function useStartProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ processId, customName, notes }) => {
      await new Promise((res) => setTimeout(res, 350));
      const processes = getStoredProcesses();
      const targetProcess = processes.find(
        (p) => String(p.id) === String(processId)
      );

      if (!targetProcess) throw new Error("Process template not found");

      const currentInstances = getStoredInstances();
      const newInstance = {
        id: `instance_${Date.now()}`,
        processId: targetProcess.id,
        processName: customName || targetProcess.name,
        templateName: targetProcess.name,
        notes: notes || "",
        startedAt: new Date().toISOString(),
        status: "In Progress",
        currentStepIndex: 0,
        totalSteps: targetProcess.steps.length,
        steps: targetProcess.steps.map((step, idx) => ({
          ...step,
          status: idx === 0 ? "In Progress" : "Pending",
          startedAt: idx === 0 ? new Date().toISOString() : null,
        })),
      };

      const updated = [newInstance, ...currentInstances];
      saveStoredInstances(updated);
      return newInstance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/instances"],
      });
    },
  });
}

/** Fetch active running process instances */
export function useProcessInstances() {
  return useQuery({
    queryKey: ["/api/process-builder/instances"],
    queryFn: async () => {
      await new Promise((res) => setTimeout(res, 200));
      return getStoredInstances();
    },
  });
}
