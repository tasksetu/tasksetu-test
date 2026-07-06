// Main exports for the sidebar system
export { default as Sidebar } from './Sidebar';
export { default as SidebarItem } from './SidebarItem';
export { default as MemberSidebar } from './MemberSidebar';
export { default as UserContextSidebar } from './UserContextSidebar';
export {
  sidebarMenus,
  getMenuByRole,
  findActiveItem,
  menuItemMatchesLocation,
} from './config';

// Usage examples:
// import { Sidebar, MemberSidebar } from '@/layout/sidebar';

// For specific roles:
// <Sidebar role="member" onLogout={handleLogout} />
// <Sidebar role="orgMember" onLogout={handleLogout} />
// <Sidebar role="organization" onLogout={handleLogout} />
// <Sidebar role="super_admin" onLogout={handleLogout} />

// For automatic member role detection:
// <MemberSidebar userRole="member" hasOrganization={false} onLogout={handleLogout} />
// <MemberSidebar userRole="member" hasOrganization={true} onLogout={handleLogout} />