import React, { useEffect, useState } from "react";

const GoogleCalendarCallback = () => {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Connecting to Google Calendar...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");

        if (error) {
          console.error("Google Calendar authorization error:", error);
          setStatus("error");
          setMessage(`Authorization failed: ${error}`);

          // Notify parent window if this is a popup
          if (window.opener) {
            window.opener.postMessage(
              { error: `Authorization failed: ${error}` },
              window.location.origin,
            );
            setTimeout(() => window.close(), 3000);
          } else {
            // Redirect back to calendar view after delay
            setTimeout(() => (window.location.href = "/calendar"), 3000);
          }
          return;
        }

        if (code) {
          setMessage("Exchanging authorization code...");

          // Exchange code for access token
          const response = await fetch("/api/google-calendar/auth", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ code }),
          });

          if (response.ok) {
            const authData = await response.json();

            // Store auth data in localStorage
            localStorage.setItem(
              "googleCalendarAuth",
              JSON.stringify({
                connected: true,
                access_token: true,
                connectedAt: new Date().toISOString(),
              }),
            );

            setStatus("success");
            setMessage("Google Calendar connected successfully!");

            // Notify parent window if this is a popup
            if (window.opener) {
              window.opener.postMessage(
                { success: true, authData },
                window.location.origin,
              );
              setTimeout(() => window.close(), 2000);
            } else {
              // Redirect back to calendar view after delay
              setTimeout(() => (window.location.href = "/calendar"), 2000);
            }
          } else {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "Failed to exchange code for token",
            );
          }
        } else {
          throw new Error("No authorization code received");
        }
      } catch (error) {
        console.error("Google Calendar callback error:", error);
        setStatus("error");
        setMessage(`Connection failed: ${error.message}`);

        if (window.opener) {
          window.opener.postMessage(
            { error: error.message },
            window.location.origin,
          );
          setTimeout(() => window.close(), 3000);
        } else {
          setTimeout(() => (window.location.href = "/calendar"), 3000);
        }
      }
    };

    handleCallback();
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "success":
        return (
          <svg
            className="w-16 h-16 text-green-500 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className="w-16 h-16 text-red-500 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <div className="w-16 h-16 mx-auto mb-3">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white p-7 rounded-sm shadow-lg text-center max-w-md w-full">
        {getStatusIcon()}

        <h2 className={`text-xl font-semibold mb-3 ${getStatusColor()}`}>
          {status === "processing" && "Connecting to Google Calendar"}
          {status === "success" && "Connection Successful!"}
          {status === "error" && "Connection Failed"}
        </h2>

        <p className="text-gray-600 mb-3">{message}</p>

        {status === "success" && (
          <div className="text-sm text-gray-500">
            This window will close automatically...
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <div className="text-sm text-gray-500">
              Redirecting back to the calendar view...
            </div>
            <button
              onClick={() =>
                window.opener
                  ? window.close()
                  : (window.location.href = "/calendar")
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors"
            >
              Return to Calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleCalendarCallback;
