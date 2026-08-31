import { getCsrfHeaders } from "./apiUtils";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface Organization {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * GET /api/organizations
 * Fetch the list of organizations the authenticated user belongs to.
 */
export async function fetchOrganizations(): Promise<Organization[]> {
    const res = await fetch(`${API_BASE_URL}/organizations`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch organizations (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.organizations)) {
        throw new Error(json.error || "Invalid response format from organizations API");
    }
    return json.organizations;
}

/**
 * POST /api/organizations
 * Create a new organization.
 */
export async function createOrganizationApi(name: string, slug: string): Promise<Organization> {
    const res = await fetch(`${API_BASE_URL}/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ name, slug }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to create organization (HTTP ${res.status})`);
    }
    return json.organization;
}
