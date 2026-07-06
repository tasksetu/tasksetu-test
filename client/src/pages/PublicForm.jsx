import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FieldRenderer } from "@/components/forms/FieldRenderer";

export default function PublicForm() {
  const [match, params] = useRoute("/forms/public/:token");
  const [, navigate] = useLocation();
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  // CAPTCHA state
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaChallengeId, setCaptchaChallengeId] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaVerifying, setCaptchaVerifying] = useState(false);

  // Evaluate conditional logic - Define BEFORE validateField uses it
  const evaluateConditions = useCallback((conditions, currentFormData) => {
    if (!conditions || conditions.length === 0) return true;

    const results = conditions.map((condition) => {
      const fieldValue = currentFormData[condition.field_code];

      switch (condition.operator) {
        case "==":
          return fieldValue == condition.value;
        case "!=":
          return fieldValue != condition.value;
        case ">":
          return parseFloat(fieldValue) > parseFloat(condition.value);
        case "<":
          return parseFloat(fieldValue) < parseFloat(condition.value);
        case ">=":
          return parseFloat(fieldValue) >= parseFloat(condition.value);
        case "<=":
          return parseFloat(fieldValue) <= parseFloat(condition.value);
        case "contains":
          return String(fieldValue).includes(condition.value);
        case "not_contains":
          return !String(fieldValue).includes(condition.value);
        case "is_empty":
          return !fieldValue || fieldValue === "";
        case "is_not_empty":
          return fieldValue && fieldValue !== "";
        case "in":
          return (
            Array.isArray(condition.value) &&
            condition.value.includes(fieldValue)
          );
        case "not_in":
          return (
            Array.isArray(condition.value) &&
            !condition.value.includes(fieldValue)
          );
        default:
          return true;
      }
    });

    const logicType = conditions[0]?.logic || "AND";
    return logicType === "OR"
      ? results.some((r) => r)
      : results.every((r) => r);
  }, []);

  // Load CAPTCHA challenge
  const loadCaptcha = useCallback(async () => {
    if (!token) return;
    try {
      setCaptchaLoading(true);
      setCaptchaError("");
      setCaptchaAnswer("");
      const res = await fetch(`/api/public/forms/${token}/captcha`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCaptchaSvg(data.data.svgImage);
        setCaptchaChallengeId(data.data.challengeId);
      } else {
        setCaptchaError(data.message || "Failed to load CAPTCHA");
      }
    } catch (err) {
      setCaptchaError("Failed to load CAPTCHA. Please refresh.");
    } finally {
      setCaptchaLoading(false);
    }
  }, [token]);

  // Verify CAPTCHA answer
  const handleCaptchaVerify = async () => {
    if (!captchaAnswer.trim()) {
      setCaptchaError("Please enter the answer");
      return;
    }
    try {
      setCaptchaVerifying(true);
      setCaptchaError("");
      const res = await fetch(`/api/public/forms/${token}/verify-captcha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: captchaChallengeId,
          answer: captchaAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCaptchaVerified(true);
        setCaptchaToken(data.data.captchaToken);
      } else {
        setCaptchaError(data.message || "Incorrect answer. Try again.");
        // Reload a new CAPTCHA on failure
        loadCaptcha();
      }
    } catch (err) {
      setCaptchaError("Verification failed. Please try again.");
    } finally {
      setCaptchaVerifying(false);
    }
  };

  // Fetch form by external token
  useEffect(() => {
    if (!token) {
      setErrorMessage("Invalid form link");
      setLoading(false);
      return;
    }

    const fetchForm = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/public/forms/${token}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Form not found or expired");
        }

        const data = await response.json();

        if (!data.success || !data.data) {
          throw new Error("Invalid form data");
        }

        const formSchema = data.data;

        // Check if form is still active (timezone-aware using publisher's timezone)
        // Server already does the primary check; this is a client-side safeguard
        const now = new Date();
        const tz =
          formSchema.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone;
        const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

        if (formSchema.start_at) {
          const startStr = new Date(formSchema.start_at).toLocaleDateString(
            "en-CA",
            { timeZone: tz },
          );
          if (todayStr < startStr) {
            throw new Error("This form is not yet available");
          }
        }

        if (formSchema.end_at) {
          const endStr = new Date(formSchema.end_at).toLocaleDateString(
            "en-CA",
            { timeZone: tz },
          );
          if (todayStr > endStr) {
            throw new Error("This form has expired");
          }
        }

        setForm(formSchema);

        // Check if CAPTCHA is required
        if (formSchema.require_captcha) {
          setCaptchaRequired(true);
        }

        // Initialize form data with default values
        const initialData = {};
        formSchema.fields?.forEach((field) => {
          if (field.default_value) {
            initialData[field.field_code || field.id] = field.default_value;
          }
        });
        setFormData(initialData);
      } catch (error) {
        console.error("Error fetching form:", error);
        setErrorMessage(error.message || "Failed to load form");
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [token]);

  // Load CAPTCHA when required
  useEffect(() => {
    if (captchaRequired && !captchaVerified) {
      loadCaptcha();
    }
  }, [captchaRequired, captchaVerified, loadCaptcha]);

  // Validate a single field and return errors array
  const validateField = useCallback(
    (field, value, currentFormData) => {
      const fieldErrors = [];

      // Skip validation for display-only fields
      if (["title", "label", "qr_code"].includes(field.type)) {
        return fieldErrors;
      }

      // Check visibility condition
      const isVisible = evaluateConditions(
        field.visibility_condition,
        currentFormData,
      );
      if (!isVisible) return fieldErrors;

      // Check if enabled
      const isEnabled = evaluateConditions(
        field.enable_condition,
        currentFormData,
      );
      if (!isEnabled) return fieldErrors;

      // Required validation
      if (field.isRequired || field.required) {
        if (value === undefined || value === null || value === "") {
          fieldErrors.push(`${field.label} is required`);
        }
      }

      // Type-specific validation
      if (value !== undefined && value !== null && value !== "") {
        switch (field.type) {
          case "email":
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              fieldErrors.push("Invalid email address");
            }
            break;

          case "phone":
            const phoneDigits = String(value).replace(/\D/g, "");
            if (phoneDigits.length < 10 || phoneDigits.length > 15) {
              fieldErrors.push("Invalid phone number");
            }
            break;

          case "url":
            try {
              new URL(value);
            } catch {
              fieldErrors.push("Invalid URL");
            }
            break;

          case "number":
          case "decimal":
            const numValue = parseFloat(value);
            // Check min - only if min is a valid number (not null, not undefined)
            if (
              field.validation?.min != null &&
              !isNaN(field.validation.min) &&
              numValue < field.validation.min
            ) {
              fieldErrors.push(`Minimum value is ${field.validation.min}`);
            }
            // Check max - only if max is a valid number (not null, not undefined)
            if (
              field.validation?.max != null &&
              !isNaN(field.validation.max) &&
              numValue > field.validation.max
            ) {
              fieldErrors.push(`Maximum value is ${field.validation.max}`);
            }
            break;
        }

        // Length validation - only if minLength/maxLength is a valid number
        if (
          field.validation?.minLength != null &&
          !isNaN(field.validation.minLength) &&
          String(value).length < field.validation.minLength
        ) {
          fieldErrors.push(
            `Minimum length is ${field.validation.minLength} characters`,
          );
        }
        if (
          field.validation?.maxLength != null &&
          !isNaN(field.validation.maxLength) &&
          String(value).length > field.validation.maxLength
        ) {
          fieldErrors.push(
            `Maximum length is ${field.validation.maxLength} characters`,
          );
        }
      }

      return fieldErrors;
    },
    [evaluateConditions],
  );

  const handleFieldChange = useCallback(
    (fieldCode, value) => {
      const newFormData = { ...formData, [fieldCode]: value };
      setFormData(newFormData);

      // Find the field being changed
      const field = form?.fields?.find(
        (f) => (f.field_code || f.id) === fieldCode,
      );

      if (field) {
        // Validate this field immediately
        const fieldErrors = validateField(field, value, newFormData);

        setErrors((prev) => {
          const newErrors = { ...prev };
          if (fieldErrors.length > 0) {
            newErrors[fieldCode] = fieldErrors;
          } else {
            delete newErrors[fieldCode];
          }
          return newErrors;
        });
      }
    },
    [formData, form, validateField],
  );

  const validateFormData = () => {
    const newErrors = {};
    let isValid = true;

    form.fields?.forEach((field) => {
      const fieldCode = field.field_code || field.id;
      const value = formData[fieldCode];

      const fieldErrors = validateField(field, value, formData);

      if (fieldErrors.length > 0) {
        newErrors[fieldCode] = fieldErrors;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateFormData()) {
      setErrorMessage("Please fix the errors below");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");

      const response = await fetch(`/api/public/forms/${token}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          responses: formData,
          submitted_by: null, // Anonymous submission
          captchaToken: captchaToken || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors from backend
        if (response.status === 422 && data.errors) {
          const newErrors = {};
          data.errors.forEach((err) => {
            newErrors[err.field_code] = err.message;
          });
          setErrors(newErrors);
          setErrorMessage(data.message || "Please fix the validation errors");
        } else if (response.status === 410) {
          setErrorMessage(
            "This form has expired and is no longer accepting submissions",
          );
        } else {
          setErrorMessage(data.message || "Failed to submit form");
        }
        return;
      }

      setSubmitted(true);

      // Redirect after success if configured
      if (form.settings?.redirectUrl) {
        setTimeout(() => {
          window.location.href = form.settings.redirectUrl;
        }, 2000);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setErrorMessage(
        error.message || "Failed to submit form. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Determine grid layout
  const gridColumns =
    form?.settings?.layout === "1-column"
      ? 1
      : form?.settings?.layout === "2-columns"
        ? 2
        : form?.settings?.layout === "3-columns"
          ? 3
          : 1;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-600 mb-3" />
              <p className="text-slate-600">Loading form...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (errorMessage && !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => navigate("/")}>
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // CAPTCHA gate - show before the form if captcha is required and not yet verified
  if (captchaRequired && !captchaVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center border-b">
            <div className="flex justify-center mb-3">
              <ShieldCheck className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">
              Security Verification
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Please solve the challenge below to access the form
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {captchaLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                <span className="ml-2 text-slate-500">Loading CAPTCHA...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* CAPTCHA Image */}
                <div className="flex items-center justify-center gap-3">
                  <div
                    className="border border-slate-200 rounded-sm p-2 bg-white"
                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadCaptcha}
                    title="Load new CAPTCHA"
                    className="shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Answer Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Enter the answer:
                  </label>
                  <Input
                    type="text"
                    value={captchaAnswer}
                    onChange={(e) => {
                      setCaptchaAnswer(e.target.value);
                      setCaptchaError("");
                    }}
                    placeholder="Type your answer here"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCaptchaVerify();
                      }
                    }}
                    className="text-center text-lg font-mono"
                    autoFocus
                  />
                </div>

                {/* Error Message */}
                {captchaError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{captchaError}</AlertDescription>
                  </Alert>
                )}

                {/* Verify Button */}
                <Button
                  onClick={handleCaptchaVerify}
                  disabled={captchaVerifying || !captchaAnswer.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {captchaVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Continue"
                  )}
                </Button>

                <p className="text-xs text-slate-400 text-center">
                  This verification helps prevent automated submissions
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="text-center mt-6 text-sm text-slate-500">
          Powered by TaskSetu Form Builder
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {form?.settings?.submitMessage ||
                  "Thank you for your submission!"}
              </h2>
              <p className="text-slate-600 mb-3">
                Your response has been recorded successfully.
              </p>
              {form?.settings?.showResponseSummary && (
                <div className="bg-slate-100 rounded-sm p-4 mb-3 text-left">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Your Responses:
                  </h3>
                  <div className="space-y-2 text-sm">
                    {form.fields
                      ?.filter((f) => !["title", "label"].includes(f.type))
                      .map((field) => {
                        const value = formData[field.field_code || field.id];
                        if (!value) return null;
                        return (
                          <div key={field.field_code || field.id}>
                            <span className="font-medium">{field.label}:</span>{" "}
                            <span className="text-slate-600">
                              {Array.isArray(value)
                                ? value.join(", ")
                                : String(value)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              {form?.settings?.redirectUrl ? (
                <p className="text-sm text-slate-500">Redirecting...</p>
              ) : (
                <Button onClick={() => window.location.reload()}>
                  Submit Another Response
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form render
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <CardTitle className="text-3xl font-bold text-slate-900">
            {form?.title || "Untitled Form"}
          </CardTitle>
          {form?.description && (
            <p className="text-slate-600 mt-2">{form.description}</p>
          )}
        </CardHeader>

        <CardContent className="p-4">
          <form onSubmit={handleSubmit}>
            {/* Error Alert */}
            {errorMessage && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Form Fields */}
            <div
              className="grid gap-3 mb-3"
              style={{
                gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
              }}
            >
              {form?.fields?.map((field) => (
                <FieldRenderer
                  key={field.field_id || field.field_code || field.id}
                  field={field}
                  value={formData[field.field_code || field.id]}
                  onChange={handleFieldChange}
                  formData={formData}
                  errors={errors[field.field_code || field.id] || []}
                />
              ))}
            </div>

            {/* CAPTCHA Placeholder (if required) */}
            {form?.settings?.require_captcha && (
              <div className="mb-3 p-4 border border-slate-200 rounded-sm bg-slate-50">
                <p className="text-sm text-slate-600 text-center">
                  🤖 CAPTCHA verification (to be implemented)
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-6 border-t">
              <p className="text-sm text-slate-500">* Required fields</p>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white px-8"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center mt-6 text-sm text-slate-500">
        Powered by TaskSetu Form Builder
      </div>
    </div>
  );
}
