// src/components/icons/CustomIcons.jsx
import React from "react";
import { File, Clock, ClipboardCheck, Target, Zap, Trash2 } from "lucide-react";
// Trash Task icon
export const TrashTaskIcon = ({ size, color, strokeWidth, className, ...rest }) => (
  <Trash2
    size={size ?? defaultProps.size}
    color={color ?? defaultProps.color}
    strokeWidth={strokeWidth ?? defaultProps.strokeWidth}
    className={className}
    {...rest}
  />
);

/**
 * Common props:
 *  - size (number)       : icon size in px
 *  - color (string)      : stroke color or CSS color
 *  - strokeWidth (number): icon stroke width (default lucide is 1.5/2)
 *  - className (string)  : additional classes
 *  - ...rest             : other props forwarded to icon
 *
 * Note: lucide-react icons accept size and color props directly.
 */

const defaultProps = {
  size: 18,
  color: "currentColor",
  strokeWidth: 1.5,
};

export const RegularTaskIcon = ({
  size,
  color,
  strokeWidth,
  className,
  ...rest
}) => (
  <File
    size={size ?? defaultProps.size}
    color={color ?? defaultProps.color}
    strokeWidth={strokeWidth ?? defaultProps.strokeWidth}
    className={className}
    {...rest}
  />
);

export const RecurringTaskIcon = ({
  size,
  color,
  strokeWidth,
  className,
  ...rest
}) => (
  <Clock
    size={size ?? defaultProps.size}
    color={color ?? defaultProps.color}
    strokeWidth={strokeWidth ?? defaultProps.strokeWidth}
    className={className}
    {...rest}
  />
);

export const MilestoneTaskIcon = ({ size, color, strokeWidth, className, ...rest }) => (
  <Target
    size={size ?? defaultProps.size}
    color={color ?? defaultProps.color}
    strokeWidth={strokeWidth ?? defaultProps.strokeWidth}
    className={className}
    {...rest}
  />
);

export const ApprovalTaskIcon = ({ size, color, strokeWidth, className, ...rest }) => (
  <ClipboardCheck
    size={size ?? defaultProps.size}
    color={color ?? defaultProps.color}
    strokeWidth={strokeWidth ?? defaultProps.strokeWidth}
    className={className}
    {...rest}
  />
);
// new QuickTask icon
export const QuickTaskIcon = ({
  size,
  color,
  strokeWidth,
  className,
  ...rest
}) => (
  <Zap
    size={size ?? defaultProps.size}
    color={color ?? defaultProps.color}
    strokeWidth={strokeWidth ?? defaultProps.strokeWidth}
    className={className}
    {...rest}
  />
);
/**
 * Convenience map if you want to look up icons dynamically:
 * e.g. const Icon = ICON_MAP['file']; <Icon size={20} color="purple" />
 */
export const ICON_MAP = {
  file: RegularTaskIcon,
  clock: RecurringTaskIcon,
  approval: MilestoneTaskIcon,
  milestone: ApprovalTaskIcon,
  quick: QuickTaskIcon,
  trash: TrashTaskIcon,
};

export default {
  RegularTaskIcon,
  RecurringTaskIcon,
  MilestoneTaskIcon,
  ApprovalTaskIcon,
  QuickTaskIcon,
  TrashTaskIcon,
  ICON_MAP,
};
