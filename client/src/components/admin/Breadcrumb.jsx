import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

export default function Breadcrumb() {
  const [location] = useLocation();

  const getBreadcrumbItems = () => {
    const pathSegments = location.split('/').filter(Boolean);
    const items = [{ name: 'TaskSetu', href: '/', isHome: true }];

    // Define route mappings
    const routeNames = {
      'dashboard': 'Home',
      'tasks': 'Tasks',
      'users': 'Users',
      'team-members': 'Team Members',
      'user-management': 'User Management',
      'invite-users': 'Invite Users',
      'settings': 'Settings',
      'reports': 'Reports',
      'forms': 'Forms',
      'integrations': 'Integrations',
      'roles': 'Roles',
      'edit-profile': 'Edit Profile',
      'settings': 'Settings',
      'projects': 'Projects',
      'admin': 'Admin'
    };

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const displayName = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

      items.push({
        name: displayName,
        href: currentPath,
        isActive: index === pathSegments.length - 1
      });
    });

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  // Don't show breadcrumb for root or login pages
  if (location === '/' || location === '/login' || location === '/register') {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-3">
      {breadcrumbItems.map((item, index) => (
        <div key={item.href} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />}

          {item.isHome ? (
            <a href={item.href} className="flex items-center text-gray-500 hover:text-gray-700 cursor-pointer">
              <Home className="h-4 w-4" />
            </a>
          ) : item.isActive ? (
            <span className="font-medium text-gray-900">{item.name}</span>
          ) : (
            <a href={item.href} className="text-gray-500 hover:text-gray-700 cursor-pointer">
              {item.name}
            </a>
          )}
        </div>
      ))}
    </nav>
  );
}