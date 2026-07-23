import { QueryClient } from "@tanstack/react-query";
import { clearAuth } from "../utils/auth";

// Handle 401 token expired for fetch-based calls
async function handleTokenExpiredResponse(res) {
  if (res.status !== 401) return;
  try {
    const data = await res.clone().json();
    const message = data?.message || data?.error || '';
    if (
      message.toLowerCase().includes('expired') ||
      message.toLowerCase().includes('token') ||
      data?.expiredAt
    ) {
      clearAuth();
      localStorage.removeItem('tokenExpiry');
      window.location.href = '/login';
    }
  } catch {
    // Response body is not JSON — ignore
  }
}

async function throwIfResNotOk(res) {
  if (!res.ok) {
    await handleTokenExpiredResponse(res);
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(method, url, data) {
  const token = localStorage.getItem("token");
  const headers = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export const getQueryFn =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("ERROR: No token found in localStorage");
        throw new Error("No authentication token found");
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(queryKey[0], {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (!res.ok) {
        await handleTokenExpiredResponse(res);
        const errorText = await res.text();
        throw new Error(`${res.status}: ${errorText}`);
      }

      const data = await res.json();
      if (data?.success === true && 'data' in data) {
        return data.data;
      }
      return data;
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnMount: "always",
      staleTime: 0, // Always refetch — data is immediately stale
      gcTime: 5 * 60 * 1000, // Keep in cache 5 min for back-navigation & instant rendering
      placeholderData: (previousData) => previousData, // Show previous data while fetching latest changes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

