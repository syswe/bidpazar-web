const API_BASE_URL = typeof window !== 'undefined' 
  ? (window.__ENV__?.NEXT_PUBLIC_API_URL || '/api')
  : '/api';

// Helper to get a cookie value by name
const getCookieValue = (name: string): string | null => {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
};

// Get authentication data from localStorage with fallback to cookies
const getAuth = (): { token: string | null; user: any | null } => {
  if (typeof window !== "undefined") {
    try {
      // First check localStorage
      const authData = localStorage.getItem("auth");

      if (authData) {
        try {
          const parsed = JSON.parse(authData);

          // Validate the parsed data structure
          if (parsed && parsed.token && parsed.user && parsed.user.id) {
            return { token: parsed.token, user: parsed.user };
          }
        } catch (error) {
          console.error("Failed to parse auth data from localStorage:", error);
          // Clear invalid data
          localStorage.removeItem("auth");
        }
      }

      // Fallback: Check for token in cookies if localStorage failed
      const tokenFromCookie = getCookieValue("token");
      if (tokenFromCookie) {
        return { token: tokenFromCookie, user: null };
      }
    } catch (e) {
      console.error("Error accessing authentication storage:", e);
    }
  }

  return { token: null, user: null };
};

// Get auth token from storage (consistent with frontend-auth.ts)
export const getAuthToken = (): string | null => {
  // First try localStorage
  const { token } = getAuth();
  if (token) return token;

  // Fallback to cookies
  if (typeof window !== "undefined") {
    return getCookieValue("token");
  }

  return null;
};

// Shared fetcher function for all API client modules
export const apiFetcher = async <T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();
  
  // Debug logging
  console.log(`[apiFetcher] Making request to: ${url}`, {
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    method: options.method || 'GET'
  });
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;
    let errorData: any = {};
    
    try {
      errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If we can't parse error as JSON, use default message
    }
    
    console.error(`API Error: ${errorMessage}`, {
      status: response.status,
      data: errorData,
      url,
      options,
      hasToken: !!token,
    });
    
    throw new Error(errorMessage);
  }

  console.log(`[apiFetcher] Success: ${url}`, { status: response.status });
  return response.json();
}; 