const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface UserProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
    role: string;
    isEmailVerified: boolean;
    isGoogleUser: boolean;
    createdAt: string;
    updatedAt: string;
}

export async function loginApi(email: string, password: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Login failed (HTTP ${res.status})`);
    }
    return json.data;
}

export async function signupApi(name: string, email: string, password: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Sign up failed (HTTP ${res.status})`);
    }
    return json.data;
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let res = await fetch(url, options);
    
    if (res.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login') && !url.includes('/auth/logout')) {
        if (!isRefreshing) {
            isRefreshing = true;
            refreshPromise = refreshSessionApi().finally(() => {
                isRefreshing = false;
                refreshPromise = null;
            });
        }
        
        if (refreshPromise) {
            try {
                await refreshPromise;
                // Retry the original request if refresh succeeded
                res = await fetch(url, options);
            } catch (err) {
                // If refresh fails, we just return the original 401 response
                // so the application can handle the logged-out state naturally.
            }
        }
    }
    
    return res;
}

export async function getMeApi(): Promise<UserProfile> {
    const res = await fetchWithAuth(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to fetch authenticated session (HTTP ${res.status})`);
    }
    return json.data;
}

export async function logoutApi(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Logout failed (HTTP ${res.status})`);
    }
}

export async function forgotPasswordApi(email: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Request failed (HTTP ${res.status})`);
    }
    return json;
}

export async function resetPasswordApi(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Reset failed (HTTP ${res.status})`);
    }
    return json;
}

export async function verifyEmailApi(token: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Verification failed (HTTP ${res.status})`);
    }
    return json;
}

export async function refreshSessionApi(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        throw new Error(`Session refresh failed`);
    }
}
