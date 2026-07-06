import React from 'react';
import QuickTaskWidget from '@/components/tasks/QuickTaskWidget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Lightbulb, ArrowRight } from 'lucide-react';

export default function QuickTaskPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                My Quick Tasks
              </h1>
              <p className="text-gray-600 mt-1">
                Personal to-do list for quick capture and tracking
              </p>
            </div>
          </div>
        </div>

        {/* Quick Task Widget */}
        <QuickTaskWidget />

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <span>Quick Task Tips</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">✨ Best Practices:</p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Keep titles short and actionable</li>
                  <li>• Use high priority for urgent items</li>
                  <li>• Set realistic due dates</li>
                  <li>• Convert to full tasks when needed</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ArrowRight className="h-5 w-5 text-blue-500" />
                <span>Convert to Full Task</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">When to convert:</p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Task needs assignees or collaboration</li>
                  <li>• Requires detailed description or attachments</li>
                  <li>• Needs approval workflow</li>
                  <li>• Should be recurring or milestone</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}