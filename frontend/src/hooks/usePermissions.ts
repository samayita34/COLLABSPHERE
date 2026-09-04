import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

export type UnifiedRole =
    | "SUPER_ADMIN"
    | "ORGANIZATION_ADMIN"
    | "WORKSPACE_ADMIN"
    | "PROJECT_MANAGER"
    | "MEMBER"
    | "GUEST";

export enum Permission {
    MANAGE_USERS = "MANAGE_USERS",
    MANAGE_ORGANIZATION = "MANAGE_ORGANIZATION",
    MANAGE_WORKSPACE = "MANAGE_WORKSPACE",
    DELETE_WORKSPACE = "DELETE_WORKSPACE",
    MANAGE_PROJECTS = "MANAGE_PROJECTS",
    CREATE_PROJECT = "CREATE_PROJECT",
    EDIT_PROJECT = "EDIT_PROJECT",
    DELETE_PROJECT = "DELETE_PROJECT",
    INVITE_MEMBERS = "INVITE_MEMBERS",
    REMOVE_MEMBERS = "REMOVE_MEMBERS",
    CHANGE_ROLES = "CHANGE_ROLES",
    CREATE_TASK = "CREATE_TASK",
    EDIT_TASK = "EDIT_TASK",
    DELETE_TASK = "DELETE_TASK",
    ASSIGN_TASK = "ASSIGN_TASK",
    EDIT_DOCUMENT = "EDIT_DOCUMENT",
    DELETE_DOCUMENT = "DELETE_DOCUMENT",
    UPLOAD_FILES = "UPLOAD_FILES",
    DELETE_FILES = "DELETE_FILES",
    VIEW_ANALYTICS = "VIEW_ANALYTICS",
    CONFIGURE_SETTINGS = "CONFIGURE_SETTINGS",
    SEND_MESSAGES = "SEND_MESSAGES",
    VIEW_PROJECT = "VIEW_PROJECT",
    VIEW_FILES = "VIEW_FILES",
    VIEW_DOCUMENTS = "VIEW_DOCUMENTS",
    VIEW_AUDIT_LOGS = "VIEW_AUDIT_LOGS",
}

const ROLE_PERMISSIONS: Record<UnifiedRole, Permission[]> = {
    SUPER_ADMIN: Object.values(Permission),
    ORGANIZATION_ADMIN: [
        Permission.MANAGE_ORGANIZATION,
        Permission.MANAGE_WORKSPACE,
        Permission.DELETE_WORKSPACE,
        Permission.MANAGE_PROJECTS,
        Permission.CREATE_PROJECT,
        Permission.EDIT_PROJECT,
        Permission.DELETE_PROJECT,
        Permission.INVITE_MEMBERS,
        Permission.REMOVE_MEMBERS,
        Permission.CHANGE_ROLES,
        Permission.VIEW_ANALYTICS,
        Permission.CONFIGURE_SETTINGS,
        Permission.VIEW_PROJECT,
        Permission.VIEW_FILES,
        Permission.VIEW_DOCUMENTS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.CREATE_TASK,
        Permission.EDIT_TASK,
        Permission.DELETE_TASK,
        Permission.ASSIGN_TASK,
        Permission.EDIT_DOCUMENT,
        Permission.DELETE_DOCUMENT,
        Permission.UPLOAD_FILES,
        Permission.DELETE_FILES,
        Permission.SEND_MESSAGES,
    ],
    WORKSPACE_ADMIN: [
        Permission.MANAGE_WORKSPACE,
        Permission.MANAGE_PROJECTS,
        Permission.CREATE_PROJECT,
        Permission.EDIT_PROJECT,
        Permission.DELETE_PROJECT,
        Permission.INVITE_MEMBERS,
        Permission.REMOVE_MEMBERS,
        Permission.CHANGE_ROLES,
        Permission.VIEW_ANALYTICS,
        Permission.CONFIGURE_SETTINGS,
        Permission.VIEW_PROJECT,
        Permission.VIEW_FILES,
        Permission.VIEW_DOCUMENTS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.CREATE_TASK,
        Permission.EDIT_TASK,
        Permission.DELETE_TASK,
        Permission.ASSIGN_TASK,
        Permission.EDIT_DOCUMENT,
        Permission.DELETE_DOCUMENT,
        Permission.UPLOAD_FILES,
        Permission.DELETE_FILES,
        Permission.SEND_MESSAGES,
    ],
    PROJECT_MANAGER: [
        Permission.EDIT_PROJECT,
        Permission.DELETE_PROJECT,
        Permission.INVITE_MEMBERS,
        Permission.REMOVE_MEMBERS,
        Permission.CHANGE_ROLES,
        Permission.VIEW_PROJECT,
        Permission.VIEW_FILES,
        Permission.VIEW_DOCUMENTS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.CREATE_TASK,
        Permission.EDIT_TASK,
        Permission.DELETE_TASK,
        Permission.ASSIGN_TASK,
        Permission.EDIT_DOCUMENT,
        Permission.DELETE_DOCUMENT,
        Permission.UPLOAD_FILES,
        Permission.DELETE_FILES,
        Permission.SEND_MESSAGES,
    ],
    MEMBER: [
        Permission.VIEW_PROJECT,
        Permission.VIEW_FILES,
        Permission.VIEW_DOCUMENTS,
        Permission.CREATE_TASK,
        Permission.EDIT_TASK,
        Permission.ASSIGN_TASK,
        Permission.EDIT_DOCUMENT,
        Permission.UPLOAD_FILES,
        Permission.SEND_MESSAGES,
    ],
    GUEST: [
        Permission.VIEW_PROJECT,
        Permission.VIEW_FILES,
        Permission.VIEW_DOCUMENTS,
    ],
};

export function usePermissions() {
    const { user } = useAuth();
    const { activeWorkspace } = useWorkspace();

    // 1. Determine active unified role
    let activeRole: UnifiedRole = "MEMBER";

    if (user?.role === "SUPER_ADMIN") {
        activeRole = "SUPER_ADMIN";
    } else if (activeWorkspace?.role === "WORKSPACE_ADMIN" || user?.role === "ORG_ADMIN") {
        activeRole = "WORKSPACE_ADMIN";
    } else if (activeWorkspace?.role === "PROJECT_MANAGER") {
        activeRole = "PROJECT_MANAGER";
    } else if (activeWorkspace?.role === "GUEST") {
        activeRole = "GUEST";
    } else {
        activeRole = "MEMBER";
    }

    const permissions = ROLE_PERMISSIONS[activeRole] || [];

    const can = (permission: Permission | keyof typeof Permission): boolean => {
        return permissions.includes(permission as Permission);
    };

    return {
        role: activeRole,
        can,
        canManageUsers: can(Permission.MANAGE_USERS) || can(Permission.INVITE_MEMBERS),
        canManageProjects: can(Permission.MANAGE_PROJECTS) || can(Permission.CREATE_PROJECT),
        canInviteMembers: can(Permission.INVITE_MEMBERS),
        canDeleteWorkspace: can(Permission.DELETE_WORKSPACE),
        canEditDocuments: can(Permission.EDIT_DOCUMENT),
        canUploadFiles: can(Permission.UPLOAD_FILES),
        canViewAnalytics: can(Permission.VIEW_ANALYTICS),
        canConfigureSettings: can(Permission.CONFIGURE_SETTINGS),
        isGuest: activeRole === "GUEST",
        isAdmin: activeRole === "SUPER_ADMIN" || activeRole === "ORGANIZATION_ADMIN" || activeRole === "WORKSPACE_ADMIN",
    };
}
