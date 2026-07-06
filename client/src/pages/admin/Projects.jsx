import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Projects() {
  const [projects, setProjects] = useState([
    {
      id: 1,
      name: "Website Redesign",
      description:
        "Complete overhaul of the company website with modern design and improved UX",
      status: "In Progress",
      priority: "High",
      startDate: "2024-05-01",
      endDate: "2024-07-15",
      progress: 65,
      teamMembers: 4,
      budget: 50000,
    },
    {
      id: 2,
      name: "Mobile App Development",
      description: "Native iOS and Android app for customer engagement",
      status: "Planning",
      priority: "Medium",
      startDate: "2024-06-01",
      endDate: "2024-10-30",
      progress: 15,
      teamMembers: 6,
      budget: 80000,
    },
    {
      id: 3,
      name: "API Integration",
      description: "Integration with third-party services and internal systems",
      status: "Completed",
      priority: "High",
      startDate: "2024-03-01",
      endDate: "2024-05-15",
      progress: 100,
      teamMembers: 3,
      budget: 30000,
    },
    {
      id: 4,
      name: "Database Migration",
      description:
        "Migration from legacy database to modern cloud infrastructure",
      status: "On Hold",
      priority: "Low",
      startDate: "2024-08-01",
      endDate: "2024-11-30",
      progress: 5,
      teamMembers: 2,
      budget: 25000,
    },
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800";
      case "In Progress":
        return "bg-blue-100 text-blue-800";
      case "Planning":
        return "bg-blue-100 text-blue-800";
      case "On Hold":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800";
      case "Medium":
        return "bg-blue-100 text-blue-800";
      case "Low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-4">
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Projects
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage and track all your projects
        </p>
      </div>

      <div className="mb-3">
        <Button variant="primary" className="h-9">
          Create New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {project.name}
              </h3>
              <div className="flex space-x-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}
                >
                  {project.status}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(project.priority)}`}
                >
                  {project.priority}
                </span>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-3">
              {project.description}
            </p>

            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Progress
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {project.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Start Date:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {project.startDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  End Date:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {project.endDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Team Size:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {project.teamMembers} members
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Budget:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(project.budget)}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                <Button variant="outline" className="flex-1 h-9 text-sm">
                  View Details
                </Button>
                <Button variant="outline" className="flex-1 h-9 text-sm">
                  Edit
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-600 mb-3">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No projects found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Get started by creating your first project.
          </p>
        </div>
      )}
    </div>
  );
}
