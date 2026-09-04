export function getCsrfToken(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfHeaders(): Record<string, string> {
    const token = getCsrfToken();
    return token ? { "x-csrf-token": token } : {};
}

// Automatically attach x-csrf-token and tenant context headers across the entire application
if (typeof window !== "undefined" && !(window as any).__csrfInterceptorInstalled) {
    (window as any).__csrfInterceptorInstalled = true;
    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const method = (init?.method || "GET").toUpperCase();
        const headers = new Headers(init?.headers || {});

        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
            const token = getCsrfToken();
            if (token && !headers.has("x-csrf-token")) {
                headers.set("x-csrf-token", token);
            }
        }

        const activeWsId = localStorage.getItem("activeWorkspaceId");
        if (activeWsId && !headers.has("x-workspace-id")) {
            headers.set("x-workspace-id", activeWsId);
        }

        init = { ...init, headers };
        return originalFetch.call(this, input, init);
    };
}
