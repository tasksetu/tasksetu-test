import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FolderTree,
  Users,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  X,
  ArrowRight,
  CheckSquare,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Building2,
  List,
  Shield,
  Crown,
  UserCheck,
  CheckCircle2,
  Mail,
  UserPlus,
  Briefcase,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShowToast } from "@/utils/ToastMessage";

/**
 * Determine if a user account is active or inactive
 */
export const isUserActive = (u) => {
  if (!u) return false;
  if (u.isActive === false) return false;
  if (typeof u.status === "string") {
    const s = u.status.toLowerCase().trim();
    if (["inactive", "disabled", "suspended", "deactivated"].includes(s)) return false;
    if (s === "active") return true;
  }
  return u.isActive !== false;
};

/**
 * Extract profile picture URL from user object
 */
export const getUserProfileImage = (u) => {
  if (!u) return null;
  const candidate =
    u.profileImageUrl ||
    u.profileImage ||
    u.profilePicture ||
    u.profilePic ||
    u.photoURL ||
    u.avatarUrl ||
    (typeof u.avatar === "string" &&
    (u.avatar.includes("/") ||
      u.avatar.includes(".") ||
      u.avatar.startsWith("http") ||
      u.avatar.startsWith("data:"))
      ? u.avatar
      : null);

  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  // If it's just short initials (e.g. "AY", "GY"), it's not an image URL
  if (trimmed.length <= 3 && !trimmed.includes("/") && !trimmed.includes(".")) {
    return null;
  }
  return trimmed;
};

/**
 * Circular user avatar that renders the user's profile picture if available,
 * falling back gracefully to their initials if no picture is set or if loading fails.
 */
export function UserAvatar({
  user,
  sizeClasses = "w-10 h-10",
  bgClasses = "bg-slate-900",
  textClasses = "text-xs font-bold text-white",
}) {
  const [imgError, setImgError] = useState(false);
  const profileImg = getUserProfileImage(user);

  const initials =
    user?.avatar && user.avatar.length <= 3 && !user.avatar.includes("/")
      ? user.avatar
      : user?.name
      ? user.name.slice(0, 2).toUpperCase()
      : "U";

  let src = profileImg;
  if (
    profileImg &&
    !profileImg.startsWith("http") &&
    !profileImg.startsWith("/uploads") &&
    !profileImg.startsWith("data:")
  ) {
    src = `/uploads/${profileImg.replace(/^\/+/, "")}`;
  }

  return (
    <div
      className={`${sizeClasses} rounded-full ${bgClasses} ${textClasses} flex items-center justify-center flex-shrink-0 shadow-xs ring-2 ring-white overflow-hidden relative select-none`}
    >
      {profileImg && !imgError ? (
        <img
          src={src}
          alt={user?.name || "Avatar"}
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

/**
 * Organization Hierarchy Section for TaskSetu Organization Dashboard
 * Modern, interactive, zoomable tree view + list view + departments view
 * with hover task summary panel and real database integration.
 */
export default function OrganizationHierarchySection({
  tasks = [],
  teamMembers = [],
  currentUser = null,
  activeRole = "org_admin",
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useShowToast();

  // View state: 'tree' | 'list' | 'departments'
  const [viewMode, setViewMode] = useState("tree");
  const [searchTerm, setSearchTerm] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [collapsedBranches, setCollapsedBranches] = useState({});
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Hover card state
  const [hoveredUser, setHoveredUser] = useState(null);
  const [hoverCardPos, setHoverCardPos] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  // Add Member Modal state
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "employee",
    managerId: "",
    department: "",
    designation: "",
  });

  // Fetch detailed users list
  const { data: usersDetailed = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/organization/users-detailed"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return [];
      const res = await fetch("/api/organization/users-detailed", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    staleTime: 45_000,
  });

  // Fetch hierarchy relationship entries (manager -> reporty)
  const { data: hierarchyEntries = [], isLoading: isLoadingHierarchy } = useQuery({
    queryKey: ["/api/organization/hierarchy"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return [];
      const res = await fetch("/api/organization/hierarchy", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    },
    staleTime: 45_000,
  });

  // Check if current view is manager or org admin view
  const isManagerView =
    activeRole === "manager" ||
    (activeRole !== "org_admin" &&
      activeRole !== "admin" &&
      activeRole !== "super_admin" &&
      (Array.isArray(currentUser?.role)
        ? currentUser.role.includes("manager")
        : currentUser?.role === "manager"));

  const isOrgAdmin =
    !isManagerView &&
    (activeRole === "org_admin" ||
      activeRole === "admin" ||
      activeRole === "super_admin" ||
      (Array.isArray(currentUser?.role)
        ? currentUser.role.some((r) => ["org_admin", "admin", "super_admin", "owner"].includes(r))
        : ["org_admin", "admin", "super_admin", "owner"].includes(currentUser?.role)));

  // Helper to extract and normalize all roles from a user object
  const normalizeUserRoles = (u) => {
    const list = [];
    if (Array.isArray(u.roles)) list.push(...u.roles);
    else if (typeof u.roles === "string" && u.roles.trim()) list.push(u.roles.trim());

    if (Array.isArray(u.role)) list.push(...u.role);
    else if (typeof u.role === "string" && u.role.trim()) list.push(u.role.trim());

    const cleaned = list
      .filter(Boolean)
      .map((r) => String(r).toLowerCase().trim());
    const unique = Array.from(new Set(cleaned));
    return unique.length > 0 ? unique : ["employee"];
  };

  const getPrimaryRole = (rolesList) => {
    if (rolesList.includes("org_admin")) return "org_admin";
    if (rolesList.includes("owner")) return "owner";
    if (rolesList.includes("super_admin")) return "super_admin";
    if (rolesList.includes("admin")) return "admin";
    if (rolesList.includes("manager")) return "manager";
    return rolesList[0] || "employee";
  };

  // Merge users from usersDetailed and teamMembers into unified user map
  const unifiedUsers = useMemo(() => {
    const map = new Map();

    // 1. Seed from usersDetailed
    usersDetailed.forEach((u) => {
      const id = String(u._id || u.id);
      const roles = normalizeUserRoles(u);
      const role = getPrimaryRole(roles);
      const profileImage =
        u.profileImageUrl ||
        u.profileImage ||
        u.profilePicture ||
        u.profilePic ||
        u.photoURL ||
        (typeof u.avatar === "string" && (u.avatar.includes("/") || u.avatar.includes(".") || u.avatar.startsWith("http") || u.avatar.startsWith("data:")) ? u.avatar : null);

      map.set(id, {
        id,
        _id: id,
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Member",
        email: u.email || "",
        role,
        roles,
        department: u.department || null,
        designation: u.designation || null,
        status: u.isActive !== false && u.status !== "inactive" ? "active" : "inactive",
        isActive: u.isActive !== false && u.status !== "inactive",
        managerId: u.managerId ? String(u.managerId) : null,
        subordinates: Array.isArray(u.subordinates) ? u.subordinates.map(String) : [],
        avatar: (u.firstName?.[0] || "") + (u.lastName?.[0] || ""),
        profileImage,
        profileImageUrl: profileImage,
      });
    });

    // 2. Augment from teamMembers prop (aggregated dashboard)
    teamMembers.forEach((m) => {
      const id = String(m.id || m._id);
      const mProfileImage =
        m.profileImageUrl ||
        m.profileImage ||
        m.profilePicture ||
        m.profilePic ||
        m.photoURL ||
        (typeof m.avatar === "string" && (m.avatar.includes("/") || m.avatar.includes(".") || m.avatar.startsWith("http") || m.avatar.startsWith("data:")) ? m.avatar : null);

      if (map.has(id)) {
        const existing = map.get(id);
        const roles = Array.from(new Set([...existing.roles, ...normalizeUserRoles(m)]));
        const role = getPrimaryRole(roles);
        const mActive = m.isActive !== false && m.status !== "inactive";
        map.set(id, {
          ...existing,
          role,
          roles,
          status: mActive ? "active" : existing.status,
          isActive: mActive || existing.isActive,
          managerId: existing.managerId || (m.managerId ? String(m.managerId) : null),
          subordinates: existing.subordinates.length > 0 ? existing.subordinates : (m.subordinates || []),
          department: existing.department || m.department || null,
          designation: existing.designation || m.designation || null,
          profileImage: existing.profileImage || mProfileImage || null,
          profileImageUrl: existing.profileImageUrl || mProfileImage || null,
        });
      } else {
        const roles = normalizeUserRoles(m);
        const role = getPrimaryRole(roles);
        const mActive = m.isActive !== false && m.status !== "inactive";
        map.set(id, {
          id,
          _id: id,
          firstName: m.firstName || (m.name ? m.name.split(" ")[0] : ""),
          lastName: m.lastName || (m.name ? m.name.split(" ").slice(1).join(" ") : ""),
          name: m.name || "Member",
          email: m.email || "",
          role,
          roles,
          department: m.department || null,
          designation: m.designation || null,
          status: mActive ? "active" : "inactive",
          isActive: mActive,
          managerId: m.managerId ? String(m.managerId) : null,
          subordinates: Array.isArray(m.subordinates) ? m.subordinates.map(String) : [],
          avatar: m.avatar || (m.name ? m.name.slice(0, 2).toUpperCase() : "M"),
          profileImage: mProfileImage || null,
          profileImageUrl: mProfileImage || null,
        });
      }
    });

    // 3. Connect hierarchy entries (manager -> reporty)
    hierarchyEntries.forEach((entry) => {
      const mgrId = String(entry.manager?._id || entry.managerId || entry.manager || "");
      const repId = String(entry.reporty?._id || entry.reportyId || entry.reporty || "");

      if (repId && map.has(repId)) {
        const rep = map.get(repId);
        rep.managerId = mgrId;
      }
      if (mgrId && repId && map.has(mgrId)) {
        const mgr = map.get(mgrId);
        if (!mgr.subordinates.includes(repId)) {
          mgr.subordinates.push(repId);
        }
      }
    });

    return Array.from(map.values());
  }, [usersDetailed, teamMembers, hierarchyEntries]);

  // Compute live task stats for every user from tasks prop
  const userTaskStats = useMemo(() => {
    const statsMap = new Map();

    const getDisplayNow = () => {
      const now = new Date();
      return new Date(
        Date.UTC(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours(),
          now.getMinutes(),
          now.getSeconds()
        )
      );
    };

    const isTaskOverdue = (t) => {
      if (t.isPastDue !== undefined) return Boolean(t.isPastDue);
      if (!t?.dueDate || t.dueDate === "No due date") return false;
      const s = (t.status || "").toUpperCase();
      if (["DONE", "COMPLETED", "CANCELLED"].includes(s)) return false;
      const d = new Date(t.dueDate);
      if (isNaN(d.getTime())) return false;
      return d < getDisplayNow() || d < new Date();
    };

    unifiedUsers.forEach((u) => {
      const uId = String(u.id);

      const userTasks = tasks.filter((t) => {
        const assignee = t.assigneeId || t.assignedTo?._id || t.assignedTo?.id || t.assignedTo;
        if (typeof assignee === "object" && assignee !== null) {
          return String(assignee._id || assignee.id) === uId;
        }
        return String(assignee) === uId || (t.assigneeName && t.assigneeName.toLowerCase() === u.name.toLowerCase());
      });

      const total = userTasks.length;
      let completed = 0;
      let inProgress = 0;
      let pending = 0;
      let overdue = 0;

      userTasks.forEach((t) => {
        const s = (t.status || "").toUpperCase();
        const isDone = ["COMPLETED", "DONE"].includes(s);
        const isInProg = ["IN_PROGRESS", "INPROGRESS", "DOING"].includes(s);
        const isCancelled = ["CANCELLED", "CANCELED"].includes(s);

        if (isDone) completed++;
        else if (isInProg) inProgress++;
        else if (!isCancelled) pending++;

        if (isTaskOverdue(t)) overdue++;
      });

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      statsMap.set(uId, {
        total,
        completed,
        inProgress,
        pending,
        overdue,
        completionRate,
      });
    });

    return statsMap;
  }, [unifiedUsers, tasks]);

  // Build the hierarchical tree model
  const hierarchyTree = useMemo(() => {
    if (unifiedUsers.length === 0) return null;

    let admin = null;
    const currentUserId = String(currentUser?._id || currentUser?.id || "");
    const currentUserEmail = (currentUser?.email || "").toLowerCase().trim();

    if (isManagerView) {
      // 1. In Manager View: the logged-in manager is the Root Node
      admin = unifiedUsers.find(
        (u) =>
          (currentUserId && u.id === currentUserId) ||
          (currentUserEmail && u.email && u.email.toLowerCase() === currentUserEmail)
      );

      // If manager not yet present in unifiedUsers map, build from currentUser
      if (!admin && currentUser) {
        admin = {
          id: currentUserId || "mgr-current",
          _id: currentUserId || "mgr-current",
          firstName: currentUser.firstName || "",
          lastName: currentUser.lastName || "",
          name:
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
            currentUser.email ||
            "Manager",
          email: currentUser.email || "",
          role: "manager",
          roles: ["manager"],
          department: currentUser.department || null,
          designation: currentUser.designation || "Manager",
          status: currentUser?.status || (currentUser?.isActive !== false ? "active" : "inactive"),
          isActive: currentUser?.isActive !== false && currentUser?.status !== "inactive",
          managerId: null,
          subordinates: [],
          avatar: (currentUser.firstName?.[0] || "") + (currentUser.lastName?.[0] || ""),
          profileImage: currentUser.profileImage || null,
        };
      }
    } else {
      // 1. In Org Admin View: identify Root Admin / Head of Organization
      const currentUserIsAdmin =
        activeRole === "org_admin" ||
        activeRole === "admin" ||
        (Array.isArray(currentUser?.role)
          ? currentUser.role.some((r) =>
              ["org_admin", "admin", "super_admin", "owner"].includes(String(r).toLowerCase()),
            )
          : ["org_admin", "admin", "super_admin", "owner"].includes(
              String(currentUser?.role || "").toLowerCase(),
            )) ||
        (Array.isArray(currentUser?.roles)
          ? currentUser.roles.some((r) =>
              ["org_admin", "admin", "super_admin", "owner"].includes(String(r).toLowerCase()),
            )
          : false);

      // Priority 1: Current logged in user IF they are an org_admin / admin / owner
      if (currentUserIsAdmin) {
        admin = unifiedUsers.find(
          (u) =>
            (currentUserId && u.id === currentUserId) ||
            (currentUserEmail && u.email && u.email.toLowerCase() === currentUserEmail),
        );
      }

      // Priority 2: Anyone explicitly having 'org_admin', 'owner', or 'super_admin' in their roles
      if (!admin) {
        admin = unifiedUsers.find(
          (u) =>
            u.roles.some((r) => ["org_admin", "owner", "super_admin"].includes(r)) ||
            ["org_admin", "owner", "super_admin"].includes(u.role),
        );
      }

      // Priority 3: Anyone with 'admin' role
      if (!admin) {
        admin = unifiedUsers.find(
          (u) => u.roles.includes("admin") || u.role === "admin",
        );
      }

      // Priority 4: A top-level manager who has no manager assigned and has direct reports
      if (!admin) {
        admin = unifiedUsers.find((u) => !u.managerId && u.subordinates?.length > 0);
      }

      // Fallback: First user
      if (!admin) {
        admin = unifiedUsers[0];
      }
    }

    if (!admin) {
      admin = unifiedUsers[0];
    }

    // Determine relevant users (scoped strictly to manager's team in manager view, or whole org in admin view)
    let relevantUsers = unifiedUsers;
    if (isManagerView && admin) {
      const teamUserIds = new Set();
      teamUserIds.add(admin.id);

      // 1. Subordinates explicitly listed on the manager object
      (admin.subordinates || []).forEach((id) => teamUserIds.add(String(id)));

      // 2. Subordinates from hierarchy relationship entries
      hierarchyEntries.forEach((entry) => {
        const mgrId = String(entry.manager?._id || entry.managerId || entry.manager || "");
        const repId = String(entry.reporty?._id || entry.reportyId || entry.reporty || "");
        if (mgrId === admin.id && repId) {
          teamUserIds.add(repId);
        }
      });

      // 3. Subordinates having managerId set to this manager
      unifiedUsers.forEach((u) => {
        if (String(u.managerId) === admin.id) {
          teamUserIds.add(u.id);
        }
      });

      // 4. Subordinates passed via teamMembers prop (aggregated dashboard)
      teamMembers.forEach((m) => {
        const id = String(m.id || m._id);
        if (id && id !== admin.id) {
          teamUserIds.add(id);
        }
      });

      // 5. Recursive expansion if any subordinate has sub-reports
      let addedMore = true;
      while (addedMore) {
        addedMore = false;
        unifiedUsers.forEach((u) => {
          if (!teamUserIds.has(u.id) && u.managerId && teamUserIds.has(String(u.managerId))) {
            teamUserIds.add(u.id);
            addedMore = true;
          }
        });
      }

      relevantUsers = unifiedUsers.filter((u) => teamUserIds.has(u.id));
      if (!relevantUsers.some((u) => u.id === admin.id)) {
        relevantUsers.unshift(admin);
      }
    }

    // 2. Identify Managers / Sub-leads under admin
    const managers = relevantUsers.filter((u) => {
      if (u.id === admin.id) return false;
      const isManagerRole =
        u.role === "manager" ||
        u.roles.includes("manager");
      const hasSubordinates = u.subordinates && u.subordinates.length > 0;
      return isManagerRole || hasSubordinates;
    });

    // 3. For each sub-manager, identify their reporting employees
    const managerBranches = managers.map((mgr) => {
      const reports = relevantUsers.filter((u) => {
        if (u.id === admin.id || u.id === mgr.id) return false;
        return (
          u.managerId === mgr.id ||
          (mgr.subordinates && mgr.subordinates.includes(u.id))
        );
      });

      return {
        ...mgr,
        employees: reports,
      };
    });

    // 4. Employees who report directly to Admin/Root Manager
    const assignedEmployeeIds = new Set(
      managerBranches.flatMap((m) => m.employees.map((e) => e.id)),
    );
    const managerIds = new Set(managers.map((m) => m.id));

    const directReports = relevantUsers.filter(
      (u) =>
        u.id !== admin.id &&
        !managerIds.has(u.id) &&
        !assignedEmployeeIds.has(u.id),
    );

    const totalTeamMembers = isManagerView
      ? relevantUsers.filter((u) => u.id !== admin.id).length
      : relevantUsers.length;

    return {
      admin,
      managers: managerBranches,
      directReports,
      totalMembers: totalTeamMembers,
      totalManagers: managers.length,
      isManagerView,
      relevantUsers,
    };
  }, [unifiedUsers, currentUser, activeRole, teamMembers, hierarchyEntries, isManagerView]);

  // Dynamic helper to compute exact team members reporting to any given user
  const getUserTeamMemberCount = (u) => {
    if (!u) return 0;
    // For Organization Admin in Org view, member count is the total organization members
    const isOrgAdminUser =
      u.role === "org_admin" ||
      u.role === "owner" ||
      u.role === "super_admin" ||
      (!isManagerView && u.id === hierarchyTree?.admin?.id);

    if (isOrgAdminUser && !isManagerView) {
      return hierarchyTree?.totalMembers ?? (hierarchyTree?.relevantUsers?.length || unifiedUsers.length);
    }

    if (isManagerView && u.id === hierarchyTree?.admin?.id) {
      return (
        (hierarchyTree?.managers?.reduce(
          (acc, m) => acc + 1 + (m.employees?.length || 0),
          0
        ) || 0) + (hierarchyTree?.directReports?.length || 0)
      );
    }
    const branch = hierarchyTree?.managers?.find((m) => m.id === u.id);
    if (branch && branch.employees) {
      return branch.employees.length;
    }
    const directSubs = (hierarchyTree?.relevantUsers || unifiedUsers).filter(
      (sub) =>
        sub.id !== u.id &&
        (String(sub.managerId) === String(u.id) ||
          (Array.isArray(u.subordinates) && u.subordinates.includes(sub.id)))
    );
    return directSubs.length;
  };

  // Search filter
  const matchesSearch = (user) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const nameMatch = user.name?.toLowerCase().includes(q);
    const emailMatch = user.email?.toLowerCase().includes(q);
    const roleMatch = user.role?.toLowerCase().includes(q);
    const deptMatch = user.department?.toLowerCase().includes(q);
    return nameMatch || emailMatch || roleMatch || deptMatch;
  };

  // Toggle branch expansion
  const toggleBranch = (managerId) => {
    setCollapsedBranches((prev) => ({
      ...prev,
      [managerId]: !prev[managerId],
    }));
  };

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.6));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.55));
  const handleZoomReset = () => setZoomLevel(1);
  const handleFitToScreen = () => {
    if (!containerRef.current) {
      setZoomLevel(1);
      return;
    }
    const containerWidth = containerRef.current.clientWidth - 48;
    // Estimate tree width: ~Admin (300) + Managers (count * 280)
    const managersCount = hierarchyTree?.managers?.length || 1;
    const estTreeWidth = Math.max(managersCount * 300, 750);
    const targetScale = Math.min(Math.max(containerWidth / estTreeWidth, 0.6), 1.1);
    setZoomLevel(Number(targetScale.toFixed(2)));
  };

  // Hover card handlers with mouse bridge and viewport positioning
  const handleCardMouseEnter = (user, event) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const flyoutWidth = 288;
    const flyoutHeight = 350;

    // Place to the right of the card by default
    let x = rect.right + 12;
    // If it would overflow right viewport boundary, place to left of card
    if (x + flyoutWidth > window.innerWidth - 16) {
      x = Math.max(16, rect.left - flyoutWidth - 12);
    }

    // Align with top of card, clamp vertically inside viewport
    let y = rect.top - 6;
    if (y + flyoutHeight > window.innerHeight - 16) {
      y = Math.max(16, window.innerHeight - flyoutHeight - 16);
    }
    if (y < 16) {
      y = 16;
    }

    setHoverCardPos({ x, y });
    setHoveredUser(user);
  };

  const handleCardMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredUser(null);
    }, 200);
  };

  const handleFlyoutMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleFlyoutMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredUser(null);
    }, 150);
  };

  // Auto-dismiss hover flyout on any scroll or window resize to prevent detachment/flicker
  useEffect(() => {
    if (!hoveredUser) return;

    const handleScrollOrResize = () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      setHoveredUser(null);
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [hoveredUser]);

  // Add Member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async (formData) => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/organization/invite-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invites: [
            {
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              roles: [formData.role],
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to invite member");
      }

      // If a manager was selected for this employee, also create hierarchy link
      if (formData.role === "employee" && formData.managerId) {
        try {
          const userRes = await fetch("/api/organization/users-detailed", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const allU = await userRes.json();
          const created = Array.isArray(allU) ? allU.find((u) => u.email === formData.email) : null;
          if (created?._id) {
            await fetch("/api/organization/hierarchy", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                managerId: formData.managerId,
                reportyId: created._id,
              }),
            });
          }
        } catch (hErr) {
          console.warn("Could not immediately link hierarchy:", hErr.message);
        }
      }

      return res.json();
    },
    onSuccess: () => {
      showSuccessToast(`Invitation sent successfully to ${newMemberForm.email}`);
      setAddMemberOpen(false);
      setNewMemberForm({
        firstName: "",
        lastName: "",
        email: "",
        role: "employee",
        managerId: "",
        department: "",
        designation: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users-detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/aggregated"] });
    },
    onError: (err) => {
      showErrorToast(err.message || "Failed to invite member");
    },
  });

  const handleAddMemberSubmit = (e) => {
    e.preventDefault();
    if (!newMemberForm.email || !newMemberForm.firstName) {
      showErrorToast("First name and email are required");
      return;
    }
    inviteMemberMutation.mutate(newMemberForm);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-sm p-5 shadow-sm mb-4 relative overflow-hidden transition-all">
      {/* SECTION HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        {/* Title and Subtitle */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-xs">
            <FolderTree size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {isManagerView ? "Team Hierarchy" : "Organization Hierarchy"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isManagerView
                ? "Visualize your team reporting structure and member performance."
                : "Visualize your organization structure with managers and team members."}
            </p>
          </div>
        </div>

        {/* Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle Pill */}
          <div className="flex items-center bg-slate-100/90 p-0.5 rounded-sm border border-slate-200/70 text-xs h-8">
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 h-7 rounded-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "tree"
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FolderTree size={13} />
              Tree View
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 h-7 rounded-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "list"
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List size={13} />
              List View
            </button>
            <button
              onClick={() => setViewMode("departments")}
              className={`px-3 h-7 rounded-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "departments"
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 size={13} />
              Departments
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members, teams..."
              className="text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-sm pl-8 pr-7 h-8 w-44 sm:w-52 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Hierarchy Button (Org Admin only) */}
          {!isManagerView && (
            <button
              onClick={() => setLocation("/organization-hierarchy")}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 h-8 rounded-sm flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <FolderTree size={14} />
              <span>Hierarchy</span>
            </button>
          )}

          {/* Role Status Legend */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-500 pl-1 border-l border-slate-200">
            {!isManagerView && (
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
                Admin
              </span>
            )}
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              Manager
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
              Employee
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Active
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
              Inactive
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT CANVAS */}
      <div
        ref={containerRef}
        onScroll={() => {
          if (hoveredUser) {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setHoveredUser(null);
          }
        }}
        className="mt-4 min-h-[420px] max-h-[620px] overflow-auto relative bg-gradient-to-b from-slate-50/50 via-white to-slate-50/40 rounded-sm border border-slate-100 p-4"
        style={{
          backgroundImage:
            "radial-gradient(#e2e8f0 0.75px, transparent 0.75px)",
          backgroundSize: "20px 20px",
        }}
      >
        {/* VIEW 1: INTERACTIVE TREE VIEW */}
        {viewMode === "tree" && (
          <div
            className="flex flex-col items-center justify-start min-w-max transition-transform duration-200 origin-top pb-8"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {hierarchyTree?.admin ? (
              <div className="flex flex-col items-center">
                {/* --- LEVEL 1: ROOT NODE (Org Admin or Manager) --- */}
                <AdminNodeCard
                  admin={hierarchyTree.admin}
                  isManagerView={isManagerView}
                  stats={userTaskStats.get(hierarchyTree.admin.id)}
                  totalMembers={hierarchyTree.totalMembers}
                  totalManagers={hierarchyTree.totalManagers}
                  isSelected={selectedNodeId === hierarchyTree.admin.id}
                  isMatch={matchesSearch(hierarchyTree.admin)}
                  onSelect={() => setSelectedNodeId(hierarchyTree.admin.id)}
                  onMouseEnter={(e) => handleCardMouseEnter(hierarchyTree.admin, e)}
                  onMouseLeave={handleCardMouseLeave}
                />

                {/* Vertical Bus from Root down to Children with Junction Node */}
                {(hierarchyTree.managers.length > 0 || hierarchyTree.directReports.length > 0) && (
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-0.5 h-7 bg-blue-500 flex-shrink-0" />
                    {(hierarchyTree.managers.length > 1 ||
                      (hierarchyTree.managers.length === 0 && hierarchyTree.directReports.length > 1)) && (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-white shadow-xs -mt-1.5 z-10 flex-shrink-0" />
                    )}
                  </div>
                )}

                {/* --- LEVEL 2 (Direct Reports as Children when no intermediate managers) --- */}
                {hierarchyTree.managers.length === 0 && hierarchyTree.directReports.length > 0 && (
                  <div className="flex items-start justify-center">
                    {hierarchyTree.directReports.map((emp, empIdx) => {
                      const empStats = userTaskStats.get(emp.id);
                      const isFirst = empIdx === 0;
                      const isLast = empIdx === hierarchyTree.directReports.length - 1;
                      const hasMultiple = hierarchyTree.directReports.length > 1;

                      return (
                        <div
                          key={emp.id}
                          className="flex flex-col items-center relative px-3 sm:px-4"
                        >
                          {/* Continuous Horizontal Bus Line */}
                          {hasMultiple && !isFirst && (
                            <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-blue-500" />
                          )}
                          {hasMultiple && !isLast && (
                            <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-blue-500" />
                          )}
                          {/* Junction Joint Dot */}
                          {hasMultiple && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-2xs z-10" />
                          )}

                          {/* Vertical Line into Employee Node */}
                          <div className="w-0.5 h-7 bg-blue-500 flex-shrink-0" />
                          <EmployeeNodeCard
                            employee={emp}
                            stats={empStats}
                            isSelected={selectedNodeId === emp.id}
                            isMatch={matchesSearch(emp)}
                            onSelect={() => setSelectedNodeId(emp.id)}
                            onMouseEnter={(e) => handleCardMouseEnter(emp, e)}
                            onMouseLeave={handleCardMouseLeave}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* --- LEVEL 2: MANAGERS (When intermediate managers exist) --- */}
                {hierarchyTree.managers.length > 0 && (
                  <div className="flex items-start justify-center">
                    {hierarchyTree.managers.map((mgr, mgrIdx) => {
                      const isCollapsed = !!collapsedBranches[mgr.id];
                      const mgrStats = userTaskStats.get(mgr.id);
                      const hasEmployees = mgr.employees && mgr.employees.length > 0;
                      const isFirst = mgrIdx === 0;
                      const isLast = mgrIdx === hierarchyTree.managers.length - 1;
                      const hasMultiple = hierarchyTree.managers.length > 1;

                      return (
                        <div
                          key={mgr.id}
                          className="flex flex-col items-center relative px-4 sm:px-6"
                        >
                          {/* Continuous Horizontal Bus Line across managers (Zero-Gap) */}
                          {hasMultiple && !isFirst && (
                            <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-blue-500" />
                          )}
                          {hasMultiple && !isLast && (
                            <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-blue-500" />
                          )}
                          {/* Junction Joint Dot */}
                          {hasMultiple && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-2xs z-10" />
                          )}

                          {/* Vertical Line into Manager Node */}
                          <div className="w-0.5 h-7 bg-blue-500 flex-shrink-0" />

                          {/* Manager Card */}
                          <ManagerNodeCard
                            manager={mgr}
                            stats={mgrStats}
                            employeeCount={mgr.employees?.length || 0}
                            isCollapsed={isCollapsed}
                            isSelected={selectedNodeId === mgr.id}
                            isMatch={matchesSearch(mgr)}
                            onToggle={() => toggleBranch(mgr.id)}
                            onSelect={() => setSelectedNodeId(mgr.id)}
                            onMouseEnter={(e) => handleCardMouseEnter(mgr, e)}
                            onMouseLeave={handleCardMouseLeave}
                          />

                          {/* --- LEVEL 3: EMPLOYEES UNDER THIS MANAGER --- */}
                          {!isCollapsed && hasEmployees && (
                            <div className="flex flex-col items-center w-full">
                              {/* Vertical drop from Manager with Junction Point */}
                              <div className="flex flex-col items-center flex-shrink-0">
                                <div className="w-0.5 h-6 bg-blue-500 flex-shrink-0" />
                                {mgr.employees.length > 1 && (
                                  <div className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-2xs -mt-1 z-10 flex-shrink-0" />
                                )}
                              </div>

                              <div className="flex items-start justify-center">
                                {mgr.employees.map((emp, empIdx) => {
                                  const empStats = userTaskStats.get(emp.id);
                                  const isEmpFirst = empIdx === 0;
                                  const isEmpLast = empIdx === mgr.employees.length - 1;
                                  const hasMultipleEmp = mgr.employees.length > 1;

                                  return (
                                    <div
                                      key={emp.id}
                                      className="flex flex-col items-center relative px-2.5 sm:px-3"
                                    >
                                      {/* Continuous Horizontal connector across employees (Zero-Gap) */}
                                      {hasMultipleEmp && !isEmpFirst && (
                                        <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-blue-500" />
                                      )}
                                      {hasMultipleEmp && !isEmpLast && (
                                        <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-blue-500" />
                                      )}
                                      {/* Junction Joint Dot */}
                                      {hasMultipleEmp && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-600 ring-1 ring-white shadow-2xs z-10" />
                                      )}

                                      {/* Vertical drop into Employee Card */}
                                      <div className="w-0.5 h-5 bg-blue-500 flex-shrink-0" />
                                      <EmployeeNodeCard
                                        employee={emp}
                                        stats={empStats}
                                        isSelected={selectedNodeId === emp.id}
                                        isMatch={matchesSearch(emp)}
                                        onSelect={() => setSelectedNodeId(emp.id)}
                                        onMouseEnter={(e) => handleCardMouseEnter(emp, e)}
                                        onMouseLeave={handleCardMouseLeave}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Direct Reports under Admin when managers ALSO exist */}
                {hierarchyTree.managers.length > 0 && hierarchyTree.directReports.length > 0 && (
                  <div className="flex flex-col items-center mt-6">
                    <div className="w-0.5 h-6 bg-blue-500 flex-shrink-0" />
                    <div className="flex items-center gap-1.5 mb-3 bg-blue-50/90 border border-blue-200/80 px-3 py-1 rounded-sm shadow-2xs">
                      <Shield size={12} className="text-blue-600" />
                      <span className="text-[11px] font-bold text-blue-900 tracking-wide uppercase">
                        Direct Staff ({hierarchyTree.directReports.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      {hierarchyTree.directReports.map((emp) => (
                        <EmployeeNodeCard
                          key={emp.id}
                          employee={emp}
                          stats={userTaskStats.get(emp.id)}
                          isSelected={selectedNodeId === emp.id}
                          isMatch={matchesSearch(emp)}
                          onSelect={() => setSelectedNodeId(emp.id)}
                          onMouseEnter={(e) => handleCardMouseEnter(emp, e)}
                          onMouseLeave={handleCardMouseLeave}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State when no team members reporting */}
                {hierarchyTree.managers.length === 0 && hierarchyTree.directReports.length === 0 && (
                  <div className="flex flex-col items-center mt-6">
                    <div className="w-0.5 h-6 bg-slate-300 flex-shrink-0 mb-3" />
                    <div className="bg-slate-50 border border-slate-200 px-5 py-4 rounded-sm text-center max-w-sm">
                      <Users size={22} className="mx-auto text-slate-400 mb-1.5" />
                      <p className="text-xs font-semibold text-slate-700">No Team Members Assigned</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isManagerView
                          ? "Members assigned to report to you will appear here in the tree structure."
                          : "Add managers and members to visualize the hierarchy."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Users size={36} className="text-slate-300 mb-2" />
                <p className="text-sm font-medium">No hierarchy data available</p>
                <p className="text-xs text-slate-400 mt-1">
                  {isManagerView
                    ? "Your team hierarchy will appear here once reporting relationships are configured."
                    : "Add members and assign managers to visualize the organization hierarchy."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: LIST VIEW */}
        {viewMode === "list" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Reports To</th>
                  <th className="py-2.5 px-3">Direct Reports</th>
                  <th className="py-2.5 px-3">Tasks</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(hierarchyTree?.relevantUsers || unifiedUsers).filter(matchesSearch).map((user) => {
                  const stats = userTaskStats.get(user.id) || {
                    total: 0,
                    completed: 0,
                    inProgress: 0,
                    overdue: 0,
                    completionRate: 0,
                  };
                  const managerUser = unifiedUsers.find((u) => u.id === user.managerId);
                  const isRoot = hierarchyTree?.admin?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedNodeId(user.id)}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            user={user}
                            sizeClasses="w-7 h-7"
                            bgClasses="bg-gradient-to-br from-blue-500 to-indigo-600"
                            textClasses="text-xs font-bold text-white"
                          />
                          <div>
                            <div className="font-semibold text-slate-800">{user.name}</div>
                            <div className="text-[11px] text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold border ${
                            user.role === "org_admin"
                              ? "bg-slate-900 text-white border-slate-900"
                              : user.role === "manager"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                          }`}
                        >
                          {user.role === "org_admin"
                            ? "Organization Admin"
                            : user.role === "manager"
                            ? "Manager"
                            : "Employee"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {managerUser
                          ? managerUser.name
                          : isRoot
                          ? isManagerView
                            ? "— (Team Leader)"
                            : "— (Top Level)"
                          : isManagerView
                          ? hierarchyTree.admin.name
                          : "Direct to Admin"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {(() => {
                          const count = getUserTeamMemberCount(user);
                          if (count > 0) {
                            const isOrgAdminUser = user.role === "org_admin" || user.role === "owner" || user.role === "super_admin";
                            return (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-sm font-semibold">
                                {count} {count === 1 ? (isOrgAdminUser ? "member" : "team member") : (isOrgAdminUser ? "members" : "team members")}
                              </span>
                            );
                          }
                          return "—";
                        })()}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 min-w-[20px]">{stats.total}</span>
                          <div className="w-20 bg-slate-200 h-1.5 rounded-sm overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-sm"
                              style={{ width: `${stats.completionRate}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">{stats.completionRate}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                            isUserActive(user) ? "text-emerald-600" : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isUserActive(user) ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                            }`}
                          />
                          {isUserActive(user) ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/tasks?assigneeId=${user.id}&assigneeName=${encodeURIComponent(user.name || "")}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          Tasks
                          <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 3: DEPARTMENTS VIEW */}
        {viewMode === "departments" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Department Card: Executive & Admin (Only shown if admin exists in relevantUsers) */}
            {!isManagerView && (
              <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-sm bg-slate-900 text-white flex items-center justify-center font-bold">
                      <Crown size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Executive Leadership</h3>
                      <p className="text-[10px] text-slate-400">Administration & Strategy</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm">
                    {(hierarchyTree?.relevantUsers || unifiedUsers).filter((u) => u.role === "org_admin").length}
                  </span>
                </div>
                <div className="space-y-2">
                  {(hierarchyTree?.relevantUsers || unifiedUsers)
                    .filter((u) => u.role === "org_admin")
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-sm bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors cursor-pointer"
                        onClick={() => setSelectedNodeId(u.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <UserAvatar
                              user={u}
                              sizeClasses="w-6 h-6"
                              bgClasses="bg-slate-900"
                              textClasses="text-[10px] font-bold text-white"
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                                isUserActive(u) ? "bg-emerald-500" : "bg-slate-400"
                              } border border-white z-10`}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-800">{u.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-600">
                          {userTaskStats.get(u.id)?.total || 0} tasks
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Department Card: Team Management */}
            <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-sm bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Shield size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      {isManagerView ? "Team Leadership" : "Management & Operations"}
                    </h3>
                    <p className="text-[10px] text-slate-400">Team Leaders & Supervisors</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm">
                  {(hierarchyTree?.relevantUsers || unifiedUsers).filter((u) => u.role === "manager").length}
                </span>
              </div>
              <div className="space-y-2">
                {(hierarchyTree?.relevantUsers || unifiedUsers)
                  .filter((u) => u.role === "manager")
                  .map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-sm bg-blue-50/50 border border-blue-100 hover:bg-blue-100/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedNodeId(u.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <UserAvatar
                            user={u}
                            sizeClasses="w-6 h-6"
                            bgClasses="bg-blue-600"
                            textClasses="text-[10px] font-bold text-white"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                              isUserActive(u) ? "bg-emerald-500" : "bg-slate-400"
                            } border border-white z-10`}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{u.name}</div>
                          <div className="text-[9px] text-slate-400">
                            {u.subordinates?.length || 0} direct reports
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-600">
                        {userTaskStats.get(u.id)?.total || 0} tasks
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Department Card: Team Members / Staff */}
            <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-sm bg-sky-500 text-white flex items-center justify-center font-bold">
                    <UserCheck size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      {isManagerView ? "Team Members" : "Core Staff & Employees"}
                    </h3>
                    <p className="text-[10px] text-slate-400">Execution & Development</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-sm">
                  {(hierarchyTree?.relevantUsers || unifiedUsers).filter((u) => u.role !== "manager" && u.role !== "org_admin").length}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(hierarchyTree?.relevantUsers || unifiedUsers)
                  .filter((u) => u.role !== "manager" && u.role !== "org_admin")
                  .map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-sm bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors cursor-pointer"
                      onClick={() => setSelectedNodeId(u.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <UserAvatar
                            user={u}
                            sizeClasses="w-6 h-6"
                            bgClasses="bg-sky-500"
                            textClasses="text-[10px] font-bold text-white"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                              isUserActive(u) ? "bg-emerald-500" : "bg-slate-400"
                            } border border-white z-10`}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">{u.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-600">
                        {userTaskStats.get(u.id)?.total || 0} tasks
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* --- HOVER-BASED TASK SUMMARY FLYOUT PANEL --- */}
        {hoveredUser && (
          <UserTaskFlyoutPanel
            user={hoveredUser}
            stats={userTaskStats.get(hoveredUser.id)}
            teamMemberCount={getUserTeamMemberCount(hoveredUser)}
            totalOrgMembers={hierarchyTree?.totalMembers ?? (hierarchyTree?.relevantUsers?.length || unifiedUsers.length)}
            position={hoverCardPos}
            onClose={() => setHoveredUser(null)}
            onMouseEnter={handleFlyoutMouseEnter}
            onMouseLeave={handleFlyoutMouseLeave}
            onViewTasks={() => setLocation(`/tasks?assigneeId=${hoveredUser.id}&assigneeName=${encodeURIComponent(hoveredUser.name || "")}`)}
          />
        )}
      </div>

      {/* --- ADD MEMBER MODAL DIALOG --- */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-sm shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                <UserPlus size={16} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Add Organization Member
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Invite a new team member and configure their reporting relationship.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddMemberSubmit} className="space-y-3.5 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  First Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Rahul"
                  value={newMemberForm.firstName}
                  onChange={(e) =>
                    setNewMemberForm((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  className="text-xs h-8 rounded-sm border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Last Name
                </label>
                <Input
                  placeholder="e.g. Sharma"
                  value={newMemberForm.lastName}
                  onChange={(e) =>
                    setNewMemberForm((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  className="text-xs h-8 rounded-sm border-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email Address *
              </label>
              <Input
                type="email"
                required
                placeholder="colleague@company.com"
                value={newMemberForm.email}
                onChange={(e) =>
                  setNewMemberForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="text-xs h-8 rounded-sm border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Role
                </label>
                <Select
                  value={newMemberForm.role}
                  onValueChange={(val) =>
                    setNewMemberForm((prev) => ({ ...prev, role: val }))
                  }
                >
                  <SelectTrigger className="text-xs h-8 rounded-sm border-slate-200 bg-white">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="org_admin">Organization Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reports To (Manager)
                </label>
                <Select
                  value={newMemberForm.managerId || "none"}
                  onValueChange={(val) =>
                    setNewMemberForm((prev) => ({
                      ...prev,
                      managerId: val === "none" ? "" : val,
                    }))
                  }
                  disabled={newMemberForm.role === "org_admin"}
                >
                  <SelectTrigger className="text-xs h-8 rounded-sm border-slate-200 bg-white">
                    <SelectValue placeholder="Direct to Admin" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="none">Direct to Admin</SelectItem>
                    {unifiedUsers
                      .filter(
                        (u) =>
                          u.role === "manager" ||
                          u.roles?.some((r) => r === "manager")
                      )
                      .map((mgr) => (
                        <SelectItem key={mgr.id} value={mgr.id}>
                          {mgr.name} (Manager)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Department (Optional)
                </label>
                <Input
                  placeholder="e.g. Engineering"
                  value={newMemberForm.department}
                  onChange={(e) =>
                    setNewMemberForm((prev) => ({ ...prev, department: e.target.value }))
                  }
                  className="text-xs h-8 rounded-sm border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Designation (Optional)
                </label>
                <Input
                  placeholder="e.g. Full Stack Dev"
                  value={newMemberForm.designation}
                  onChange={(e) =>
                    setNewMemberForm((prev) => ({ ...prev, designation: e.target.value }))
                  }
                  className="text-xs h-8 rounded-sm border-slate-200"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddMemberOpen(false)}
                className="text-xs h-8 rounded-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={inviteMemberMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8 rounded-sm"
              >
                {inviteMemberMutation.isPending ? "Sending Invite..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUBCOMPONENTS: NODE CARDS & FLOATING FLYOUT
// -----------------------------------------------------------------------------

/**
 * Level 1 Node Card: Organization Admin
 */
function AdminNodeCard({
  admin,
  isManagerView = false,
  stats,
  totalMembers = 0,
  totalManagers = 0,
  isSelected,
  isMatch,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}) {
  const roleLabel = isManagerView
    ? admin.designation || "Manager"
    : admin.role === "org_admin"
    ? "Organization Admin"
    : admin.role === "owner"
    ? "Organization Owner"
    : admin.role === "super_admin"
    ? "Super Admin"
    : admin.role === "manager" || admin.roles?.includes("manager")
    ? admin.designation || "Manager"
    : admin.designation || "Administrator";

  return (
    <div
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative bg-white rounded-sm border p-3.5 shadow-sm transition-all duration-150 cursor-pointer w-72 sm:w-80 group ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
          : "border-slate-200/90 hover:border-blue-400 hover:shadow-md"
      } ${!isMatch ? "opacity-35" : "opacity-100"}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative">
          <UserAvatar
            user={admin}
            sizeClasses="w-11 h-11"
            bgClasses={
              isManagerView
                ? "bg-gradient-to-br from-blue-600 to-indigo-700"
                : "bg-slate-900"
            }
            textClasses="text-sm font-bold text-white"
          />
          <span
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ${
              isUserActive(admin)
                ? "bg-emerald-500 ring-emerald-500/30"
                : "bg-slate-400 ring-slate-400/30"
            } border-2 border-white ring-1 z-10`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm truncate tracking-tight">
              {admin.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                isUserActive(admin) ? "text-emerald-600" : "text-slate-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isUserActive(admin) ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isUserActive(admin) ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-sm">
              {roleLabel}
            </span>
            {isManagerView && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm">
                Team Lead
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Metrics Pills */}
      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600">
        <span className="bg-blue-50/80 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-sm font-semibold">
          {stats?.total ?? 0} Tasks
        </span>
        <span className="bg-purple-50/80 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-sm font-semibold">
          {totalMembers ?? 0} {totalMembers === 1 ? (isManagerView ? "Team Member" : "Member") : (isManagerView ? "Team Members" : "Members")}
        </span>
        {!isManagerView && (
          <span className="bg-indigo-50/80 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-sm font-semibold">
            {totalManagers ?? 0} Teams
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Level 2 Node Card: Manager
 */
function ManagerNodeCard({
  manager,
  stats,
  employeeCount = 0,
  isCollapsed,
  isSelected,
  isMatch,
  onToggle,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}) {
  return (
    <div
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative bg-white rounded-sm border p-3 shadow-xs transition-all duration-150 cursor-pointer w-60 sm:w-64 group ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
          : "border-slate-200/90 hover:border-blue-400 hover:shadow-md"
      } ${!isMatch ? "opacity-35" : "opacity-100"}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div className="relative">
          <UserAvatar
            user={manager}
            sizeClasses="w-10 h-10"
            bgClasses="bg-gradient-to-br from-blue-500 to-indigo-600"
            textClasses="text-xs font-bold text-white"
          />
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${
              isUserActive(manager)
                ? "bg-emerald-500 ring-emerald-500/30"
                : "bg-slate-400 ring-slate-400/30"
            } border-2 border-white ring-1 z-10`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="font-bold text-slate-800 text-xs truncate">
              {manager.name}
            </h4>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 ${
                isUserActive(manager) ? "text-emerald-600" : "text-slate-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isUserActive(manager) ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isUserActive(manager) ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="mt-0.5">
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-sm">
              {manager.designation || "Manager"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
        <span>{stats?.total ?? 0} Tasks</span>
        <span>{employeeCount} Members</span>
      </div>

      {/* Collapse/Expand Toggle Pill on bottom */}
      {employeeCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          title={isCollapsed ? "Expand Branch" : "Collapse Branch"}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-sm bg-white border border-blue-400 text-blue-600 hover:bg-blue-50 flex items-center justify-center shadow-xs transition-transform hover:scale-110 z-10"
        >
          {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      )}
    </div>
  );
}

/**
 * Level 3 Node Card: Employee
 */
function EmployeeNodeCard({
  employee,
  stats,
  isSelected,
  isMatch,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}) {
  return (
    <div
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative bg-white rounded-sm border p-2 shadow-xs transition-all duration-150 cursor-pointer w-36 sm:w-40 group ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
          : "border-slate-200/80 hover:border-blue-400 hover:shadow-md"
      } ${!isMatch ? "opacity-35" : "opacity-100"}`}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <UserAvatar
            user={employee}
            sizeClasses="w-7 h-7"
            bgClasses="bg-sky-100"
            textClasses="text-[10px] font-bold text-sky-800"
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
              isUserActive(employee) ? "bg-emerald-500" : "bg-slate-400"
            } border border-white z-10`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <div className="font-semibold text-slate-800 text-[11px] truncate">
              {employee.name}
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-medium flex-shrink-0 ${
                isUserActive(employee) ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isUserActive(employee) ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isUserActive(employee) ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {employee.designation || "Employee"}
          </div>
        </div>
      </div>
      <div className="mt-1.5 pt-1 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-500 font-medium">
        <span>{stats?.total || 0} Tasks</span>
        {stats?.overdue > 0 && (
          <span className="text-red-600 font-bold">{stats.overdue} overdue</span>
        )}
      </div>
    </div>
  );
}

/**
 * Hover-Based Floating Task Summary Card (Flyout Panel)
 * Matches reference image popup with two KPI cards, status breakdown list, and View All Tasks button.
 */
function UserTaskFlyoutPanel({
  user,
  stats = { total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0 },
  teamMemberCount,
  totalOrgMembers,
  position,
  onClose,
  onMouseEnter,
  onMouseLeave,
  onViewTasks,
}) {
  const total = stats.total || 0;
  const completedPct = total > 0 ? Math.round((stats.completed / total) * 100) : 0;
  const inProgPct = total > 0 ? Math.round((stats.inProgress / total) * 100) : 0;
  const pendingPct = total > 0 ? Math.round((stats.pending / total) * 100) : 0;
  const overduePct = total > 0 ? Math.round((stats.overdue / total) * 100) : 0;

  const roleTitle =
    user.role === "org_admin"
      ? "Organization Admin"
      : user.role === "manager"
      ? "Manager"
      : "Employee";

  const isOrgAdmin =
    user.role === "org_admin" ||
    user.role === "owner" ||
    user.role === "super_admin" ||
    (Array.isArray(user.roles) &&
      (user.roles.includes("org_admin") ||
        user.roles.includes("super_admin") ||
        user.roles.includes("owner")));

  const isManager =
    !isOrgAdmin &&
    (user.role === "manager" ||
      (Array.isArray(user.roles) && user.roles.includes("manager")));

  const isManagerOrAdmin = isOrgAdmin || isManager;

  const resolvedMemberCount = isOrgAdmin
    ? (totalOrgMembers ?? teamMemberCount ?? 0)
    : (teamMemberCount !== undefined
        ? teamMemberCount
        : (user.subordinates?.length ?? (user.role === "manager" ? 0 : 0)));

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99999,
      }}
      className="w-72 bg-white rounded-sm border border-slate-200/90 shadow-2xl p-4 transition-all duration-150 animate-in fade-in zoom-in-95 pointer-events-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <UserAvatar
              user={user}
              sizeClasses="w-9 h-9"
              bgClasses="bg-gradient-to-br from-blue-500 to-indigo-600"
              textClasses="text-xs font-bold text-white"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                isUserActive(user)
                  ? "bg-emerald-500 ring-emerald-500/30"
                  : "bg-slate-400 ring-slate-400/30"
              } border border-white ring-1 z-10`}
            />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs tracking-tight">
              {user.name}
            </h4>
            <div className="text-[11px] text-blue-600 font-medium">
              {roleTitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
              isUserActive(user) ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isUserActive(user) ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {isUserActive(user) ? "Active" : "Inactive"}
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-sm transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Two Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-2 my-3">
        {/* Blue Card: Total Tasks */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-sm p-2.5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-sm bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
            <CheckSquare size={14} />
          </div>
          <div>
            <div className="text-base font-extrabold text-blue-900 leading-tight">
              {total}
            </div>
            <div className="text-[10px] text-blue-600 font-medium">
              Total Tasks
            </div>
          </div>
        </div>

        {/* Second Card: Members for Admin, Team Members for Managers, OR Completed Tasks for Employees */}
        {isManagerOrAdmin ? (
          <div className="bg-purple-50/70 border border-purple-100 rounded-sm p-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
              <Users size={14} />
            </div>
            <div>
              <div className="text-base font-extrabold text-purple-900 leading-tight">
                {resolvedMemberCount}
              </div>
              <div className="text-[10px] text-purple-600 font-medium">
                {isOrgAdmin
                  ? (resolvedMemberCount === 1 ? "Member" : "Members")
                  : (resolvedMemberCount === 1 ? "Team Member" : "Team Members")}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-sm p-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={14} />
            </div>
            <div>
              <div className="text-base font-extrabold text-emerald-900 leading-tight">
                {stats.completed || 0}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">
                Completed ({completedPct}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Breakdown List */}
      <div className="space-y-1.5 text-xs pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Completed
          </span>
          <span className="font-bold text-slate-800 text-[11px]">
            {stats.completed} ({completedPct}%)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            In Progress
          </span>
          <span className="font-bold text-slate-800 text-[11px]">
            {stats.inProgress} ({inProgPct}%)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Pending
          </span>
          <span className="font-bold text-slate-800 text-[11px]">
            {stats.pending} ({pendingPct}%)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Overdue
          </span>
          <span className="font-bold text-red-600 text-[11px]">
            {stats.overdue} ({overduePct}%)
          </span>
        </div>
      </div>

      {/* Action Button: View All Tasks */}
      <div className="pt-2.5">
        <button
          onClick={onViewTasks}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 rounded-sm flex items-center justify-center gap-1.5 shadow-xs transition-colors"
        >
          <span>View All Tasks</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>,
    document.body
  );
}
