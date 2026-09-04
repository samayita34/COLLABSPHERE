import { fetchWithAuth } from "./authApi";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface TeamMemberUser {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
}

export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    user: TeamMemberUser;
    createdAt: string;
}

export interface Team {
    id: string;
    workspaceId: string;
    name: string;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
    members: TeamMember[];
}

export async function fetchWorkspaceTeams(workspaceId: string): Promise<Team[]> {
    const res = await fetchWithAuth(`${API_BASE_URL}/teams/workspace/${workspaceId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to fetch teams (HTTP ${res.status})`);
    }
    return json.teams || [];
}

export async function createTeamApi(workspaceId: string, name: string, description?: string): Promise<Team> {
    const res = await fetchWithAuth(`${API_BASE_URL}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId, name, description }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to create team (HTTP ${res.status})`);
    }
    return json.team;
}

export async function addTeamMemberApi(teamId: string, userId: string): Promise<TeamMember> {
    const res = await fetchWithAuth(`${API_BASE_URL}/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to add member to team (HTTP ${res.status})`);
    }
    return json.member;
}

export async function removeTeamMemberApi(teamId: string, targetUserId: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE_URL}/teams/${teamId}/members/${targetUserId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to remove member from team (HTTP ${res.status})`);
    }
}

export async function deleteTeamApi(teamId: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE_URL}/teams/${teamId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to delete team (HTTP ${res.status})`);
    }
}
