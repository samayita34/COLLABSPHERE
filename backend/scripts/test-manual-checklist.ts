import test from 'node:test';
import assert from 'node:assert';
import { io as Client, Socket } from 'socket.io-client';

const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

async function fetchApi(path: string, options: any = {}): Promise<{ status: number; data: any; cookies: string }> {
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
    } catch (e) {}

    return { status: res.status, data: json, cookies };
}

let userACookies = '';
let userBCookies = '';
let ws1Data: any = {};
let ws2Data: any = {};
let proj1Data: any = {};
let proj2Data: any = {};
let orgData: any = {};
let sentMsgId = '';
const timestampMarker = `TEST_MSG_${Date.now()}`;

test('Test 1 — Setup User & Workspaces for Manual Checklist', async () => {
    // 1. Signup / Login User A
    const loginResA = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'alice@example.com', password: 'password123' })
    });
    assert.strictEqual(loginResA.status, 200);
    userACookies = loginResA.cookies;

    // 2. Signup / Login User B
    const loginResB = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'bob@example.com', password: 'password123' })
    });
    assert.strictEqual(loginResB.status, 200);
    userBCookies = loginResB.cookies;

    // 3. Create Org
    const orgRes = await fetchApi('/organizations', {
        method: 'POST',
        headers: { Cookie: userACookies },
        body: JSON.stringify({ name: 'Manual Test Org', slug: 'manual-test-org-' + Date.now() })
    });
    assert.strictEqual(orgRes.status, 201);
    orgData = orgRes.data.organization;

    // 4. Create Workspace 1
    const ws1Res = await fetchApi('/workspaces', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-organization-id': orgData.id },
        body: JSON.stringify({ name: 'Alpha Workspace', slug: 'alpha-ws-' + Date.now(), organizationId: orgData.id })
    });
    assert.strictEqual(ws1Res.status, 201);
    ws1Data = ws1Res.data.workspace;

    // 5. Create Workspace 2
    const ws2Res = await fetchApi('/workspaces', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-organization-id': orgData.id },
        body: JSON.stringify({ name: 'Beta Workspace', slug: 'beta-ws-' + Date.now(), organizationId: orgData.id })
    });
    assert.strictEqual(ws2Res.status, 201);
    ws2Data = ws2Res.data.workspace;

    // 6. Create Project 1 in WS1
    const proj1Res = await fetchApi('/projects', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id },
        body: JSON.stringify({ name: 'Alpha Mobile App', code: 'MOB', workspaceId: ws1Data.id })
    });
    assert.strictEqual(proj1Res.status, 201);
    proj1Data = proj1Res.data.project;

    // 7. Create Project 2 in WS2
    const proj2Res = await fetchApi('/projects', {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': ws2Data.id },
        body: JSON.stringify({ name: 'Beta Cloud API', code: 'CLD', workspaceId: ws2Data.id })
    });
    assert.strictEqual(proj2Res.status, 201);
    proj2Data = proj2Res.data.project;
});

test('Test 1 — Messages page: Loads messages successfully', async () => {
    const res = await fetchApi(`/workspaces/${ws1Data.id}/messages`, {
        headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data));
});

test('Test 9 & Test 7 — Project Workspace: Send message, persistence, and fetch in Global Messages', async () => {
    // Send message from Project 1
    const msgText = `Hello team! Review requested before deployment ${timestampMarker}`;
    const sendRes = await fetchApi(`/projects/${proj1Data.id}/messages`, {
        method: 'POST',
        headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id },
        body: JSON.stringify({ text: msgText, senderInitials: 'AT' })
    });
    assert.strictEqual(sendRes.status, 201);
    assert.strictEqual(sendRes.data.success, true);
    sentMsgId = sendRes.data.data.id;
    assert.ok(sentMsgId);

    // Verify persistence & retrieval from project chat endpoint
    const projChatRes = await fetchApi(`/projects/${proj1Data.id}/messages`, {
        headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id }
    });
    assert.strictEqual(projChatRes.status, 200);
    const foundInProj = projChatRes.data.data.some((m: any) => m.id === sentMsgId);
    assert.strictEqual(foundInProj, true, 'Message should persist in project workspace chat');

    // Verify retrieval from Global Messages endpoint
    const globalMsgRes = await fetchApi(`/workspaces/${ws1Data.id}/messages`, {
        headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id }
    });
    assert.strictEqual(globalMsgRes.status, 200);
    const foundInGlobal = globalMsgRes.data.data.some((m: any) => m.id === sentMsgId);
    assert.strictEqual(foundInGlobal, true, 'Message should appear in Global Messages view');
});

test('Test 2 — Workspace isolation: Messages do not bleed across workspaces', async () => {
    const ws2MsgRes = await fetchApi(`/workspaces/${ws2Data.id}/messages`, {
        headers: { Cookie: userACookies, 'x-workspace-id': ws2Data.id }
    });
    assert.strictEqual(ws2MsgRes.status, 200);
    const leakedMsg = ws2MsgRes.data.data.some((m: any) => m.id === sentMsgId);
    assert.strictEqual(leakedMsg, false, 'Message from WS1 must not leak into WS2 feed');
});

test('Test 3 & 4 — Search & Project filter metadata integrity', async () => {
    const res = await fetchApi(`/workspaces/${ws1Data.id}/messages`, {
        headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id }
    });
    const targetMsg = res.data.data.find((m: any) => m.id === sentMsgId);
    assert.ok(targetMsg);
    assert.strictEqual(targetMsg.projectName, 'Alpha Mobile App');
    assert.strictEqual(targetMsg.projectCode, 'MOB');
    assert.ok(targetMsg.text.includes(timestampMarker));
});

test('Test 5 — Project navigation target verification', async () => {
    const res = await fetchApi(`/projects/${proj1Data.id}`, {
        headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.project.id, proj1Data.id);
});

test('Test 6 — Real-time Socket.IO newMessage broadcast', async () => {
    return new Promise<void>((resolve, reject) => {
        const clientSocket: Socket = Client(SOCKET_URL, {
            transports: ['websocket'],
            forceNew: true
        });

        const socketMsgMarker = `SOCKET_LIVE_${Date.now()}`;

        clientSocket.on('connect', () => {
            // Join room for proj1
            clientSocket.emit('joinProject', proj1Data.id);

            clientSocket.on('newMessage', (msg: any) => {
                try {
                    assert.strictEqual(msg.projectId, proj1Data.id);
                    assert.ok(msg.text.includes(socketMsgMarker));
                    assert.strictEqual(msg.projectName, 'Alpha Mobile App');
                    assert.strictEqual(msg.projectCode, 'MOB');
                    clientSocket.disconnect();
                    resolve();
                } catch (err) {
                    clientSocket.disconnect();
                    reject(err);
                }
            });

            // Send message via API (simulating Window A)
            fetchApi(`/projects/${proj1Data.id}/messages`, {
                method: 'POST',
                headers: { Cookie: userACookies, 'x-workspace-id': ws1Data.id },
                body: JSON.stringify({ text: `Realtime test message ${socketMsgMarker}`, senderInitials: 'AT' })
            });
        });

        clientSocket.on('connect_error', (err: any) => {
            clientSocket.disconnect();
            reject(err);
        });
    });
});

test('Test 8 — Unauthorized workspace: Requesting unauthorized workspace returns 403', async () => {
    // User B creates their own isolated organization & workspace
    const orgBRes = await fetchApi('/organizations', {
        method: 'POST',
        headers: { Cookie: userBCookies },
        body: JSON.stringify({ name: 'User B Org', slug: 'user-b-org-' + Date.now() })
    });
    assert.strictEqual(orgBRes.status, 201);
    const orgBId = orgBRes.data.organization.id;

    const privateWsRes = await fetchApi('/workspaces', {
        method: 'POST',
        headers: { Cookie: userBCookies },
        body: JSON.stringify({ name: 'Private WS User B', slug: 'private-b-' + Date.now(), organizationId: orgBId })
    });
    assert.strictEqual(privateWsRes.status, 201);
    const privateWsId = privateWsRes.data.workspace.id;

    // User A attempts to request User B's private workspace messages
    const res = await fetchApi(`/workspaces/${privateWsId}/messages`, {
        headers: { Cookie: userACookies, 'x-workspace-id': privateWsId }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
});
