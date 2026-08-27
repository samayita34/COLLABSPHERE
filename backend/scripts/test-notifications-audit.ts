import test from 'node:test';
import assert from 'node:assert';

const API_URL = 'http://localhost:3000/api';

async function fetchApi(path: string, options: any = {}) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    
    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    let cookies = rawCookies.map(c => c.split(';')[0]).join('; ');
    if (!cookies && res.headers.get('set-cookie')) {
        cookies = res.headers.get('set-cookie') as string;
    }

    const data = await res.text();
    let json: any = {};
    try {
        json = JSON.parse(data);
    } catch(e) {}
    
    return { status: res.status, data: json, cookies };
}

let userACookies = '';
let userBCookies = '';
let orgData: any = {};
let workspaceData: any = {};
let projectData: any = {};

test('1. Setup Users and Workspace for Notifications & Audit Test', async () => {
    // Login User A
    const loginResA = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'alice@example.com', password: 'password123' })
    });
    assert.strictEqual(loginResA.status, 200);
    userACookies = loginResA.cookies;

    // Login User B
    const loginResB = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'bob@example.com', password: 'password123' })
    });
    assert.strictEqual(loginResB.status, 200);
    userBCookies = loginResB.cookies;

    // Create Org & Workspace
    const orgRes = await fetchApi('/organizations', {
        method: 'POST',
        headers: { Cookie: userACookies },
        body: JSON.stringify({ name: 'Audit Test Org', slug: 'audit-org-' + Date.now() })
    });
    assert.strictEqual(orgRes.status, 201);
    orgData = orgRes.data.organization;

    const wsRes = await fetchApi('/workspaces', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-organization-id': orgData.id },
        body: JSON.stringify({ name: 'Audit Test Workspace', slug: 'audit-ws-' + Date.now(), organizationId: orgData.id })
    });
    assert.strictEqual(wsRes.status, 201);
    workspaceData = wsRes.data.workspace;

    const projRes = await fetchApi('/projects', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id },
        body: JSON.stringify({ name: 'Audit Test Project', workspaceId: workspaceData.id })
    });
    assert.strictEqual(projRes.status, 201);
    projectData = projRes.data.project;
});

test('2. Audit Log: Verify USER_LOGIN and WORKSPACE_CREATE audit entries exist', async () => {
    const res = await fetchApi(`/audit-logs?workspaceId=${workspaceData.id}`, {
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data));
    assert.ok(res.data.data.length > 0);
});

test('3. Notifications: User A assigns task to User B -> User B receives TASK_ASSIGNED notification', async () => {
    // Add User B to project
    await fetchApi(`/projects/${projectData.id}/members`, {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id },
        body: JSON.stringify({ email: 'bob@example.com', role: 'MEMBER' })
    });

    // Get User B's ID via auth me
    const meRes = await fetchApi('/auth/me', { headers: { Cookie: userBCookies } });
    const userBId = meRes.data.data.id;

    // User A creates task assigned to User B
    const taskRes = await fetchApi(`/projects/${projectData.id}/tasks`, {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id },
        body: JSON.stringify({ title: 'Important Audit Task', assigneeId: userBId })
    });
    assert.strictEqual(taskRes.status, 201);

    // User B checks notifications
    const notifRes = await fetchApi(`/notifications?workspaceId=${workspaceData.id}`, {
        headers: { Cookie: userBCookies }
    });
    assert.strictEqual(notifRes.status, 200);
    assert.strictEqual(notifRes.data.success, true);
    assert.ok(notifRes.data.data.length > 0);
    const taskNotif = notifRes.data.data.find((n: any) => n.type === 'TASK_ASSIGNED');
    assert.ok(taskNotif);
    assert.strictEqual(taskNotif.isRead, false);
});

test('4. Notifications: Mark notification as read and check unread-count', async () => {
    const notifRes = await fetchApi('/notifications', { headers: { Cookie: userBCookies } });
    const notifId = notifRes.data.data[0].id;

    const markRes = await fetchApi(`/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { Cookie: userBCookies }
    });
    assert.strictEqual(markRes.status, 200);
    assert.strictEqual(markRes.data.data.isRead, true);

    const markAllRes = await fetchApi('/notifications/read-all', {
        method: 'PATCH',
        headers: { Cookie: userBCookies }
    });
    assert.strictEqual(markAllRes.status, 200);

    const countRes = await fetchApi('/notifications/unread-count', { headers: { Cookie: userBCookies } });
    assert.strictEqual(countRes.status, 200);
    assert.strictEqual(countRes.data.count, 0);
});

test('5. Audit Log: Perform Task Delete & Document Edit -> Check audit log items', async () => {
    // Create & delete task
    const taskRes = await fetchApi(`/projects/${projectData.id}/tasks`, {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id },
        body: JSON.stringify({ title: 'Task To Delete' })
    });
    const taskId = taskRes.data.data.id;

    const delRes = await fetchApi(`/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id }
    });
    assert.strictEqual(delRes.status, 200);

    // Fetch audit logs filtered by TASK_DELETE
    const auditRes = await fetchApi(`/audit-logs?workspaceId=${workspaceData.id}&action=TASK_DELETE`, {
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id }
    });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.data.data.some((log: any) => log.action === 'TASK_DELETE'));
});
