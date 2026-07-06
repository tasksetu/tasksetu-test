import React from 'react';
import { Sidebar } from './index';

/**
 * Member-specific sidebar component that automatically handles role mapping
 * for individual and organization members
 */
const MemberSidebar = ({ 
  userRole = 'member', 
  hasOrganization = false,
  onLogout,
  className = '',
  defaultCollapsed = false,
  showToggle = true 
}) => {
  // Determine the appropriate sidebar role based on user context
  const getSidebarRole = () => {
    if (userRole === 'member') {
      // If user is a member and has an organization, they're an org member
      // If user is a member without organization, they're an individual
      return hasOrganization ? 'orgMember' : 'individual';
    }
    
    // Pass through other roles directly
    return userRole;
  };

  const sidebarRole = getSidebarRole();

  return (
    <Sidebar 
      role={sidebarRole}
      onLogout={onLogout}
      className={className}
      defaultCollapsed={defaultCollapsed}
      showToggle={showToggle}
    />
  );
};

export default MemberSidebar;