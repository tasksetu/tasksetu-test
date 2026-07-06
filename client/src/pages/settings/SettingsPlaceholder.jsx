import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, ArrowLeft, Calendar, CheckCircle } from "lucide-react";

export default function SettingsPlaceholder({
  title,
  description,
  icon: Icon,
}) {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href="/settings/user-management">
          <Button
            variant="ghost"
            className="mb-3 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to User Management
          </Button>
        </Link>
        <div className="border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-lg text-gray-600 mt-2">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feature Card */}
        <div className="lg:col-span-2">
          <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="text-center pb-8">
              <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-3 shadow-sm">
                <Sparkles className="h-10 w-10 text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Feature in Development
              </CardTitle>
              <CardDescription className="text-base text-gray-600 max-w-md mx-auto">
                This powerful feature is being carefully crafted to enhance your
                workflow and productivity.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3 text-gray-700">
                {Icon && <Icon className="h-5 w-5 text-blue-600" />}
                <span className="font-medium">{title}</span>
              </div>

              <div className="bg-white rounded-sm p-4 border border-blue-100">
                <h3 className="font-semibold text-gray-900 mb-3">
                  What to expect:
                </h3>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">
                      Intuitive interface designed for efficiency
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">
                      Seamless integration with existing workflows
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">
                      Advanced customization options
                    </span>
                  </div>
                </div>
              </div>

              <Link href="/settings/user-management">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2">
                  Explore User Management
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Side Information */}
        <div className="space-y-3">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
                Development Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-medium text-purple-600">
                    In Development
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full w-3/4 transition-all duration-300"></div>
                </div>
                <p className="text-xs text-gray-500">
                  Our team is actively working on this feature to ensure it
                  meets our high standards.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Available Now</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/settings/user-management" className="block">
                <div className="p-3 rounded-sm border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                  <div className="font-medium text-gray-900">
                    User Management
                  </div>
                  <div className="text-sm text-gray-600">
                    Manage team members and permissions
                  </div>
                </div>
              </Link>
              <Link href="/settings/general" className="block">
                <div className="p-3 rounded-sm border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                  <div className="font-medium text-gray-900">
                    General Settings
                  </div>
                  <div className="text-sm text-gray-600">
                    Organization information
                  </div>
                </div>
              </Link>
              <Link href="/settings/roles" className="block">
                <div className="p-3 rounded-sm border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                  <div className="font-medium text-gray-900">
                    Roles & Permissions
                  </div>
                  <div className="text-sm text-gray-600">
                    Configure access control
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
