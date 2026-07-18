import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Menu, X, ArrowUp } from "lucide-react";
import { getMenuByRole } from "./config";
import SidebarItem from "./SidebarItem";
import { useAuth } from "@/features/shared/hooks/useAuth";
import { useActiveRole } from "@/components/RoleSwitcher";
import useLicense from "@/hooks/useLicense";
import {
  LICENSE_TIER_LEVELS,
  GRACE_PERIOD_DAYS,
} from "@/utils/licenseConstants";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

import { CloudflareImage } from "@/components/ui/cloudflare-image";

const Sidebar = ({
  role = "individual",
  onLogout,
  className = "",
  defaultCollapsed = false,
  showToggle = true,
  setSidebarOpen,
  onCollapsedChange,
}) => {
  const { user } = useAuth();
  const { data: authUser } = useQuery({
    queryKey: ["/api/auth/me"],
    initialData: user,
    staleTime: 5 * 60 * 1000,
  });
  const { data: profileUser } = useQuery({
    queryKey: ["/api/users", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return null;
      const response = await fetch(`/api/users/${authUser.id}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!authUser?.id,
    staleTime: 2 * 60 * 1000,
  });
  const currentUser = profileUser || authUser || user;

  const { activeRole } = useActiveRole();
  const { license, features, checkFeature } = useLicense();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const effectiveRole = activeRole || role;

  // Check if screen is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Auto expand on mobile when menu is open
      if (window.innerWidth < 768) {
        setIsCollapsed(false);
      } else {
        setIsCollapsed(defaultCollapsed);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [defaultCollapsed]);

  // Close mobile menu when clicking outside (optional)
  useEffect(() => {
    if (isMobile && isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobile, isMobileMenuOpen]);

  const filterSettingsChildren = useCallback((item, role, isPrimaryAdmin) => {
    if (item.id === "settings" && item.children) {
      return {
        ...item,
        children: item.children.filter((child) => {
          if (child.id === "billing-management") {
            return role === "individual" || isPrimaryAdmin === true;
          }
          return true;
        }),
      };
    }
    return item;
  }, []);

  const menuItems = useMemo(() => {
    try {
      const menu = getMenuByRole(effectiveRole);
      let validMenu = Array.isArray(menu) ? menu.filter((i) => i && i.id) : [];
      validMenu = validMenu.map((item) =>
        filterSettingsChildren(
          item,
          effectiveRole,
          currentUser?.isPrimaryAdmin,
        ),
      );
      return validMenu;
    } catch (err) {
      console.error("Error loading menu items:", err);
      return [];
    }
  }, [effectiveRole, currentUser?.isPrimaryAdmin, filterSettingsChildren]);

  useEffect(() => {
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  const handleItemClick = useCallback(
    (action) => {
      if (action === "logout" && onLogout) onLogout();
      setSidebarOpen?.(false);
      // Close mobile menu on item click
      if (isMobile) setIsMobileMenuOpen(false);
    },
    [onLogout, setSidebarOpen, isMobile],
  );

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileMenuOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const branding = useMemo(() => {
    const orgName =
      currentUser?.organization?.name ||
      currentUser?.organizationName ||
      "Organization";
    const hasOrg = currentUser?.organizationId || currentUser?.organization;

    const brandings = {
      super_admin: { title: "TaskSetu Admin", subtitle: "Super Admin Panel" },
      organization: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Organization Workspace",
      },
      admin: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Organization Workspace",
      },
      org_admin: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Organization Workspace",
      },
      manager: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Team Workspace",
      },
      employee: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Organization Workspace",
      },
      orgMember: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Organization Workspace",
      },
      org_member: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Organization Workspace",
      },
      member: {
        title: "TaskSetu",
        subtitle: hasOrg ? `${orgName} Workspace` : "Personal Workspace",
      },
    };

    return (
      brandings[effectiveRole] || {
        title: "TaskSetu",
        subtitle: "Personal Workspace",
      }
    );
  }, [
    effectiveRole,
    currentUser?.organization?.name,
    currentUser?.organizationName,
    currentUser?.organizationId,
    currentUser?.organization,
  ]);

  const userInfo = useMemo(() => {
    const displayName =
      currentUser?.name ||
      currentUser?.fullName ||
      (currentUser?.firstName && currentUser?.lastName
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : null) ||
      currentUser?.email?.split("@")[0] ||
      "User";
    const initials = displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const avatarUrl =
      currentUser?.profileImageUrl ||
      currentUser?.avatar ||
      currentUser?.profilePicture ||
      currentUser?.profilePic ||
      currentUser?.profileImage ||
      currentUser?.photoURL ||
      null;

    return { displayName, initials, avatarUrl };
  }, [
    currentUser?.name,
    currentUser?.fullName,
    currentUser?.firstName,
    currentUser?.lastName,
    currentUser?.email,
    currentUser?.profileImageUrl,
    currentUser?.avatar,
    currentUser?.profilePicture,
    currentUser?.profilePic,
    currentUser?.profileImage,
    currentUser?.photoURL,
  ]);

  // Determine sidebar width and visibility classes
  const getSidebarClasses = () => {
    if (isMobile) {
      return `fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`;
    }
    // Desktop: collapsed or expanded
    return `relative transition-all duration-300 ${isCollapsed ? "w-[70px]" : "w-[280px]"}`;
  };

  // Don't show text on mobile when collapsed (but mobile is never collapsed, it's either open or closed)
  const shouldShowText = () => {
    if (isMobile) return true; // Mobile menu always shows full text when open
    return !isCollapsed; // Desktop shows text only when not collapsed
  };

  const sidebarWidth = isCollapsed ? "w-[70px]" : "w-[280px]";

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && !isMobileMenuOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 text-gray-600 hover:text-gray-900  rounded-md transition-colors md:hidden"
        >
          <Menu size={20} color="white" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div
        className={`flex flex-col h-full text-white ${getSidebarClasses()} ${className}`}
        style={{
          background:
            "linear-gradient(180deg, #20439a 0%, #1f4398 14%, #1c3f90 35%, #17397f 62%, #143474 100%)",
          borderRight: "1px solid rgba(137, 173, 255, 0.2)",
          minWidth: isMobile ? "280px" : isCollapsed ? "70px" : "220px",
        }}
      >
        {/* Close button for mobile and half-screens */}
        <button
          onClick={() => {
            setSidebarOpen?.(false);
            closeMobileMenu();
          }}
          className="absolute top-4 right-4 p-1 rounded-sm hover:bg-blue-800/50 z-50 lg:hidden text-white"
        >
          <X size={20} />
        </button>

        {/* Brand Header */}
        <div
          className={`
            border-b border-white/10
            ${shouldShowText() ? "py-3 px-5" : "py-4 px-5"}
            flex items-center
            ${shouldShowText() ? "justify-between" : "justify-center"}
            min-h-[65px]
          `}
          style={{
            background:
              "linear-gradient(180deg, rgba(26, 62, 149, 0.95) 0%, rgba(22, 56, 139, 0.9) 100%)",
          }}
        >
          {shouldShowText() ? (
            <div className="overflow-hidden">
              <h1 className="text-white text-sm font-bold tracking-[1.5px] uppercase">
                {branding.title}
              </h1>
              <p className="text-blue-100/75 text-[11px] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                {branding.subtitle}
              </p>
            </div>
          ) : (
            <span className="text-blue-100 font-extrabold text-[15px] tracking-[1px]">
              TS
            </span>
          )}

          {showToggle && shouldShowText() && !isMobile && (
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex items-center justify-center p-1 rounded-md transition-all duration-150 flex-shrink-0 hover:bg-blue-500/25"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.75)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "rgba(255,255,255,0.75)";
              }}
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>

        {/* Profile Section */}
        <div
          className={`
            border-b border-white/10
            ${shouldShowText() ? "py-2.5 px-5" : "py-2.5 px-2"}
            flex items-center
            ${shouldShowText() ? "justify-start" : "justify-center"}
          `}
          style={{
            background:
              "linear-gradient(180deg, rgba(42, 86, 186, 0.45) 0%, rgba(26, 67, 157, 0.35) 100%)",
          }}
        >
          <div
            className={`
              relative flex-shrink-0 rounded-full overflow-hidden
              flex items-center justify-center
              ${shouldShowText() ? "w-[38px] h-[38px]" : "w-[34px] h-[34px]"}
              border-2 border-blue-500
              text-blue-500 font-bold text-[13px]
            `}
            style={{ background: "rgba(13, 38, 97, 0.95)" }}
          >
            {userInfo.avatarUrl ? (
              <CloudflareImage
                path={userInfo.avatarUrl}
                alt={userInfo.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{userInfo.initials}</span>
            )}
          </div>

          {shouldShowText() && (
            <div className="overflow-hidden ml-3">
              <p className="text-white text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                {userInfo.displayName}
              </p>
              <p className="text-blue-100/75 text-[11px] mt-0.5 capitalize">
                {effectiveRole.replace(/_/g, " ")}
              </p>
            </div>
          )}
        </div>

        {/* Expand Toggle when collapsed (Desktop only) */}
        {!isMobile && isCollapsed && showToggle && (
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex absolute top-[18px] -right-3 w-6 h-6 bg-blue-500 rounded-full text-white items-center justify-center z-50 shadow-lg hover:bg-blue-600 transition-all duration-150"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #2d4a6f; border-radius: 2px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b5a7f; }
          `}</style>

          {menuItems
            .filter((item) => !item.isLicense)
            .map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isCollapsed={!shouldShowText()}
                onItemClick={handleItemClick}
                license={license}
                checkFeature={checkFeature}
                onExpandSidebar={() => setIsCollapsed(false)}
              />
            ))}
        </nav>

        {/* Expiry Warning Card */}
        {(() => {
          if (
            !license?.expiry ||
            license?.status === "expired" ||
            license?.code?.toLowerCase() === "free" ||
            license?.code?.toLowerCase() === "explore"
          )
            return null;

          const diffDays = Math.ceil(
            (new Date(license.expiry).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          );

          const licenseCode = license?.code?.toUpperCase();
          const gracePeriodDays = GRACE_PERIOD_DAYS[licenseCode] || 0;

          // Check if in grace period
          const isInGracePeriod =
            diffDays <= 0 && Math.abs(diffDays) <= gracePeriodDays;

          // Show warning if expiring within 5 days OR if in grace period
          if ((diffDays <= 0 && !isInGracePeriod) || diffDays > 5) return null;

          const formattedExpiryDate = new Date(
            license.expiry,
          ).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          const graceDaysRemaining = gracePeriodDays - Math.abs(diffDays);

          if (!shouldShowText()) {
            return (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mx-auto mb-3 w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center border border-amber-500/30 group relative cursor-pointer">
                      <span className="text-amber-400 font-bold text-xs">
                        !
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-[#244baf] text-white text-xs border border-[#89adff]/30 shadow-lg px-2.5 py-1 z-[100]"
                  >
                    {isInGracePeriod
                      ? `Grace Period: ${graceDaysRemaining} days left`
                      : `Expiring on ${formattedExpiryDate}`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return (
            <div className="mx-4 mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              {isInGracePeriod ? (
                <p className="text-amber-300/90 text-[11px] leading-snug whitespace-normal">
                  Your licence expired on{" "}
                  <span className="font-semibold text-amber-300">
                    {formattedExpiryDate}
                  </span>
                  . Your Grace Period has started. Upgrade your licence now.
                </p>
              ) : (
                <p className="text-amber-300/90 text-[11px] leading-snug whitespace-normal">
                  Your licence is about to expire on{" "}
                  <span className="font-semibold text-amber-300">
                    {formattedExpiryDate}
                  </span>
                  , renew your licence to efficiently manage your tasks.
                </p>
              )}
            </div>
          );
        })()}

        {/* License item fixed at the bottom */}
        <div className="mt-auto sticky bottom-0 z-10">
          {menuItems
            .filter((item) => item.isLicense)
            .map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isCollapsed={!shouldShowText()}
                onItemClick={handleItemClick}
                license={license}
                checkFeature={checkFeature}
                onExpandSidebar={() => setIsCollapsed(false)}
              />
            ))}
        </div>
      </div>
    </>
  );
};

export default React.memo(Sidebar);
