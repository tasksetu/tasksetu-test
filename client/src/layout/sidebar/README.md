# TaskSetu Unified Sidebar System

A comprehensive, role-based sidebar component system for TaskSetu that dynamically renders navigation menus based on user roles.
## Logins
- orgadmin@gmail.com
- useraccount@gmail.com
- member@gmail.com
- manger@gmail.com
- admin@gmail.com




## Features

- **Role-Based Navigation**: Automatically shows appropriate menu items based on user role
- **Nested Menu Support**: Expandable/collapsible menu sections with children
- **Responsive Design**: Mobile-friendly with overlay and toggle functionality
- **Collapsible Sidebar**: Desktop collapse/expand with persistent state
- **Active State Management**: Automatic highlighting of current page/section
- **Clean Tailwind Styling**: Modern, professional appearance
- **Accessible**: Keyboard navigation and screen reader friendly

## Supported Roles

### Member (Individual Member)
**Role ID**: `member` (without organization)
**Menu Structure**: Dashboard → Tasks → Reports → Settings
- Dashboard: My Dashboard
- Tasks: My Tasks, Create Task, Quick Tasks, Calendar, Milestones, Approvals  
- Reports: My Productivity, My Overdue Tasks
- Settings: Profile, Notifications
- Universal: Help & Support, Logout

### Organization Member  
**Role ID**: `member` (with organization) or `orgMember`
**Menu Structure**: Dashboard → Tasks → Reports → Settings
- Dashboard: My Dashboard
- Tasks: My Tasks, Create Task, Quick Tasks, Calendar, Milestones, Approvals
- Reports: My Productivity, My Overdue Tasks  
- Settings: Profile, Notifications
- Universal: Help & Support, Logout

### Organization Admin
**Role ID**: `admin`, `org_admin`, or `organization`
- Team/Org Dashboard, My Tasks, Team Tasks, All Company Tasks, Create Task, Calendar, Quick Tasks, Milestones, Approvals, Manage Users, Roles & Permissions, Form Library, Reports, Company Settings, Help, Logout

### Super Admin (TaskSetu Owner)
**Role ID**: `superadmin` or `super_admin`
- Platform Overview, License Mapping, System Configurations, Global Notification Rules, All Platform Users, Global Form Library, Analytics (Adoption Metrics, Module Usage, System Performance), Audit Logs, Overrides, My Profile, Help, Logout

## Usage

### Basic Usage
```jsx
import { Sidebar } from '@/layout/sidebar';

// Individual user
<Sidebar role="individual" onLogout={handleLogout} />

// Organization user  
<Sidebar role="organization" onLogout={handleLogout} />

// Super admin
<Sidebar role="superadmin" onLogout={handleLogout} />
```

### Advanced Usage
```jsx
<Sidebar 
  role="organization"
  onLogout={handleLogout}
  defaultCollapsed={false}
  showToggle={true}
  className="custom-sidebar-class"
/>
```

## Props

### Sidebar Component
- `role` (string): User role - 'individual', 'organization', or 'superadmin'
- `onLogout` (function): Callback function for logout action
- `className` (string): Additional CSS classes
- `defaultCollapsed` (boolean): Initial collapsed state (default: false)
- `showToggle` (boolean): Show collapse/expand toggle (default: true)

## File Structure

```
client/src/layout/sidebar/
├── config.js          # Menu configurations for all roles
├── Sidebar.jsx        # Main sidebar component
├── SidebarItem.jsx    # Individual menu item component
├── index.js          # Exports and usage examples
└── README.md         # Documentation
```

## Configuration

Menu items are defined in `config.js` with the following structure:

```javascript
{
  id: 'unique-id',
  label: 'Display Name',
  icon: LucideIcon,
  path: '/route/path',        // Optional: for navigation
  action: 'logout',           // Optional: for special actions
  children: [...]            // Optional: nested menu items
}
```

## Customization

### Adding New Menu Items
Edit `config.js` and add items to the appropriate role section:

```javascript
{
  id: 'new-feature',
  label: 'New Feature',
  icon: NewIcon,
  path: '/new-feature'
}
```

### Adding New Roles
1. Add role configuration to `sidebarMenus` in `config.js`
2. Add role-specific branding in `getRoleBranding()` function
3. Update TypeScript types if using TypeScript

### Styling Customization
The component uses Tailwind classes. Key styling areas:
- Active states: `bg-blue-50 text-blue-700`
- Hover states: `hover:bg-gray-50`
- Role branding: Gradient backgrounds in header
- Mobile responsive: `lg:` breakpoint classes

## Integration

This sidebar system is designed to replace existing sidebar components:
- `CompactSidebar.jsx`
- `Sidebar.jsx` 
- `SimpleSidebar.jsx`
- `SuperAdminSidebar.jsx`
- `SettingsSidebar.jsx`

## Testing

Test IDs are provided for all interactive elements:
- `sidebar-container`
- `sidebar-title`
- `sidebar-subtitle`
- `sidebar-item-{id}`
- `mobile-sidebar-toggle`
- `sidebar-collapse-toggle`