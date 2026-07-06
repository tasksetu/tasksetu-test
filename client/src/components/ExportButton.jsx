import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useShowToast } from "@/utils/ToastMessage";

/**
 * Export Button Component
 * Provides CSV, Excel, and PDF export options for reports
 * 
 * @param {string} reportType - Type of report: 'productivity', 'team', 'organization'
 * @param {object} filters - Optional filters to apply { dateRange, status, priority }
 * @param {string} buttonText - Text to display on button (default: "Export Report")
 * @param {string} variant - Button variant (default: "outline")
 */
const ExportButton = ({
  reportType = 'productivity',
  filters = {},
  buttonText = 'Export Report',
  variant = 'outline',
  disabled = false
}) => {
  const { showSuccessToast, showErrorToast } = useShowToast();

  const handleExport = async (format) => {
    if (disabled) return;
    try {
      const params = new URLSearchParams({
        reportType,
        format,
        dateRange: filters.dateRange || '30',
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.priority && filters.priority !== 'all' && { priority: filters.priority }),
      });

      const response = await fetch(`/api/reports/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const formatExtension = format === 'excel' ? 'xlsx' : format;
      let filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.${formatExtension}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success toast
      const formatName = format === 'excel' ? 'Excel' : format.toUpperCase();
      showSuccessToast(`Report exported`);
    } catch (error) {
      console.error('Export error:', error);
      showErrorToast('Unable to export report');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          {buttonText}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportButton;
