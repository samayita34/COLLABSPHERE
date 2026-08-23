const API_BASE_URL = "http://localhost:3000/api";

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

export async function getMeApi(): Promise<UserProfile> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
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
