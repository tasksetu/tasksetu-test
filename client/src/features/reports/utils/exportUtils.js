import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Export Utilities for Reports
 * Supports PDF, Excel, and CSV formats
 */

/**
 * Export data to PDF format
 * @param {Object} params - Export parameters
 * @param {string} params.title - Report title
 * @param {Array} params.data - Data to export
 * @param {Array} params.columns - Column definitions [{header: 'Name', key: 'name'}]
 * @param {Object} params.summary - Optional summary statistics
 * @param {string} params.filename - Output filename without extension
 */
export const exportToPDF = ({ title, data, columns, summary, filename }) => {
  try {
    // Validate required parameters
    if (!data || !Array.isArray(data)) {
      console.error('Export PDF: data is required and must be an array');
      return { success: false, error: 'Invalid data' };
    }
    if (!columns || !Array.isArray(columns)) {
      console.error('Export PDF: columns is required and must be an array');
      return { success: false, error: 'Invalid columns' };
    }
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const sanitizedFilename = sanitizeFilename(filename || 'report');
    
    // Add title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(title, pageWidth / 2, 20, { align: 'center' });
    
    // Add date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth / 2, 28, { align: 'center' });
    
    let yPosition = 35;
    
    // Add summary if provided
    if (summary && Object.keys(summary).length > 0) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Summary', 14, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      Object.entries(summary).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 14, yPosition);
        yPosition += 6;
      });
      yPosition += 5;
    }
    
    // Prepare table data
    const tableHeaders = columns.map(col => col.header);
    const tableData = data.map(row => 
      columns.map(col => {
        const value = row[col.key];
        return value !== null && value !== undefined ? String(value) : '-';
      })
    );
    
    // Add table
    autoTable(doc, {
      startY: yPosition,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      styles: { 
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: { 
        fillColor: [66, 139, 202],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
    
    // Save PDF
    doc.save(`${sanitizedFilename}.pdf`);
    return { success: true };
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    return { success: false, error: error.message };
  }
};

const sanitizeFilename = (name) => {
  return String(name || 'report')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') // Windows-illegal chars
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
};

/**
 * Export multi-section PDF report (multiple tables across pages).
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {Array} params.sections - [{ title, summary?, tables: [{ title, columns, data }] }]
 * @param {string} params.filename
 */
export const exportToPDFSections = ({ title, sections, filename }) => {
  try {
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      console.error('Export PDF Sections: sections is required and must be a non-empty array');
      return { success: false, error: 'Invalid sections' };
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftMargin = 14;
    const rightMargin = 14;
    const bottomMargin = 14;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      pageWidth / 2,
      28,
      { align: 'center' }
    );

    let y = 38;

    const ensureSpace = (needed = 10) => {
      if (y + needed > pageHeight - bottomMargin) {
        doc.addPage();
        y = 18;
      }
    };

    sections.forEach((section, sectionIdx) => {
      if (!section) return;
      const sectionTitle = section.title || `Section ${sectionIdx + 1}`;

      // Section header
      ensureSpace(18);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(sectionTitle, leftMargin, y);
      y += 10;

      // Summary block
      if (section.summary && Object.keys(section.summary).length > 0) {
        ensureSpace(10);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        Object.entries(section.summary).forEach(([k, v]) => {
          ensureSpace(8);
          const line = `${k}: ${v !== null && v !== undefined ? String(v) : '-'}`;
          doc.text(line, leftMargin, y, { maxWidth: pageWidth - leftMargin - rightMargin });
          y += 6;
        });
        y += 4;
      }

      const tables = Array.isArray(section.tables) ? section.tables : [];
      tables.forEach((tbl, tblIdx) => {
        if (!tbl || !Array.isArray(tbl.columns) || !Array.isArray(tbl.data)) return;

        const tableTitle = tbl.title || `Table ${tblIdx + 1}`;
        const columns = tbl.columns;
        const data = tbl.data;

        // Table title
        ensureSpace(14);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(tableTitle, leftMargin, y);
        y += 6;

        const tableHeaders = columns.map(col => col.header);
        const tableData = data.map(row =>
          columns.map(col => {
            const value = row[col.key];
            return value !== null && value !== undefined ? String(value) : '-';
          })
        );

        autoTable(doc, {
          startY: y,
          head: [tableHeaders],
          body: tableData,
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          headStyles: {
            fillColor: [66, 139, 202],
            fontStyle: 'bold'
          },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: leftMargin, right: rightMargin }
        });

        // Update y to after table (with padding)
        y = (doc.lastAutoTable?.finalY || y) + 10;
      });

      // Spacer between sections
      y += 6;
    });

    const outName = sanitizeFilename(filename || title || 'report');
    doc.save(`${outName}.pdf`);
    return { success: true };
  } catch (error) {
    console.error('Error exporting multi-section PDF:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Export data to Excel format
 * @param {Object} params - Export parameters
 * @param {string} params.title - Report title
 * @param {Array} params.data - Data to export
 * @param {Array} params.columns - Column definitions
 * @param {Object} params.summary - Optional summary statistics
 * @param {string} params.filename - Output filename without extension
 */
export const exportToExcel = ({ title, data, columns, summary, filename }) => {
  try {
    // Validate required parameters
    if (!data || !Array.isArray(data)) {
      console.error('Export Excel: data is required and must be an array');
      return { success: false, error: 'Invalid data' };
    }
    if (!columns || !Array.isArray(columns)) {
      console.error('Export Excel: columns is required and must be an array');
      return { success: false, error: 'Invalid columns' };
    }
    
    const sanitizedFilename = sanitizeFilename(filename || 'report');
    const workbook = XLSX.utils.book_new();
    
    // Prepare data with headers
    const headers = columns.map(col => col.header);
    const rows = data.map(row => 
      columns.map(col => row[col.key] ?? '-')
    );
    
    // Create worksheet data
    const worksheetData = [];
    
    // Add title row
    worksheetData.push([title]);
    worksheetData.push([`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);
    worksheetData.push([]); // Empty row
    
    // Add summary if provided
    if (summary && Object.keys(summary).length > 0) {
      worksheetData.push(['Summary']);
      Object.entries(summary).forEach(([key, value]) => {
        worksheetData.push([key, value]);
      });
      worksheetData.push([]); // Empty row
    }
    
    // Add headers and data
    worksheetData.push(headers);
    worksheetData.push(...rows);
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    const maxWidths = columns.map((col, idx) => {
      const headerLen = col.header.length;
      const dataLen = Math.max(...rows.map(row => String(row[idx] || '').length));
      return Math.max(headerLen, dataLen, 10);
    });
    worksheet['!cols'] = maxWidths.map(w => ({ wch: w + 2 }));
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    
    // Save file
    XLSX.writeFile(workbook, `${sanitizedFilename}.xlsx`);
    return { success: true };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Export data to CSV format
 * @param {Object} params - Export parameters
 * @param {string} params.title - Report title
 * @param {Array} params.data - Data to export
 * @param {Array} params.columns - Column definitions
 * @param {Object} params.summary - Optional summary statistics
 * @param {string} params.filename - Output filename without extension
 */
export const exportToCSV = ({ title, data, columns, summary, filename }) => {
  try {
    // Validate required parameters
    if (!data || !Array.isArray(data)) {
      console.error('Export CSV: data is required and must be an array');
      return { success: false, error: 'Invalid data' };
    }
    if (!columns || !Array.isArray(columns)) {
      console.error('Export CSV: columns is required and must be an array');
      return { success: false, error: 'Invalid columns' };
    }
    
    const sanitizedFilename = sanitizeFilename(filename || 'report');
    let csvContent = '';
    
    // Add title
    csvContent += `"${title}"\n`;
    csvContent += `"Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}"\n`;
    csvContent += '\n';
    
    // Add summary if provided
    if (summary && Object.keys(summary).length > 0) {
      csvContent += '"Summary"\n';
      Object.entries(summary).forEach(([key, value]) => {
        csvContent += `"${key}","${value}"\n`;
      });
      csvContent += '\n';
    }
    
    // Add headers
    csvContent += columns.map(col => `"${col.header}"`).join(',') + '\n';
    
    // Add data rows
    data.forEach(row => {
      const rowData = columns.map(col => {
        const value = row[col.key];
        // Escape quotes and wrap in quotes
        const stringValue = value !== null && value !== undefined ? String(value) : '-';
        return `"${stringValue.replace(/"/g, '""')}"`;
      });
      csvContent += rowData.join(',') + '\n';
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${sanitizedFilename}.csv`);
    link.style.visibility = 'hidden';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    
    // Use setTimeout to ensure click happens
    setTimeout(() => {
      link.click();
      // Cleanup after a small delay
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    }, 10);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generic export function that handles all formats
 * @param {string} format - 'pdf' | 'excel' | 'csv'
 * @param {string|Object} titleOrParams - Title string or params object
 * @param {Array} data - Data array (if titleOrParams is string)
 * @param {Array} columns - Column definitions (if titleOrParams is string)
 * @param {Object} summary - Summary object (if titleOrParams is string)
 * @param {string} filename - Filename without extension (if titleOrParams is string)
 */
export const exportReport = (format, titleOrParams, data, columns, summary, filename) => {
  // Support both calling patterns:
  // 1. exportReport(format, { title, data, columns, summary, filename, sections })
  // 2. exportReport(format, title, data, columns, summary, filename)
  
  let params;
  if (typeof titleOrParams === 'object' && titleOrParams !== null && !Array.isArray(titleOrParams)) {
    // First pattern: params object
    params = titleOrParams;
  } else {
    // Second pattern: individual parameters
    params = {
      title: titleOrParams,
      data: data,
      columns: columns,
      summary: summary,
      filename: filename
    };
  }
  
  // Ensure filename is always provided
  if (!params.filename) {
    params.filename = `report-${new Date().toISOString().slice(0, 10)}`;
  }
  
  switch (format.toLowerCase()) {
    case 'pdf':
      // Support multi-section PDFs via params.sections
      if (params && Array.isArray(params.sections) && params.sections.length > 0) {
        return exportToPDFSections(params);
      }
      return exportToPDF(params);
    case 'excel':
    case 'xlsx':
      return exportToExcel(params);
    case 'csv':
      return exportToCSV(params);
    default:
      console.error('Unsupported export format:', format);
      return { success: false, error: 'Unsupported format' };
  }
};
