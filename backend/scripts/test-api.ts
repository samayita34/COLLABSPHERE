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
    
    // Quick and dirty cookie extraction
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
let userAData: any = {};
let userBData: any = {};
let orgData: any = {};
let workspaceData: any = {};
let projectData: any = {};

test('1. Signup User A', async () => {
    const res = await fetchApi('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
            firstName: 'Alice',
            lastName: 'Test',
            email: 'alice@example.com',
            password: 'password123'
        })
    });
    // Might be 409 if already exists, that's fine for re-runs
    if (res.status === 201) {
        userACookies = res.cookies;
        userAData = res.data.data;
    } else if (res.status === 409) {
        const loginRes = await fetchApi('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'alice@example.com', password: 'password123' })
        });
        userACookies = loginRes.cookies;
        userAData = loginRes.data.data;
    }
    assert.ok(userACookies.includes('accessToken'));
});

test('2. Duplicate signup', async () => {
    const res = await fetchApi('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
            firstName: 'Alice',
            lastName: 'Test',
            email: 'alice@example.com',
            password: 'password123'
        })
    });
    assert.strictEqual(res.status, 409);
});

test('3. Invalid login', async () => {
    const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'alice@example.com', password: 'wrongpassword' })
    });
    assert.strictEqual(res.status, 401);
});

test('4. GET /auth/me', async () => {
    const res = await fetchApi('/auth/me', {
        headers: { Cookie: userACookies }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.email, 'alice@example.com');
});

test('5. Signup User B', async () => {
    const res = await fetchApi('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
            firstName: 'Bob',
            lastName: 'Test',
            email: 'bob@example.com',
            password: 'password123'
        })
    });
    if (res.status === 201) {
        userBCookies = res.cookies;
        userBData = res.data.data;
    } else if (res.status === 409) {
        const loginRes = await fetchApi('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'bob@example.com', password: 'password123' })
        });
        userBCookies = loginRes.cookies;
        userBData = loginRes.data.data;
    }
    assert.ok(userBCookies.includes('accessToken'));
});

test('6. Create Organization (User A)', async () => {
    const res = await fetchApi('/organizations', {
        method: 'POST',
        headers: { Cookie: userACookies },
        body: JSON.stringify({ name: 'Alice Org', slug: 'alice-org-' + Date.now() })
    });
    assert.strictEqual(res.status, 201);
    orgData = res.data.organization;
});

test('7. Create Workspace (User A)', async () => {
    const res = await fetchApi('/workspaces', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-organization-id': orgData.id },
        body: JSON.stringify({ name: 'Alice WS', slug: 'alice-ws-' + Date.now(), organizationId: orgData.id })
    });
    assert.strictEqual(res.status, 201);
    workspaceData = res.data.workspace;
});

test('8. Create Project (User A)', async () => {
    const res = await fetchApi('/projects', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id },
        body: JSON.stringify({ name: 'Project Alpha', workspaceId: workspaceData.id })
    });
    assert.strictEqual(res.status, 201);
    projectData = res.data.project;
});

test('9. User B cannot access User A Workspace', async () => {
    const res = await fetchApi(`/workspaces/${workspaceData.id}`, {
        headers: { Cookie: userBCookies }
    });
    assert.strictEqual(res.status, 403);
});

test('10. User B cannot access User A Organization', async () => {
    const res = await fetchApi(`/organizations/${orgData.id}`, {
        headers: { Cookie: userBCookies }
    });
    assert.strictEqual(res.status, 403);
});

test('11. User B cannot access User A Project', async () => {
    const res = await fetchApi(`/projects/${projectData.id}`, {
        headers: { Cookie: userBCookies, 'x-workspace-id': workspaceData.id }
    });
    assert.strictEqual(res.status, 403);
});

test('12. Add Workspace Member (User B)', async () => {
    const res = await fetchApi(`/workspaces/${workspaceData.id}/members`, {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id },
        body: JSON.stringify({ email: 'bob@example.com', role: 'MEMBER' })
    });
    // Assuming 200/201 or 409 if exists. Wait, it'll fail if already exists. Let's just pass if it's 200 or 409
    assert.ok(res.status === 200 || res.status === 201 || res.status === 409);
});

test('13. User B can now access User A Workspace', async () => {
    const res = await fetchApi(`/workspaces/${workspaceData.id}`, {
        headers: { Cookie: userBCookies, 'x-workspace-id': workspaceData.id }
    });
    assert.strictEqual(res.status, 200);
});

test('14. User B (MEMBER) cannot update Workspace', async () => {
    const res = await fetchApi(`/workspaces/${workspaceData.id}`, {
        method: 'PUT',
        headers: { Cookie: userBCookies, 'x-workspace-id': workspaceData.id },
        body: JSON.stringify({ name: 'Hacked WS' })
    });
    assert.strictEqual(res.status, 403);
});

test('16. User A can fetch authorized workspace messages', async () => {
    const res = await fetchApi(`/workspaces/${workspaceData.id}/messages`, {
        headers: { Cookie: userACookies, 'x-workspace-id': workspaceData.id }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data));
});

test('17. User B (before membership) cannot fetch unauthorized workspace messages', async () => {
    // Create an isolated workspace that User B is not a member of
    const unauthWsRes = await fetchApi('/workspaces', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-organization-id': orgData.id },
        body: JSON.stringify({ name: 'Private WS', slug: 'private-ws-' + Date.now(), organizationId: orgData.id })
    });
    assert.strictEqual(unauthWsRes.status, 201);
    const privateWsId = unauthWsRes.data.workspace.id;

    const res = await fetchApi(`/workspaces/${privateWsId}/messages`, {
        headers: { Cookie: userBCookies, 'x-workspace-id': privateWsId }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
});

