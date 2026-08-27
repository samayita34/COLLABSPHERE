import { Request } from "express";

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

export enum UnifiedRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    ORGANIZATION_ADMIN = "ORGANIZATION_ADMIN",
    WORKSPACE_ADMIN = "WORKSPACE_ADMIN",
    PROJECT_MANAGER = "PROJECT_MANAGER",
    MEMBER = "MEMBER",
    GUEST = "GUEST",
}

const SUPER_ADMIN_PERMISSIONS = Object.values(Permission);

const ORGANIZATION_ADMIN_PERMISSIONS = [
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
];

const WORKSPACE_ADMIN_PERMISSIONS = [
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
];

const PROJECT_MANAGER_PERMISSIONS = [
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
];

const MEMBER_PERMISSIONS = [
    Permission.VIEW_PROJECT,
    Permission.VIEW_FILES,
    Permission.VIEW_DOCUMENTS,
    Permission.CREATE_TASK,
    Permission.EDIT_TASK,
    Permission.ASSIGN_TASK,
    Permission.EDIT_DOCUMENT,
    Permission.UPLOAD_FILES,
    Permission.SEND_MESSAGES,
];

const GUEST_PERMISSIONS = [
    Permission.VIEW_PROJECT,
    Permission.VIEW_FILES,
    Permission.VIEW_DOCUMENTS,
];

export const ROLE_PERMISSIONS: Record<UnifiedRole, Permission[]> = {
    [UnifiedRole.SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS,
    [UnifiedRole.ORGANIZATION_ADMIN]: ORGANIZATION_ADMIN_PERMISSIONS,
    [UnifiedRole.WORKSPACE_ADMIN]: WORKSPACE_ADMIN_PERMISSIONS,
    [UnifiedRole.PROJECT_MANAGER]: PROJECT_MANAGER_PERMISSIONS,
    [UnifiedRole.MEMBER]: MEMBER_PERMISSIONS,
    [UnifiedRole.GUEST]: GUEST_PERMISSIONS,
};

/**
 * Determines the highest unified role the user holds in the current request context.
 */
export function getActiveRole(req: Request): UnifiedRole {
    // 1. Global Super Admin bypasses all checks
    if (req.user?.role === "SUPER_ADMIN") {
        return UnifiedRole.SUPER_ADMIN;
    }

    // 2. Organization level
    if (req.orgRole === "ORG_ADMIN") {
        return UnifiedRole.ORGANIZATION_ADMIN;
    }

    // 3. Workspace level
    if (req.workspaceRole === "WORKSPACE_ADMIN") {
        return UnifiedRole.WORKSPACE_ADMIN;
    }

    // 4. Project level
    if (req.projectRole === "ADMIN") {
        return UnifiedRole.PROJECT_MANAGER;
    }
    
    if (req.projectRole === "VIEWER") {
        return UnifiedRole.GUEST;
    }

    // Fallback: If they are any kind of member (Org Member, Workspace Member, Project Member)
    // they get the base MEMBER role.
    if (req.projectRole === "MEMBER" || req.workspaceRole === "MEMBER" || req.orgRole === "MEMBER") {
        return UnifiedRole.MEMBER;
    }

    // Default to guest if no roles match but they somehow reached here
    return UnifiedRole.GUEST;
}

/**
 * Core permission check helper.
 * Returns true if the user's active role grants them the requested permission.
 */
export function hasPermission(req: Request, permission: Permission): boolean {
    const activeRole = getActiveRole(req);
    const permissionsForRole = ROLE_PERMISSIONS[activeRole] || [];
    return permissionsForRole.includes(permission);
}
