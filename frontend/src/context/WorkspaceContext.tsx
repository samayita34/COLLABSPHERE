import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { fetchOrganizations, type Organization } from "../services/orgApi";
import { fetchWorkspaces, type Workspace } from "../services/workspaceApi";
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
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);

      const workspacesMap: Record<string, Workspace[]> = {};
      let firstWorkspace: Workspace | null = null;
      let matchingOrg: Organization | null = null;

      // Fetch workspaces for all organizations
      await Promise.all(
        orgs.map(async (org) => {
          try {
            const wsList = await fetchWorkspaces(org.id);
            workspacesMap[org.id] = wsList;
            if (!firstWorkspace && wsList.length > 0) {
              firstWorkspace = wsList[0];
              matchingOrg = org;
            }
          } catch (err) {
            console.error(`Failed to fetch workspaces for org ${org.id}`, err);
            workspacesMap[org.id] = [];
          }
        })
      );

      setWorkspaces(workspacesMap);

      // Restore from localStorage or pick the first available workspace
      const savedWorkspaceId = localStorage.getItem("activeWorkspaceId");
      let restoredWorkspace: Workspace | null = null;
      let restoredOrg: Organization | null = null;

      if (savedWorkspaceId) {
        for (const org of orgs) {
          const orgWorkspaces = workspacesMap[org.id] as Workspace[] | undefined;
          if (!orgWorkspaces) continue;
          
          const ws = orgWorkspaces.find((w: Workspace) => w.id === savedWorkspaceId);
          if (ws) {
            restoredWorkspace = ws;
            restoredOrg = org;
            break;
          }
        }
      }

      if (restoredWorkspace && restoredOrg) {
        setActiveWorkspace(restoredWorkspace);
        setActiveOrganization(restoredOrg);
      } else if (firstWorkspace && matchingOrg) {
        setActiveWorkspace(firstWorkspace);
        setActiveOrganization(matchingOrg);
        localStorage.setItem("activeWorkspaceId", firstWorkspace!.id);
      } else {
        setActiveWorkspace(null);
        setActiveOrganization(null);
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
