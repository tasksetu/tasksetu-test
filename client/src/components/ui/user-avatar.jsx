import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { getInitials } from "../../lib/utils";

/**
 * UserAvatar Component
 *
 * A specialized avatar component for user profile images with built-in:
 * - Cache busting for fresh image loading
 * - Automatic fallback to initials when image fails
 * - Consistent avatar rendering across the application
 *
 * @param {Object} user - User object containing profile information
 * @param {string} user.profileImageUrl - URL to user's profile image
 * @param {string} user.firstName - User's first name
 * @param {string} user.lastName - User's last name
 * @param {string} user.email - User's email (fallback for initials)
 * @param {string} className - Additional CSS classes for the Avatar component
 * @param {string} size - Size preset: 'xs', 'sm', 'md', 'lg', 'xl'
 */
export function UserAvatar({ user, className = "", size = "md", ...props }) {
 

  const getSizeClasses = () => {
    const sizeMap = {
      xs: "h-4 w-4",
      sm: "h-6 w-6",
      md: "h-8 w-8",
      lg: "h-10 w-10",
      xl: "h-12 w-12",
    };
    return sizeMap[size] || sizeMap.md;
  };

  const getFontSizeClass = () => {
    const fontMap = {
      xs: "text-xs",
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
      xl: "text-lg",
    };
    return fontMap[size] || fontMap.md;
  };

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email?.split("@")[0] || "User";
  };

  // Generate cache-busting URL for profile images - prioritize image over initials
  const getImageUrl = () => {
    if (!user?.profileImageUrl) return null;

    // If it's a blob URL (preview), return as-is
    if (user.profileImageUrl.startsWith('blob:')) {
      return user.profileImageUrl;
    }

    // Prepend /uploads/ if it's a relative R2 path (not starting with http or /uploads)
    let url = user.profileImageUrl;
    if (!url.startsWith("http") && !url.startsWith("/uploads") && !url.startsWith("data:")) {
      url = `/uploads/${url.replace(/^\/+/, "")}`;
    }

    // Use cache busting for server URLs
    const cacheTime = Math.floor(Date.now() / (60 * 1000)); // Updates every minute
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${cacheTime}`;
  };

  const imageUrl = getImageUrl();

  // Debug avatar rendering
  if (process.env.NODE_ENV === "development") {
    console.log("UserAvatar Debug:", {
      hasUser: !!user,
      profileImageUrl: user?.profileImageUrl,
      imageUrl: imageUrl,
      firstName: user?.firstName,
      lastName: user?.lastName,
      initials: getInitials(user?.firstName, user?.lastName, user?.email),
    });
  }

  return (
    <Avatar className={`${getSizeClasses()} ${className}`} {...props}>
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt={getDisplayName()}
          onError={(e) => {
            // If profile image fails to load, hide the img element to show fallback
            console.log(
              "Profile image failed to load, showing initials:",
              imageUrl,
            );
            e.currentTarget.style.display = "none";
          }}
          onLoad={() => {
            console.log("Profile image loaded successfully:", imageUrl);
          }}
        />
      ) : null}
      <AvatarFallback
        className={`bg-blue-600 text-white ${getFontSizeClass()} font-semibold`}
      >
        {getInitials(user?.firstName, user?.lastName, user?.email)}
      </AvatarFallback>
    </Avatar>
  );
}

export default UserAvatar;
