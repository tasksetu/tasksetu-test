/**
 * EmailTaskConfig — Phase 7 & 14 Frontend Component
 *
 * Configuration panel for Email Task type.
 * Allows setting:
 *  - Subject & HTML Body with dynamic variables ({VendorName}, etc.)
 *  - Multiple recipients (manual entry)
 *  - Attached Form (optional external public form)
 *  - Variables mapping (up to 10)
 *  - Auto-Complete configuration
 *  - Re-Send email button & Recipient status tracking table
 */

import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Plus, Trash2, Mail, RefreshCw, Paperclip, Send, CheckCircle, Clock, AlertCircle, Users, Download, Table, Columns, Info, Loader2 } from "lucide-react";
import { apiClient } from "../../utils/apiClient";
import FormSubmissionRecipientModal from "./FormSubmissionRecipientModal";
import RecipientVariableMatrixModal from "./RecipientVariableMatrixModal";

export default function EmailTaskConfig({
  value = {},
  onChange,
  disabled = false,
  taskId = null, // If provided, shows Re-Send button and Recipient Tracking table
  forms = [],    // List of availabl e form templates
  errors = {},   // Validation errors object
}) {
  const [config, setConfig] = useState({
    recipients: value?.recipients || [{ name: "", email: "", source: "manual" }],
    subject: value?.subject || "",
    body: value?.body || "",
    variables: value?.variables || [],
    attachedFormId: value?.attachedFormId || "",
    formLinkEnabled: value?.formLinkEnabled || false,
    autoComplete: value?.autoComplete || false,
    autoCompleteAfterDays: value?.autoCompleteAfterDays || 1,
  });

  const [recipientStatus, setRecipientStatus] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);

  // Sync internal state to parent when config changes
  const updateConfig = (newConfig) => {
    setConfig(newConfig);
    if (onChange) onChange(newConfig);
  };

  // Toggle enabled state of a variable via Radio Button
  const toggleVariableEnabled = (index, shouldEnable) => {
    const currentVars = [...(config.variables || [])];
    const activeCount = currentVars.filter((v) => v.enabled !== false).length;

    if (shouldEnable) {
      if (activeCount >= 10 && currentVars[index].enabled === false) {
        return; // Max 10 reached
      }
      currentVars[index] = { ...currentVars[index], enabled: true };
    } else {
      currentVars[index] = { ...currentVars[index], enabled: false };
    }
    updateConfig({ ...config, variables: currentVars });
  };

  // Note: Variables are populated when clicking "Import from Form Responses"

  const handleImportRecipients = (importedList) => {
    let currentList = (config.recipients || []).filter(
      (r) => r.name.trim() !== "" || r.email.trim() !== "",
    );

    const existingEmails = new Set(currentList.map((r) => r.email.toLowerCase()));

    // Collect all variable keys present across imported form response recipients
    const detectedVarKeys = new Set();

    const newToAdd = [];
    importedList.forEach((imp) => {
      const cleanEmail = imp.email.toLowerCase();
      if (imp.variables && typeof imp.variables === "object") {
        Object.keys(imp.variables).forEach((k) => {
          if (k && k.trim()) detectedVarKeys.add(k.trim());
        });
      }
      if (!existingEmails.has(cleanEmail)) {
        existingEmails.add(cleanEmail);
        newToAdd.push({
          name: imp.name,
          email: imp.email,
          source: "form_submission",
          variables: imp.variables || {},
        });
      }
    });

    // Auto-create template variables for all detected form response fields
    const existingVarKeysLower = new Set(
      (config.variables || []).map((v) => (v.key || "").toLowerCase().trim())
    );
    const newVars = [...(config.variables || [])];
    let currentActive = newVars.filter((v) => v.enabled !== false).length;

    detectedVarKeys.forEach((key) => {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey !== "name" && lowerKey !== "email" && !existingVarKeysLower.has(lowerKey)) {
        existingVarKeysLower.add(lowerKey);
        const shouldEnable = currentActive < 10;
        if (shouldEnable) currentActive++;
        newVars.push({ key: key.trim(), staticValue: "", enabled: shouldEnable });
      }
    });

    const updated = [...currentList, ...newToAdd];
    updateConfig({
      ...config,
      recipients: updated.length > 0 ? updated : [{ name: "", email: "", source: "manual" }],
      variables: newVars,
    });
  };


  // Fetch tracking status if taskId exists
  useEffect(() => {
    if (taskId) {
      fetchRecipientStatus();
    }
  }, [taskId]);

  const fetchRecipientStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await apiClient.get(`/api/workflow/tasks/${taskId}/recipient-status`);
      if (res.data?.success) {
        setRecipientStatus(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch recipient status", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleResend = async (mode = "pending") => {
    if (!taskId) return;
    setResending(true);
    setResendMessage("");
    try {
      const res = await apiClient.post(`/api/workflow/tasks/${taskId}/resend-email`, { mode });
      if (res.data?.success) {
        setResendMessage(res.data.message || "Emails re-sent successfully!");
        fetchRecipientStatus();
      }
    } catch (err) {
      setResendMessage(err.response?.data?.message || "Failed to re-send emails.");
    } finally {
      setResending(false);
    }
  };

  // Recipient row management
  const addRecipient = () => {
    const newRecipients = [...config.recipients, { name: "", email: "", source: "manual" }];
    updateConfig({ ...config, recipients: newRecipients });
  };

  const removeRecipient = (index) => {
    const newRecipients = config.recipients.filter((_, i) => i !== index);
    updateConfig({ ...config, recipients: newRecipients });
  };

  const updateRecipient = (index, field, val) => {
    const newRecipients = [...config.recipients];
    newRecipients[index] = { ...newRecipients[index], [field]: val };
    updateConfig({ ...config, recipients: newRecipients });
  };

  // Variable management (max 10)
  const addVariable = () => {
    if (config.variables.length >= 10) return;
    const newVars = [
      ...config.variables,
      { key: `var${config.variables.length + 1}`, label: "", mappedFrom: "static", staticValue: "" },
    ];
    updateConfig({ ...config, variables: newVars });
  };

  const removeVariable = (index) => {
    const newVars = config.variables.filter((_, i) => i !== index);
    updateConfig({ ...config, variables: newVars });
  };

  const updateVariable = (index, field, val) => {
    const newVars = [...config.variables];
    newVars[index] = { ...newVars[index], [field]: val };
    updateConfig({ ...config, variables: newVars });
  };

  return (
    <div className="space-y-5 border border-blue-200 bg-blue-50/30 rounded-lg p-4">
      <div className="flex items-center gap-2 border-b border-blue-200 pb-2">
        <Mail className="w-5 h-5 text-blue-600" />
        <h4 className="text-sm font-semibold text-gray-900">Email Task Configuration</h4>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
          Email Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={config.subject}
          onChange={(e) => updateConfig({ ...config, subject: e.target.value })}
          placeholder="e.g. Action Required: Please complete your submission"
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500 bg-white"
        />
      </div>

      {/* Recipients Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-700 uppercase">
            Recipients <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              disabled={disabled}
              className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1.5 bg-blue-100/70 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-300 transition-colors shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" /> Import from Form Responses
            </button>
            <button
              type="button"
              onClick={addRecipient}
              disabled={disabled}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Recipient
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {(config.recipients || []).map((recipient, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={recipient.name}
                onChange={(e) => updateRecipient(idx, "name", e.target.value)}
                placeholder="Name"
                disabled={disabled}
                className="w-1/3 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 bg-white"
              />
              <input
                type="email"
                value={recipient.email}
                onChange={(e) => updateRecipient(idx, "email", e.target.value)}
                placeholder="email@example.com"
                disabled={disabled}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 bg-white"
              />
              {config.recipients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  disabled={disabled}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {errors?.recipients && (
          <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.recipients}
          </p>
        )}
      </div>

      {/* Email Body */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
          Email Body / Message <span className="text-red-500">*</span>
        </label>
        <ReactQuill
          theme="snow"
          value={config.body || ""}
          onChange={(content) => updateConfig({ ...config, body: content })}
          readOnly={disabled}
          placeholder="Dear {VendorName},&#10;&#10;Please review the attached details and complete the form below."
          modules={{
            toolbar: [
              ["bold", "italic", "underline"],
              ["link"],
              [{ list: "ordered" }, { list: "bullet" }],
              ["clean"],
            ],
          }}
          className={`bg-white rounded-md ${
            errors?.body ? "border border-red-500 rounded-sm" : ""
          }`}
        />
        {errors?.body && (
          <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.body}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Use placeholders like <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600">{"{VariableName}"}</code> matching the defined variables below.
        </p>
      </div>

      {/* Variables Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-700 uppercase">
            Template Variables (Max 10)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMatrixModalOpen(true)}
              disabled={disabled}
              className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 transition-colors shadow-xs"
              title="Edit custom variable values per recipient in spreadsheet view"
            >
              <Table className="w-3.5 h-3.5 text-indigo-600" /> Edit Recipient Variables Grid
            </button>
            {config.variables.length < 10 && (
              <button
                type="button"
                onClick={addVariable}
                disabled={disabled}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Variable
              </button>
            )}
          </div>
        </div>

        {/* Template Variables List with Inline Radio Buttons for Use / Do Not Use */}
        {(config.variables || []).length > 0 ? (
          <div className="space-y-2 bg-white p-3 rounded-md border border-gray-200 max-h-[250px] overflow-y-auto pr-1 shadow-2xs">
            {(() => {
              const activeCount = (config.variables || []).filter((v) => v.enabled !== false).length;
              return (config.variables || []).map((variable, idx) => {
                const isEnabled = variable.enabled !== false;
                const isDisabledEnable = !isEnabled && activeCount >= 10;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs p-2 rounded-md border transition-all ${
                      isEnabled
                        ? "bg-white border-gray-200"
                        : "bg-gray-50/80 border-gray-200 text-gray-400 opacity-75"
                    }`}
                  >
                    <span className="font-mono text-gray-500 font-bold">{"{"}</span>
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => updateVariable(idx, "key", e.target.value)}
                      placeholder="Key (e.g. VendorName)"
                      disabled={disabled || !isEnabled}
                      className="w-1/3 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500 font-mono font-medium text-blue-700 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <span className="font-mono text-gray-500 font-bold">{"}"}</span>

                    <input
                      type="text"
                      value={variable.staticValue}
                      onChange={(e) => updateVariable(idx, "staticValue", e.target.value)}
                      placeholder="Value / Default text"
                      disabled={disabled || !isEnabled}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />

                    {/* Inline Radio Buttons for Use Variable vs Do Not Use */}
                    <div className="flex items-center gap-2 shrink-0 border-l border-gray-200 pl-2">
                      <label
                        className={`flex items-center gap-1 cursor-pointer text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
                          isEnabled
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : isDisabledEnable
                            ? "text-gray-300 cursor-not-allowed opacity-50"
                            : "text-gray-500 hover:text-blue-700 hover:bg-blue-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`var_radio_${idx}`}
                          value="use"
                          checked={isEnabled}
                          disabled={isDisabledEnable || disabled}
                          onChange={() => toggleVariableEnabled(idx, true)}
                          className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        Use Variable
                      </label>

                      <label
                        className={`flex items-center gap-1 cursor-pointer text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
                          !isEnabled
                            ? "bg-gray-200 text-gray-800 border border-gray-300"
                            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`var_radio_${idx}`}
                          value="ignore"
                          checked={!isEnabled}
                          disabled={disabled}
                          onChange={() => toggleVariableEnabled(idx, false)}
                          className="w-3.5 h-3.5 text-gray-500 focus:ring-gray-400 cursor-pointer"
                        />
                        Do Not Use
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeVariable(idx)}
                      disabled={disabled}
                      className="p-1 text-gray-400 hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No dynamic variables defined.</p>
        )}
      </div>

      {/* Attached Form Integration */}
      <div className="bg-white p-3 rounded-md border border-gray-200">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={config.formLinkEnabled}
            onChange={(e) => updateConfig({ ...config, formLinkEnabled: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-blue-600" />
            Attach Public Form (Generate Public URL in Email)
          </span>
        </label>

        {config.formLinkEnabled && (
          <div className="mt-2 pl-6">
            <select
              value={config.attachedFormId}
              onChange={(e) => updateConfig({ ...config, attachedFormId: e.target.value })}
              disabled={disabled}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">— Select Form from Form Library —</option>
              {(Array.isArray(forms) ? forms : []).map((f, idx) => (
                <option key={f._id || f.id || idx} value={f._id || f.id}>
                  {f.title || f.name || f.form_code || `Form ${idx + 1}`}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              A secure, tokenized public URL will be generated and appended to the email for each recipient.
            </p>
          </div>
        )}
      </div>

      {/* Auto-Complete Config */}
      <div className="flex items-center gap-4 bg-white p-3 rounded-md border border-gray-200">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.autoComplete}
            onChange={(e) => updateConfig({ ...config, autoComplete: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-800">Auto-Complete Email Task</span>
        </label>

        {config.autoComplete && (
          <div className="flex items-center gap-1 text-sm text-gray-700">
            <span>after</span>
            <input
              type="number"
              min={1}
              max={30}
              value={config.autoCompleteAfterDays}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  autoCompleteAfterDays: Math.max(1, parseInt(e.target.value) || 1),
                })
              }
              disabled={disabled}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:border-blue-500"
            />
            <span>days in progress</span>
          </div>
        )}
      </div>

      {/* If Task ID exists: Re-Send button & Recipient Status Table */}
      {taskId && (
        <div className="mt-6 border-t border-blue-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-4 h-4 text-blue-600" /> Recipient Tracking & Re-Send
            </h5>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleResend("pending")}
                disabled={resending}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1"
              >
                {resending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Re-Send Pending
              </button>
              <button
                type="button"
                onClick={() => handleResend("all")}
                disabled={resending}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded text-xs font-medium flex items-center gap-1"
              >
                Re-Send All
              </button>
            </div>
          </div>

          {resendMessage && (
            <p className="text-xs font-medium text-blue-600 bg-blue-50 p-2 rounded mb-2">
              {resendMessage}
            </p>
          )}

          {/* Status Table */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
                  <th className="p-2 font-semibold">Recipient</th>
                  <th className="p-2 font-semibold">Status</th>
                  <th className="p-2 font-semibold">Sent At</th>
                  <th className="p-2 font-semibold">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(recipientStatus || []).length > 0 ? (
                  (recipientStatus || []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-2">
                        <div className="font-medium text-gray-900">{row.name || "—"}</div>
                        <div className="text-gray-400 text-[11px]">{row.email}</div>
                      </td>
                      <td className="p-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            row.status === "submitted"
                              ? "bg-green-100 text-green-700"
                              : row.status === "sent" || row.status === "opened"
                              ? "bg-blue-100 text-blue-700"
                              : row.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {row.status === "submitted" && <CheckCircle className="w-3 h-3" />}
                          {row.status === "failed" && <AlertCircle className="w-3 h-3" />}
                          {(row.status === "sent" || row.status === "pending") && (
                            <Clock className="w-3 h-3" />
                          )}
                          {row.status}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500">
                        {row.sentAt ? new Date(row.sentAt).toLocaleString() : "—"}
                      </td>
                      <td className="p-2 text-gray-500">
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-gray-400 italic">
                      {loadingStatus ? "Loading recipient tracking..." : "No email delivery history yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Recipient Import Modal from Form Responses */}
      <FormSubmissionRecipientModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportRecipients={handleImportRecipients}
        forms={forms}
      />

      {/* Recipient Variable Matrix & Form Overrides Modal (Case I & Case II) */}
      <RecipientVariableMatrixModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        recipients={config.recipients || []}
        variables={(config.variables || []).filter((v) => v.enabled !== false)}
        onSaveMatrix={(updatedRecipients) => {
          updateConfig({ ...config, recipients: updatedRecipients });
        }}
      />
    </div>
  );
}
