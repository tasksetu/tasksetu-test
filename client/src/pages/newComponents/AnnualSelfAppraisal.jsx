import React, { useState, useEffect } from "react";
import { User, Trophy, Zap, Target, Star, MessageCircle } from "lucide-react";
import { useShowToast } from "@/utils/ToastMessage";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";

export default function AnnualSelfAppraisal({ onClose, employeeData = null }) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [formData, setFormData] = useState({
    // Personal Info (Read-only) - Initialized from props or empty
    employeeId: employeeData?.employeeId || "",
    fullName: employeeData?.fullName || "",
    position: employeeData?.position || "",
    department: employeeData?.department || "",
    manager: employeeData?.manager || "",
    reviewPeriod:
      employeeData?.reviewPeriod || new Date().getFullYear().toString(),
    hireDate: employeeData?.hireDate || "",

    // Achievements Section
    keyAccomplishments: "",
    projectsCompleted: "",
    skillsDeveloped: "",
    recognitionReceived: "",
    quantifiableResults: "",

    // Challenges Section
    challengesFaced: "",
    lessonsLearned: "",
    areasForImprovement: "",
    supportNeeded: "",

    // Goals Section
    shortTermGoals: "",
    longTermGoals: "",
    careerAspirations: "",
    learningObjectives: "",

    // Self-Rating (1-5 scale)
    performanceRating: "",
    communicationRating: "",
    teamworkRating: "",
    innovationRating: "",
    reliabilityRating: "",

    // Optional Manager Feedback
    managerComments: "",
    managerRecommendations: "",
    developmentPlan: "",
  });

  const [formStatus, setFormStatus] = useState("draft"); // draft, saved, submitted
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [wordCounts, setWordCounts] = useState({});

  // Auto-save functionality
  useEffect(() => {
    const autoSaveTimer = setTimeout(() => {
      if (formStatus === "draft") {
        handleAutoSave();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearTimeout(autoSaveTimer);
  }, [formData, formStatus]);

  // Calculate word counts for text areas
  useEffect(() => {
    const newWordCounts = {};
    Object.keys(formData).forEach((key) => {
      if (typeof formData[key] === "string" && formData[key].length > 0) {
        newWordCounts[key] = formData[key].trim().split(/\s+/).length;
      }
    });
    setWordCounts(newWordCounts);
  }, [formData]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    const requiredFields = [
      "keyAccomplishments",
      "challengesFaced",
      "shortTermGoals",
      "performanceRating",
      "communicationRating",
      "teamworkRating",
    ];

    requiredFields.forEach((field) => {
      if (!formData[field] || formData[field].trim().length === 0) {
        errors[field] = "This field is required";
      }
    });

    // Validate minimum word counts for key sections
    const minWordCounts = {
      keyAccomplishments: 50,
      challengesFaced: 30,
      shortTermGoals: 30,
    };

    Object.entries(minWordCounts).forEach(([field, minWords]) => {
      const wordCount = wordCounts[field] || 0;
      if (wordCount < minWords) {
        errors[field] = `Please provide at least ${minWords} words`;
      }
    });

    // Validate ratings are within range
    const ratingFields = [
      "performanceRating",
      "communicationRating",
      "teamworkRating",
      "innovationRating",
      "reliabilityRating",
    ];
    ratingFields.forEach((field) => {
      if (
        formData[field] &&
        (parseInt(formData[field]) < 1 || parseInt(formData[field]) > 5)
      ) {
        errors[field] = "Rating must be between 1 and 5";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAutoSave = async () => {
    try {
      // Simulate auto-save API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setLastSaved(new Date());
      console.log("Form auto-saved");
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      // Simulate save API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setFormStatus("saved");
      setLastSaved(new Date());
      console.log("Form saved successfully");
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      // Simulate submit API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setFormStatus("submitted");
      console.log("Form submitted successfully");
      showSuccessToast("Self-appraisal submitted");
    } catch (error) {
      console.error("Submit failed:", error);
      showErrorToast("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setShowResetConfirm(false);
    setFormData((prev) => ({
      ...prev,
      keyAccomplishments: "",
      projectsCompleted: "",
      skillsDeveloped: "",
      recognitionReceived: "",
      quantifiableResults: "",
      challengesFaced: "",
      lessonsLearned: "",
      areasForImprovement: "",
      supportNeeded: "",
      shortTermGoals: "",
      longTermGoals: "",
      careerAspirations: "",
      learningObjectives: "",
      performanceRating: "",
      communicationRating: "",
      teamworkRating: "",
      innovationRating: "",
      reliabilityRating: "",
      managerComments: "",
      managerRecommendations: "",
      developmentPlan: "",
    }));
    setValidationErrors({});
    setFormStatus("draft");
  };

  const getStatusBadge = () => {
    const statusConfig = {
      draft: { color: "bg-gray-100 text-gray-800", icon: "📝", label: "Draft" },
      saved: { color: "bg-blue-100 text-blue-800", icon: "💾", label: "Saved" },
      submitted: {
        color: "bg-green-100 text-green-800",
        icon: "✅",
        label: "Submitted",
      },
    };

    const config = statusConfig[formStatus];
    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}
      >
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const renderRatingField = (field, label) => (
    <div className="form-field">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      <select
        value={formData[field]}
        onChange={(e) => handleInputChange(field, e.target.value)}
        className={`form-select ${validationErrors[field] ? "border-red-500" : ""}`}
        disabled={formStatus === "submitted"}
      >
        <option value="">Select rating...</option>
        <option value="5">5 - Exceptional</option>
        <option value="4">4 - Exceeds Expectations</option>
        <option value="3">3 - Meets Expectations</option>
        <option value="2">2 - Below Expectations</option>
        <option value="1">1 - Needs Improvement</option>
      </select>
      {validationErrors[field] && (
        <p className="text-red-500 text-xs mt-1">{validationErrors[field]}</p>
      )}
    </div>
  );

  const renderTextArea = (
    field,
    label,
    placeholder,
    required = false,
    minWords = 0,
  ) => (
    <div className="form-field">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
        {minWords > 0 && (
          <span className="text-xs text-gray-500 ml-2">
            (Min {minWords} words - Current: {wordCounts[field] || 0})
          </span>
        )}
      </label>
      <textarea
        value={formData[field]}
        onChange={(e) => handleInputChange(field, e.target.value)}
        className={`form-textarea ${validationErrors[field] ? "border-red-500" : ""}`}
        placeholder={placeholder}
        rows={4}
        disabled={formStatus === "submitted"}
      />
      {validationErrors[field] && (
        <p className="text-red-500 text-xs mt-1">{validationErrors[field]}</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[100vh]  overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Annual Self-Appraisal</h1>
              <p className="text-blue-100">
                Review Period: {formData.reviewPeriod}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:text-blue-200 transition-colors hover:bg-white/10"
                disabled={isSubmitting}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
          </div>

          {/* Status Info */}
          <div className="mt-4 text-sm text-blue-100">
            {lastSaved && <p>Last saved: {lastSaved.toLocaleString()}</p>}
            {formStatus === "draft" && (
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                Auto-saving enabled
              </p>
            )}
          </div>
        </div>

        {/* Form Content */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(95vh - 200px)" }}
        >
          <div className="p-4 space-y-3">
            {/* Personal Information (Read-Only) */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User size={20} className="text-blue-600" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="info-item">
                  <label className="text-sm font-medium text-gray-500">
                    Employee ID
                  </label>
                  <p className="text-gray-900 font-semibold">
                    {formData.employeeId}
                  </p>
                </div>
                <div className="info-item">
                  <label className="text-sm font-medium text-gray-500">
                    Full Name
                  </label>
                  <p className="text-gray-900 font-semibold">
                    {formData.fullName}
                  </p>
                </div>
                <div className="info-item">
                  <label className="text-sm font-medium text-gray-500">
                    Position
                  </label>
                  <p className="text-gray-900 font-semibold">
                    {formData.position}
                  </p>
                </div>
                <div className="info-item">
                  <label className="text-sm font-medium text-gray-500">
                    Department
                  </label>
                  <p className="text-gray-900 font-semibold">
                    {formData.department}
                  </p>
                </div>
                <div className="info-item">
                  <label className="text-sm font-medium text-gray-500">
                    Manager
                  </label>
                  <p className="text-gray-900 font-semibold">
                    {formData.manager}
                  </p>
                </div>
                <div className="info-item">
                  <label className="text-sm font-medium text-gray-500">
                    Hire Date
                  </label>
                  <p className="text-gray-900 font-semibold">
                    {formData.hireDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Achievements Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Trophy size={20} className="text-green-600" />
                Achievements & Accomplishments
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {renderTextArea(
                  "keyAccomplishments",
                  "Key Accomplishments",
                  "Describe your major achievements this year...",
                  true,
                  50,
                )}
                {renderTextArea(
                  "projectsCompleted",
                  "Projects Completed",
                  "List and describe significant projects you completed...",
                )}
                {renderTextArea(
                  "skillsDeveloped",
                  "Skills Developed",
                  "What new skills or competencies have you gained?...",
                )}
                {renderTextArea(
                  "quantifiableResults",
                  "Quantifiable Results",
                  "Include metrics, percentages, or measurable outcomes...",
                )}
              </div>
            </div>

            {/* Challenges Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Zap size={20} className="text-orange-600" />
                Challenges & Growth
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {renderTextArea(
                  "challengesFaced",
                  "Challenges Faced",
                  "What obstacles or difficulties did you encounter?...",
                  true,
                  30,
                )}
                {renderTextArea(
                  "lessonsLearned",
                  "Lessons Learned",
                  "What did you learn from these challenges?...",
                )}
                {renderTextArea(
                  "areasForImprovement",
                  "Areas for Improvement",
                  "Where do you see opportunities for growth?...",
                )}
                {renderTextArea(
                  "supportNeeded",
                  "Support Needed",
                  "What support or resources would help you improve?...",
                )}
              </div>
            </div>

            {/* Goals Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Target size={20} className="text-purple-600" />
                Goals & Aspirations
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {renderTextArea(
                  "shortTermGoals",
                  "Short-term Goals (Next 6-12 months)",
                  "What do you want to achieve in the near term?...",
                  true,
                  30,
                )}
                {renderTextArea(
                  "longTermGoals",
                  "Long-term Goals (1-3 years)",
                  "What are your longer-term professional objectives?...",
                )}
                {renderTextArea(
                  "careerAspirations",
                  "Career Aspirations",
                  "Where do you see your career heading?...",
                )}
                {renderTextArea(
                  "learningObjectives",
                  "Learning & Development Objectives",
                  "What skills or knowledge do you want to develop?...",
                )}
              </div>
            </div>

            {/* Self-Rating Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Star size={20} className="text-indigo-600" />
                Self-Assessment Ratings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {renderRatingField("performanceRating", "Overall Performance")}
                {renderRatingField(
                  "communicationRating",
                  "Communication Skills",
                )}
                {renderRatingField(
                  "teamworkRating",
                  "Teamwork & Collaboration",
                )}
                {renderRatingField(
                  "innovationRating",
                  "Innovation & Creativity",
                )}
                {renderRatingField(
                  "reliabilityRating",
                  "Reliability & Accountability",
                )}
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-sm">
                <h4 className="font-medium text-blue-900 mb-2">
                  Rating Scale:
                </h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>
                    <strong>5 - Exceptional:</strong> Consistently exceeds
                    expectations
                  </p>
                  <p>
                    <strong>4 - Exceeds Expectations:</strong> Frequently
                    performs above requirements
                  </p>
                  <p>
                    <strong>3 - Meets Expectations:</strong> Consistently meets
                    job requirements
                  </p>
                  <p>
                    <strong>2 - Below Expectations:</strong> Sometimes meets
                    requirements
                  </p>
                  <p>
                    <strong>1 - Needs Improvement:</strong> Rarely meets
                    requirements
                  </p>
                </div>
              </div>
            </div>

            {/* Manager Feedback Section (Optional) */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageCircle size={20} className="text-teal-600" />
                Manager Feedback (Optional)
              </h2>
              <div className="space-y-3">
                {renderTextArea(
                  "managerComments",
                  "Manager Comments",
                  "Manager feedback will be added here...",
                )}
                {renderTextArea(
                  "managerRecommendations",
                  "Manager Recommendations",
                  "Development recommendations from your manager...",
                )}
                {renderTextArea(
                  "developmentPlan",
                  "Development Plan",
                  "Agreed upon development plan and next steps...",
                )}
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-sm">
                <p className="text-yellow-800 text-sm">
                  <strong>Note:</strong> This section will be completed by your
                  manager during the review process.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 w-full px-6 py-4 overflow-visible border-t border-gray-200 ">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex flex-col sm:flex-row gap-3 ">
              <Button
                variant="outline"
                onClick={handleReset}
                className="h-9 flex items-center gap-2"
                disabled={isSubmitting || formStatus === "submitted"}
              >
                <span>🔄</span>
                Reset Form
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleSave}
                className="h-9 flex items-center gap-2"
                disabled={isSubmitting || formStatus === "submitted"}
              >
                {isSubmitting ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>💾</span>
                )}
                Save Draft
              </Button>

              <Button
                variant="primary"
                onClick={handleSubmit}
                className="h-9 flex items-center gap-2"
                disabled={isSubmitting || formStatus === "submitted"}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    Submit for Review
                  </>
                )}
              </Button>
            </div>
          </div>

          {formStatus === "submitted" && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-sm">
              <p className="text-green-800 text-sm font-medium">
                ✅ Your self-appraisal has been submitted successfully! Your
                manager will review it and provide feedback.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reset Form Confirmation */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Form?"
        description="Are you sure you want to reset the form? All unsaved changes will be lost."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
      />
    </div>
  );
}
