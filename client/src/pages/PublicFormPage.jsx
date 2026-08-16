/**
 * PublicFormPage — Phase 8 & 14 Frontend Component
 *
 * Public route for external email recipients to submit attached forms without a Tasksetu account.
 * URL: /public/forms/:token
 */

import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle, AlertTriangle, Clock, FileText, Send, Loader2 } from "lucide-react";
import { apiClient } from "../utils/apiClient";

export default function PublicFormPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState(null);
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);

  useEffect(() => {
    fetchPublicForm();
  }, [token]);

  const fetchPublicForm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/workflow/public/forms/${token}`);
      if (res.data?.success) {
        setFormData(res.data.data);
      } else if (res.data?.message?.toLowerCase().includes("already")) {
        setIsAlreadySubmitted(true);
      } else {
        setError(res.data?.message || "Invalid or expired form link.");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "";
      if (err.response?.status === 409 || msg.toLowerCase().includes("already")) {
        setIsAlreadySubmitted(true);
      } else {
        setError(msg || "This form link is invalid or expired.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldId, value) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formattedResponses = Object.entries(responses).map(([fieldId, value]) => ({
        fieldId,
        value,
      }));

      const res = await apiClient.post(`/api/workflow/public/forms/${token}/submit`, {
        responses: formattedResponses,
      });

      if (res.data?.success) {
        setSubmitted(true);
      } else if (res.data?.message?.toLowerCase().includes("already")) {
        setIsAlreadySubmitted(true);
      } else {
        setError(res.data?.message || "Failed to submit form.");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "";
      if (err.response?.status === 409 || msg.toLowerCase().includes("already")) {
        setIsAlreadySubmitted(true);
      } else {
        setError(msg || "Form submission failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-gray-500 font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Loading form...
        </div>
      </div>
    );
  }

  if (submitted || isAlreadySubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {submitted ? "Submission Received!" : "Form Already Submitted"}
          </h2>
          <p className="text-sm text-gray-600">
            {submitted
              ? `Thank you for completing the form${formData?.taskTitle ? ` for "${formData.taskTitle}"` : ""}. Your response has been recorded.`
              : "Thank you! Your response for this form has already been submitted and recorded."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Form Unavailable</h2>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const form = formData?.form;
  const fields = form?.fields || [];

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-6 shadow-md">
          <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" /> Tasksetu Public Form
          </div>
          <h1 className="text-2xl font-bold">{form?.title || formData?.taskTitle || "Form Submission"}</h1>
          {form?.description && (
            <p className="text-sm text-blue-100 mt-1 opacity-90">{form.description}</p>
          )}
          {formData?.recipientName && (
            <div className="mt-3 text-xs text-blue-200 bg-white/10 rounded px-3 py-1.5 inline-block">
              Recipient: <strong>{formData.recipientName}</strong> ({formData.recipientEmail})
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 space-y-5">
          {fields.length > 0 ? (
            fields.map((field, idx) => {
              const fieldKey = field.field_id || field.field_code || field.id || field._id || `field_${idx}`;
              const isRequired = field.isRequired || field.required || false;
              const helpText = field.helpText || field.description;

              return (
                <div key={fieldKey} className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-800">
                    {field.label || "Field"} {isRequired && <span className="text-red-500">*</span>}
                  </label>
                  {helpText && <p className="text-xs text-gray-400">{helpText}</p>}

                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      required={isRequired}
                      value={responses[fieldKey] !== undefined ? responses[fieldKey] : (field.default_value || "")}
                      onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                      placeholder={field.placeholder || ""}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500"
                    />
                  ) : field.type === "dropdown" || field.type === "select" ? (
                    <select
                      required={isRequired}
                      value={responses[fieldKey] !== undefined ? responses[fieldKey] : (field.default_value || "")}
                      onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500 bg-white"
                    >
                      <option value="">— Select an option —</option>
                      {(field.options || []).map((opt, i) => {
                        const optVal = typeof opt === "object" ? opt.value || opt.label : opt;
                        const optLabel = typeof opt === "object" ? opt.label || opt.value : opt;
                        return (
                          <option key={i} value={optVal}>
                            {optLabel}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      required={isRequired}
                      value={responses[fieldKey] !== undefined ? responses[fieldKey] : (field.default_value || "")}
                      onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                      placeholder={field.placeholder || ""}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500"
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm italic">
              No fields configured for this form.
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
