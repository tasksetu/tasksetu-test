import React from "react";
import { cn } from "../../lib/utils";
import { ImageOff } from "lucide-react";

export interface CloudflareImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  path: string | null | undefined;
  fallbackClassName?: string;
}

export function CloudflareImage({
  path,
  alt = "",
  className,
  fallbackClassName,
  ...props
}: CloudflareImageProps) {
  if (!path) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-md",
          fallbackClassName || className
        )}
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  let src = path;
  if (!path.startsWith("http") && !path.startsWith("/uploads") && !path.startsWith("data:")) {
    src = `/uploads/${path.replace(/^\/+/, "")}`;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const parent = e.currentTarget.parentElement;
        if (parent) {
          const fallbackDiv = document.createElement("div");
          fallbackDiv.className = cn(
            "flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-md w-full h-full min-h-[50px]",
            fallbackClassName || className
          );
          fallbackDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off h-5 w-5"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="10" x2="21" y1="14" y2="3"/><path d="M3.5 21h17"/><path d="M21 16V5a2 2 0 0 0-2-2H9"/></svg>`;
          parent.appendChild(fallbackDiv);
        }
      }}
      {...props}
    />
  );
}
