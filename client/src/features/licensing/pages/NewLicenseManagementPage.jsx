import React from "react";
import { LicenseInventory } from "../components/LicenseInventory";
import { UserLicenseAssignment } from "../components/UserLicenseAssignment";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Package, BarChart3 } from "lucide-react";

/**
 * 🆕 NEW LICENSE MANAGEMENT PAGE
 *
 * Implements the client-driven licensing model:
 * - Company owns a pool of licenses
 * - Each user gets exactly ONE license instance assigned
 * - Admins can purchase, assign, and manage licenses
 */
export default function NewLicenseManagementPage() {
  return (
    <div className="container mx-auto p-4 sm:p-4 lg:p-8 space-y-3">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            License Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your organization's license pool and user assignments
          </p>
        </div>
      </div>

      {/* Info Card - Explaining the New Model */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
            <Package className="h-5 w-5" />
            Pool-Based Licensing Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-3 p-3 bg-white/60 rounded-sm">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold">License Pool</div>
                <div className="text-xs text-gray-700">
                  Purchase licenses in bulk - they're added to your inventory as
                  individual units
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/60 rounded-sm">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold">User Assignment</div>
                <div className="text-xs text-gray-700">
                  Each user can have 0 or 1 license assigned. Users without
                  licenses can't access premium features
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/60 rounded-sm">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold">Dynamic Management</div>
                <div className="text-xs text-gray-700">
                  Easily assign, change, or remove licenses from users as needed
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="inventory" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            License Inventory
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-3">
          <LicenseInventory />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-3">
          <UserLicenseAssignment />
        </TabsContent>
      </Tabs>

      {/* Quick Guide */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Quick Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-900">Step 1:</span>
            <span>
              Purchase licenses in bulk from the "License Inventory" tab
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-900">Step 2:</span>
            <span>
              Go to "User Assignments" and assign licenses to your team members
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-900">Step 3:</span>
            <span>
              Users can only access features based on their assigned license
              type
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-900">Note:</span>
            <span>
              You can change or remove licenses at any time - unused licenses
              return to the pool
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
