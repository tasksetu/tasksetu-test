import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building, Globe, MapPin, Phone, Mail, Clock } from "lucide-react";

export default function GeneralSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: organization, isLoading } = useQuery({
    queryKey: ["/api/organization/settings"],
    enabled: true,
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website: "",
    industry: "",
    size: "",
    address: "",
    city: "",
    country: "",
    timezone: "",
    phone: "",
    email: "",
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => apiRequest("PUT", "/api/organization/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/settings"],
      });
      toast({
        title: "Success",
        description: "Organization settings updated successfully",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateSettingsMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">General Settings</h1>
        <p className="text-lg text-gray-600 mt-2">
          Configure your organization's basic information and regional
          preferences
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Organization Information */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 rounded-sm">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              Organization Information
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Configure your organization's basic details and public information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-7">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Your Organization Name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <div className="relative mt-1">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) =>
                      handleInputChange("website", e.target.value)
                    }
                    placeholder="https://yourcompany.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Brief description of your organization"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Select
                  onValueChange={(value) =>
                    handleInputChange("industry", value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="size">Organization Size</Label>
                <Select
                  onValueChange={(value) => handleInputChange("size", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="501+">501+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-green-100 rounded-sm">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              Contact Information
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Configure how people can reach your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-7">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">Contact Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="contact@yourcompany.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="123 Business St, Suite 100"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="San Francisco"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  onValueChange={(value) => handleInputChange("country", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="ca">Canada</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="au">Australia</SelectItem>
                    <SelectItem value="de">Germany</SelectItem>
                    <SelectItem value="fr">France</SelectItem>
                    <SelectItem value="in">India</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-purple-100 rounded-sm">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              Regional Settings
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Configure timezone and regional preferences for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="p-7">
            <div className="space-y-3">
              <Label
                htmlFor="timezone"
                className="text-base font-medium text-gray-700"
              >
                Timezone
              </Label>
              <Select
                onValueChange={(value) => handleInputChange("timezone", value)}
              >
                <SelectTrigger className="h-9 text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                  <SelectValue placeholder="Select your organization's timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">
                    Eastern Time (ET) - New York
                  </SelectItem>
                  <SelectItem value="America/Chicago">
                    Central Time (CT) - Chicago
                  </SelectItem>
                  <SelectItem value="America/Denver">
                    Mountain Time (MT) - Denver
                  </SelectItem>
                  <SelectItem value="America/Los_Angeles">
                    Pacific Time (PT) - Los Angeles
                  </SelectItem>
                  <SelectItem value="Europe/London">
                    Greenwich Mean Time (GMT) - London
                  </SelectItem>
                  <SelectItem value="Europe/Paris">
                    Central European Time (CET) - Paris
                  </SelectItem>
                  <SelectItem value="Asia/Tokyo">
                    Japan Standard Time (JST) - Tokyo
                  </SelectItem>
                  <SelectItem value="Asia/Kolkata">
                    India Standard Time (IST) - Mumbai
                  </SelectItem>
                  <SelectItem value="Australia/Sydney">
                    Australian Eastern Time (AEST) - Sydney
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                This timezone will be used for scheduling and time-based
                features across your organization.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="border-t border-gray-200 pt-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Changes are automatically saved when you submit the form
            </div>
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base font-medium h-12"
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving Changes...
                </>
              ) : (
                "Save All Changes"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
