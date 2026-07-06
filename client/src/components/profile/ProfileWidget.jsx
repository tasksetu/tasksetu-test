import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Edit3, Mail, Phone, MapPin, Calendar } from "lucide-react";
import ProfileUpdateModal from "./ProfileUpdateModal";
import { getInitials } from "../../lib/utils";

export default function ProfileWidget({ variant = "card" }) {
  const [showEditModal, setShowEditModal] = useState(false);

  // Fetch current user profile
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["/api/profile"],
  });

  const getDisplayName = (profile) => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    return profile?.email?.split('@')[0] || 'User';
  };


  const getRoleDisplayName = (role) => {
    const roleMap = {
      'superadmin': 'Super Admin',
      'org_admin': 'Organization Admin',
      'admin': 'Admin',
      'employee': 'Employee',
      'member': 'Member',
      'individual': 'Individual'
    };
    return roleMap[role] || role;
  };

  const getRoleBadgeVariant = (role) => {
    const variantMap = {
      'superadmin': 'destructive',
      'org_admin': 'default',
      'admin': 'secondary',
      'employee': 'outline',
      'member': 'outline',
      'individual': 'outline'
    };
    return variantMap[role] || 'outline';
  };

  if (isLoading) {
    return (
      <Card className={variant === "compact" ? "w-full" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardHeader>
        {variant !== "compact" && (
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-8 w-24 mt-4" />
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={variant === "compact" ? "w-full" : ""}>
        <CardContent className="flex items-center justify-center py-6">
          <div className="text-center">
            <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load profile</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <Card className="w-full">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={profile?.profileImageUrl}
                  alt={getDisplayName(profile)}
                />
                <AvatarFallback>{getInitials(profile.firstName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate" title={getDisplayName(profile)}>
                  {getDisplayName(profile)}
                </h3>
                <p className="text-xs text-muted-foreground truncate" title={profile?.email}>
                  {profile?.email}
                </p>
                <Badge variant={getRoleBadgeVariant(profile?.role)} className="text-xs mt-1">
                  {getRoleDisplayName(profile?.role)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="flex-shrink-0"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <ProfileUpdateModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      </>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Profile Information</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="cursor-pointer"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Profile Header */}
          <div className="flex items-center space-x-3">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={profile?.profileImageUrl}
                alt={getDisplayName(profile)}
              />
              <AvatarFallback className="text-lg">
                {getInitials(profile)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">
                {getDisplayName(profile)}
              </h3>
              <Badge variant={getRoleBadgeVariant(profile?.role)}>
                {getRoleDisplayName(profile?.role)}
              </Badge>
            </div>
          </div>

          {/* Profile Details */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{profile?.email}</span>
            </div>

            {profile?.phone && (
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.phone}</span>
              </div>
            )}

            {profile?.createdAt && (
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">About</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Status */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Account Status</span>
              <Badge variant={profile?.status === 'active' ? 'default' : 'secondary'}>
                {profile?.status === 'active' ? 'Active' : profile?.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProfileUpdateModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />
    </>
  );
}