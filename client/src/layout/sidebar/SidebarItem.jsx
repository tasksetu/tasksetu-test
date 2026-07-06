// SidebarItem.jsx
import React, { useState, useEffect } from "react";
import { ChevronDown, ArrowUp } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { menuItemMatchesLocation } from "./config";
import { LICENSE_TIER_LEVELS } from "@/utils/licenseConstants";
import UpgradeRequiredModal from "@/components/modals/UpgradeRequiredModal";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const SidebarItem = ({
  item,
  isCollapsed = false,
  onItemClick,
  depth = 0,
  license,
  checkFeature,
  onExpandSidebar,
}) => {
  const [pathname, setLocation] = useLocation();
  const search = useSearch();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // IDs that require the FORM_CREATE feature
  const FORM_FEATURE_ITEMS = new Set(["form-builder", "form-library"]);

  const hasChildren = item.children && item.children.length > 0;
  const pathMatches = (p) => menuItemMatchesLocation(p, pathname, search);
  const isActive = pathMatches(item.path);
  const hasActiveChild =
    hasChildren && item.children.some((child) => pathMatches(child.path));
  const isActiveOrChildActive = isActive || hasActiveChild;

  useEffect(() => {
    if (hasChildren && hasActiveChild) setIsExpanded(true);
  }, [hasChildren, hasActiveChild]);

  const handleClick = (e) => {
    if (item.action === "logout") {
      e.preventDefault();
      onItemClick?.("logout");
      return;
    }
    // ✅ License gate: block form-builder & form-library if FORM_CREATE not available
    if (FORM_FEATURE_ITEMS.has(item.id)) {
      const hasAccess = checkFeature ? checkFeature("FORM_CREATE") : true;
      if (!hasAccess) {
        e.preventDefault();
        setShowUpgradeModal(true);
        return;
      }
    }
    if (hasChildren) {
      e.preventDefault();
      if (isCollapsed && onExpandSidebar) {
        setIsExpanded(true);
        onExpandSidebar();
      } else {
        setIsExpanded((prev) => !prev);
      }
    }
    if (item.path) onItemClick?.(item.path);
  };

  const IconComponent = item.icon;

  // Handle license item specially
  if (item.isLicense) {
    const isTopTier =
      license?.code && LICENSE_TIER_LEVELS[license.code?.toUpperCase()] >= 4;

    if (isCollapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full py-3 px-0 flex justify-center items-center cursor-pointer group relative">
                <IconComponent size={16} className="flex-shrink-0 text-blue-100/85" />
              </div>
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              className="bg-[#244baf] text-white text-xs border border-[#89adff]/30 shadow-lg px-2.5 py-1 z-[100]"
            >
              {license?.name || license?.code || "License"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <div
        className="w-full py-3 px-5 flex items-center justify-between border-b border-white/10"
        style={{
          background:
            "linear-gradient(180deg, rgba(42, 86, 186, 0.45) 0%, rgba(26, 67, 157, 0.35) 100%)",
        }}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <IconComponent size={16} className="flex-shrink-0 text-blue-100/85" />
          <div className="overflow-hidden">
            <p className="text-blue-100/60 text-[10px] uppercase tracking-wider">
              Current License
            </p>
            <p className="text-white text-[12px] font-semibold mt-0.5">
              {license?.name || license?.code || "Loading..."}
            </p>
            {(license?.code?.toLowerCase() === "expired" ||
              license?.status?.toLowerCase() === "expired") ? (
              <p className="text-amber-300/90 text-[9px] mt-1.5 leading-snug whitespace-normal pr-2">
                Your plan is expired and it limits your work, so upgrade your
                plan.
              </p>
            ) : (license?.code?.toLowerCase() === "free" ||
              license?.code?.toLowerCase() === "explore") ? (
              <p className="text-amber-300/90 text-[9px] mt-1.5 leading-snug whitespace-normal pr-2">
                Your plan is free and it limits your work, so upgrade your plan.
              </p>
            ) : null}
          </div>
        </div>
        {!isTopTier && license?.code && (
          <Link
            href="/admin/subscription"
            className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-medium rounded-full transition-all duration-200 flex-shrink-0 no-underline"
            title="Upgrade your license"
          >
            <ArrowUp size={10} />
            <span>Upgrade</span>
          </Link>
        )}
      </div>
    );
  }

  const getPaddingClasses = () => {
    if (isCollapsed) return "py-3 px-0";
    if (depth > 0) return "py-2.5 px-5 pl-[38px]";
    return "py-3 px-5";
  };

  const getTextClasses = () => {
    return isActiveOrChildActive ? "text-white" : "text-blue-100/85";
  };

  const getBackgroundClasses = () => {
    return isActiveOrChildActive
      ? "bg-gradient-to-r from-[#4067cb]/95 to-[#345fc3]/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
      : "hover:bg-white/8";
  };

  const getBorderClasses = () => {
    return isActiveOrChildActive
      ? "border-l-4 border-[#89adff]"
      : "border-l-4 border-transparent hover:border-[#6d95ff]";
  };

  const getFontClasses = () => {
    return depth > 0 ? "text-[12.5px]" : "text-[13px]";
  };

  const getFontWeightClasses = () => {
    return isActiveOrChildActive ? "font-semibold" : "font-normal";
  };

  const getJustifyClasses = () => {
    return isCollapsed ? "justify-center" : "justify-start";
  };

  const sharedClasses = `
    flex items-center gap-2.5
    ${getPaddingClasses()}
    ${getTextClasses()}
    ${getBackgroundClasses()}
    ${getBorderClasses()}
    ${getFontClasses()}
    ${getFontWeightClasses()}
    ${getJustifyClasses()}
    cursor-pointer
    transition-all
    duration-150
    no-underline
    relative
    w-full
    box-border
    group
  `;

  const inner = (
    <>
      {IconComponent && (
        <IconComponent
          size={16}
          className="flex-shrink-0 text-inherit transition-colors duration-150"
        />
      )}

      {!isCollapsed && (
        <>
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {item.label}
          </span>

          {item.badge && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 text-white"
              style={{ backgroundColor: item.badgeColor ?? "#3b82f6" }}
            >
              {item.badge}
            </span>
          )}

          {hasChildren && (
            <ChevronDown
              size={13}
              className={`flex-shrink-0 text-inherit transition-transform duration-200 ${
                isExpanded ? "rotate-0" : "-rotate-90"
              }`}
            />
          )}
        </>
      )}

      {/* Tooltip will be handled in the render phase */}
    </>
  );

  const Element = item.path && !hasChildren ? Link : "div";

  const itemContent = (
    <Element
      href={item.path}
      className={sharedClasses}
      onClick={handleClick}
      data-testid={`sidebar-item-${item.id}`}
    >
      {inner}
    </Element>
  );

  return (
    <div className="w-full">
      {isCollapsed ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {itemContent}
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              className="bg-[#244baf] text-white text-xs border border-[#89adff]/30 shadow-lg px-2.5 py-1 z-[100]"
            >
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        itemContent
      )}

      {hasChildren && isExpanded && !isCollapsed && (
        <div className="bg-[#163e9a]/30">
          {item.children.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              isCollapsed={isCollapsed}
              onItemClick={onItemClick}
              depth={depth + 1}
              checkFeature={checkFeature}
              onExpandSidebar={onExpandSidebar}
            />
          ))}
        </div>
      )}

      {/* Upgrade Required Modal for locked features */}
      <UpgradeRequiredModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Form Builder"
        message="Your current plan does not include access to the Form Builder. Upgrade to a higher plan to create and manage forms."
      />
    </div>
  );
};

export default React.memo(SidebarItem);
