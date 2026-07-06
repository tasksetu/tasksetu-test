# Features Directory

## Architecture Overview

This directory organizes code by business features, making it easy to maintain and scale for multiple user roles (Individual, Organization, SuperAdmin).

## Structure

```
features/
├── shared/              # Shared components, hooks, and utilities
│   ├── components/      # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API service functions
│   └── utils/          # Utility functions
├── dashboard/          # Dashboard feature
│   ├── components/     # Dashboard-specific components
│   ├── hooks/          # Dashboard-specific hooks
│   ├── pages/          # Dashboard pages by role
│   └── services/       # Dashboard API services
├── tasks/              # Task management feature
│   ├── components/     # Task-specific components
│   ├── forms/          # Task creation/editing forms
│   ├── hooks/          # Task-specific hooks
│   ├── pages/          # Task management pages
│   └── services/       # Task API services
├── calendar/           # Calendar integration feature
│   ├── components/     # Calendar-specific components
│   ├── hooks/          # Calendar-specific hooks
│   ├── pages/          # Calendar views
│   └── services/       # Calendar API services
└── auth/               # Authentication feature
    ├── components/     # Auth-specific components
    ├── hooks/          # Auth-specific hooks
    ├── pages/          # Login, register, etc.
    └── services/       # Auth API services
```

## Benefits

1. **Role Scalability**: Easy to add new roles without restructuring
2. **Feature Isolation**: Each feature is self-contained
3. **Shared Resources**: Common components and utilities are centralized
4. **Clear Boundaries**: Obvious separation of concerns
5. **Easy Testing**: Feature-based testing is straightforward
6. **Team Collaboration**: Different teams can work on different features

## Guidelines

- Keep feature-specific code in respective feature directories
- Share common code through the `shared` directory
- Use consistent naming conventions across features
- Import shared components using `@shared/` alias
- Keep API services close to the features that use them