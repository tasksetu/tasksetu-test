import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Input Component - Design System
 * Height: h-9 (36px) - Matches button height for alignment
 */
const Input = React.forwardRef(
  ({ className, type, endAdornment, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
            endAdornment && "pr-10",
            className
          )}
          ref={ref}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {endAdornment}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }
