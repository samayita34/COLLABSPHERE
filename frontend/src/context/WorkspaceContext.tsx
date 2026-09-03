import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { fetchOrganizations, type Organization } from "../services/orgApi";
import { fetchWorkspaces, fetchUserWorkspaces, type Workspace } from "../services/workspaceApi";
import { useAuth } from "./AuthContext";

interface WorkspaceContextValue {
  organizations: Organization[];
  workspaces: Record<string, Workspace[]>;
  activeOrganization: Organization | null;
  activeWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  switchWorkspace: (workspaceId: string) => void;
  refreshContext: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, Workspace[]>>({});
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) {
      setOrganizations([]);
      setWorkspaces({});
      setActiveOrganization(null);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch user's workspaces directly based on WorkspaceMember
      const userWorkspaces = await fetchUserWorkspaces().catch((err) => {
        console.error("Failed to fetch user workspaces", err);
        return [] as Workspace[];
      });

      // 2. Also fetch organizations
      let orgs: Organization[] = [];
      try {
        orgs = await fetchOrganizations();
      } catch (err) {
        console.error("Failed to fetch organizations", err);
      }

      // 3. Merge any organizations attached to user workspaces
      const orgMap = new Map<string, Organization>();
      for (const org of orgs) {
        orgMap.set(org.id, org);
      }
      for (const ws of userWorkspaces) {
        const wsOrg = ws.organization;
        if (wsOrg && !orgMap.has(wsOrg.id)) {
          orgMap.set(wsOrg.id, wsOrg as Organization);
        } else if (ws.organizationId && !orgMap.has(ws.organizationId)) {
          orgMap.set(ws.organizationId, {
            id: ws.organizationId,
            name: "Organization",
            slug: "organization",
            createdAt: ws.createdAt,
            updatedAt: ws.updatedAt,
          });
        }
      }

      const combinedOrgs = Array.from(orgMap.values());
      setOrganizations(combinedOrgs);

      // 4. Map user workspaces by organizationId
      const workspacesMap: Record<string, Workspace[]> = {};
      for (const org of combinedOrgs) {
        workspacesMap[org.id] = userWorkspaces.filter((w) => w.organizationId === org.id);
      }

      // If any organization had no userWorkspaces fetched yet, try fetchWorkspaces(org.id)
      await Promise.all(
        combinedOrgs.map(async (org) => {
          if (!workspacesMap[org.id] || workspacesMap[org.id].length === 0) {
            try {
              const wsList = await fetchWorkspaces(org.id);
              if (wsList && wsList.length > 0) {
                workspacesMap[org.id] = wsList;
              }
            } catch {
              // Ignore if no extra workspaces found
            }
          }
        })
      );

      setWorkspaces(workspacesMap);

      // 5. Flatten and deduplicate all accessible workspaces
      const allAccessibleWorkspaces: Workspace[] = [];
      for (const orgId in workspacesMap) {
        allAccessibleWorkspaces.push(...workspacesMap[orgId]);
      }
      const uniqueWorkspaces = Array.from(
        new Map(allAccessibleWorkspaces.map((w) => [w.id, w])).values()
      );

      // 6. Current workspace selection & localStorage resolution
      const savedWorkspaceId = localStorage.getItem("activeWorkspaceId");
      let restoredWorkspace: Workspace | null = null;
      let restoredOrg: Organization | null = null;

      if (savedWorkspaceId) {
        restoredWorkspace = uniqueWorkspaces.find((w) => w.id === savedWorkspaceId) || null;
        if (restoredWorkspace) {
          restoredOrg =
            combinedOrgs.find((o) => o.id === restoredWorkspace!.organizationId) ||
            (restoredWorkspace.organization ? (restoredWorkspace.organization as Organization) : null);
        }
      }

      if (restoredWorkspace && restoredOrg) {
        setActiveWorkspace(restoredWorkspace);
        setActiveOrganization(restoredOrg);
      } else if (uniqueWorkspaces.length > 0) {
        const firstWorkspace = uniqueWorkspaces[0];
        const matchingOrg =
          combinedOrgs.find((o) => o.id === firstWorkspace.organizationId) ||
          (firstWorkspace.organization ? (firstWorkspace.organization as Organization) : null);
        setActiveWorkspace(firstWorkspace);
        setActiveOrganization(matchingOrg);
        localStorage.setItem("activeWorkspaceId", firstWorkspace.id);
      } else {
        setActiveWorkspace(null);
        setActiveOrganization(null);
        localStorage.removeItem("activeWorkspaceId");
      }
    } catch (err: any) {
      console.error("Failed to load workspace context", err);
      setError(err.message || "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const switchWorkspace = (workspaceId: string) => {
    for (const org of organizations) {
      const ws = workspaces[org.id]?.find((w: Workspace) => w.id === workspaceId);
      if (ws) {
        setActiveWorkspace(ws);
        setActiveOrganization(org);
        localStorage.setItem("activeWorkspaceId", ws.id);
        break;
      }
    }
  };

  const refreshContext = async () => {
    await loadData();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        organizations,
        workspaces,
        activeOrganization,
        activeWorkspace,
        loading,
        error,
        switchWorkspace,
        refreshContext,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
