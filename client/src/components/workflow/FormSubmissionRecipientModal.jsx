/**
 * FormSubmissionRecipientModal — Bulk Recipient Import from Form Responses
 *
 * Allows users to select a Form, view all respondents who submitted responses,
 * toggle individual checkboxes or "Select All", and bulk-import recipients into Email Task.
 */

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  CheckSquare,
  Square,
  Download,
  Loader2,
  FileText,
  AlertCircle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "../../utils/apiClient";

export default function FormSubmissionRecipientModal({
  isOpen,
  onClose,
  onImportRecipients,
  forms = [],
}) {
  const [selectedFormId, setSelectedFormId] = useState("");
  const [recipientsList, setRecipientsList] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-select first form if available
  useEffect(() => {
    if (forms.length > 0 && !selectedFormId) {
      const firstId = forms[0]._id || forms[0].form_id || forms[0].id;
      if (firstId) {
        setSelectedFormId(firstId);
      }
    }
  }, [forms, selectedFormId]);

  // Fetch recipients when selectedFormId changes
  useEffect(() => {
    if (isOpen && selectedFormId) {
      fetchFormRecipients(selectedFormId);
    } else if (!selectedFormId) {
      setRecipientsList([]);
      setSelectedEmails(new Set());
    }
  }, [selectedFormId, isOpen]);

  const fetchFormRecipients = async (formId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `/api/workflow/forms/${formId}/submissions-recipients`,
      );
      if (res.data?.success) {
        const list = res.data.data || [];
        setRecipientsList(list);
        // By default, select all recipients
        setSelectedEmails(new Set(list.map((r) => r.email)));
      } else {
        setError("Failed to load recipients for this form.");
      }
    } catch (err) {
      console.error("Error fetching form recipients:", err);
      setError(err.response?.data?.message || "Failed to load form responses.");
      setRecipientsList([]);
      setSelectedEmails(new Set());
    } finally {
      setLoading(false);
    }
  };

  // Filter list by search query
  const filteredRecipients = recipientsList.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Toggle individual row checkbox
  const toggleRecipient = (email) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  // Master Select All / Deselect All
  const isAllSelected =
    filteredRecipients.length > 0 &&
    filteredRecipients.every((r) => selectedEmails.has(r.email));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all filtered
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        filteredRecipients.forEach((r) => next.delete(r.email));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        filteredRecipients.forEach((r) => next.add(r.email));
        return next;
      });
    }
  };

  // Confirm import
  const handleImport = () => {
    const selectedList = recipientsList
      .filter((r) => selectedEmails.has(r.email))
      .map((r) => ({
        name: r.name,
        email: r.email,
        source: "form_submission",
        variables: r.variables || {},
      }));

    if (onImportRecipients) {
      onImportRecipients(selectedList);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col bg-white border border-gray-200 shadow-xl p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Import Recipients from Form Submissions
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 mt-0.5">
              Select a form to load respondents and bulk-add them to your Email Subtask.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Form Selector Dropdown */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Select Form Template
            </label>
            <div className="relative">
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-2 focus:border-blue-500 font-medium text-gray-800"
              >
                <option value="">— Choose a Form Template —</option>
                {forms.map((f) => {
                  const id = f._id || f.form_id || f.id;
                  const title = f.title || f.form_title || "Untitled Form";
                  return (
                    <option key={id} value={id}>
                      {title} {f.form_code ? `(${f.form_code})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Search & Bulk Toggle Controls */}
          {selectedFormId && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter respondents by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={loading || recipientsList.length === 0}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1.5 shrink-0"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {isAllSelected ? "Deselect All" : "Select All Visible"}
              </button>
            </div>
          )}

          {/* Respondent Table */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-500 text-sm gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              Loading form respondents...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500 text-xs flex items-center justify-center gap-1.5 bg-red-50 rounded-lg p-3 border border-red-100">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ) : !selectedFormId ? (
            <div className="py-10 text-center text-gray-400 text-xs italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Please select a form template above to view respondents.
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-xs italic bg-gray-50 rounded-lg border border-gray-200">
              No form responses found for this template.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Email Address</th>
                    <th className="p-2.5 text-right">Submission Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRecipients.map((r) => {
                    const isChecked = selectedEmails.has(r.email);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => toggleRecipient(r.email)}
                        className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                          isChecked ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRecipient(r.email)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 font-medium text-gray-900">{r.name}</td>
                        <td className="p-2.5 text-gray-600 font-mono">{r.email}</td>
                        <td className="p-2.5 text-right text-gray-400 text-[11px]">
                          {new Date(r.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500 font-medium">
            Selected: <strong className="text-blue-700">{selectedEmails.size}</strong> of {recipientsList.length} respondents
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedEmails.size === 0}
              onClick={handleImport}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Import Selected ({selectedEmails.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
