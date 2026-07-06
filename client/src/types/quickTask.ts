// Quick Task Model/Types
export interface QuickTask {
  id: string;
  title: string;
  createdBy: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  status: 'open' | 'done' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  conversionFlag?: {
    isConverted: boolean;
    convertedToTaskId?: string;
    convertedToTaskType?: 'regular' | 'recurring' | 'milestone' | 'approval';
    convertedAt?: Date;
  };
}

export interface QuickTaskInput {
  title: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
}

export interface ConvertToTaskInput {
  quickTaskId: string;
  taskType: 'regular' | 'recurring' | 'milestone' | 'approval';
  additionalData?: any;
}