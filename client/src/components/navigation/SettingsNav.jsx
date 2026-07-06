// Settings navigation items
import { Receipt } from 'lucide-react';

const settingsNavItems = [
  {
    name: 'Profile',
    href: '/settings/profile',
    icon: UserIcon,
  },
  {
    name: 'License Management',
    href: '/admin/subscription',
    icon: CrownIcon,
  },
  {
    name: 'Billing & Invoices',
    href: '/admin/billing',
    icon: Receipt,
  },
  {
    name: 'Notifications',
    href: '/settings/notifications',
    icon: BellIcon,
  },
  {
    name: 'Help & Support',
    href: '/help',
    icon: QuestionMarkCircleIcon,
  },
];

export { settingsNavItems };