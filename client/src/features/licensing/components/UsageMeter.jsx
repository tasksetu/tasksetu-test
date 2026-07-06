import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * UsageMeter - Progress bar for usage meters that turn red when exceeding limits
 */
export default function UsageMeter({ 
  label, 
  current, 
  limit, 
  percentage, 
  isOverLimit, 
  isNearLimit,
  unit = '',
  tooltip,
  className 
}) {
  const getProgressColor = () => {
    if (isOverLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (isOverLimit) return 'text-red-600';
    if (isNearLimit) return 'text-yellow-600';
    return 'text-green-600';
  };

  const displayPercentage = Math.min(percentage, 100); // Cap visual percentage at 100%
  const actualPercentage = Math.round(percentage);

  return (
    <div className={cn('space-y-2', className)} data-testid={`usage-meter-${label.toLowerCase().replace(' ', '-')}`}>
      {/* Header with label, tooltip, and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-500 hover:text-gray-700" data-testid={`tooltip-${label.toLowerCase().replace(' ', '-')}`} />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isOverLimit && (
            <Badge variant="destructive" className="text-xs" data-testid="status-overlimit">
              <AlertCircle className="h-3 w-3 mr-1" />
              Over Limit
            </Badge>
          )}
          {isNearLimit && !isOverLimit && (
            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800" data-testid="status-nearlimit">
              <AlertCircle className="h-3 w-3 mr-1" />
              Near Limit
            </Badge>
          )}
        </div>
        
        {/* Usage display */}
        <div className={cn('text-sm font-medium', getTextColor())} data-testid={`usage-display-${label.toLowerCase().replace(' ', '-')}`}>
          {limit === 'Unlimited' ? (
            <span>Unlimited</span>
          ) : (
            <span>
              {current}{unit} / {limit}{unit}
              <span className="ml-1 text-xs text-gray-500">({actualPercentage}%)</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {limit !== 'Unlimited' && (
        <div className="relative">
          <Progress 
            value={displayPercentage} 
            className={cn(
              'h-2 transition-colors duration-300',
              isOverLimit && 'bg-red-50',
              isNearLimit && !isOverLimit && 'bg-yellow-50'
            )}
            data-testid={`progress-bar-${label.toLowerCase().replace(' ', '-')}`}
          />
          {/* Custom progress bar color */}
          <div 
            className={cn(
              'absolute top-0 left-0 h-full rounded-full transition-all duration-300',
              getProgressColor()
            )}
            style={{ width: `${displayPercentage}%` }}
          />
          
          {/* Over-limit indicator */}
          {isOverLimit && (
            <div className="absolute -top-1 -right-1">
              <div className="animate-pulse bg-red-500 rounded-full h-3 w-3" />
            </div>
          )}
        </div>
      )}
      
      {/* Status message for over-limit */}
      {isOverLimit && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200" data-testid="overlimit-message">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          You've exceeded your {label.toLowerCase()} limit. Upgrade your plan to continue.
        </div>
      )}
    </div>
  );
}