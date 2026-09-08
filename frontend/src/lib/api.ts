export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace(/^\/api/, '');
  }

  // Retrieve active session token from localStorage
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('crm_token');
  }

  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const defaultHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...authHeaders,
  };
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const url = `${API_BASE_URL}${cleanEndpoint}`;
  const response = await fetch(url, {
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    // If token is invalid or expired (401), clear session and route to login
    if (response.status === 401 && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
      } catch {}
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const errorData = await response.json().catch(() => ({}));
    const err: any = new Error(errorData.message || `API Error: ${response.status}`);
    err.errors = errorData.errors;
    err.status = response.status;
    throw err;
  }

  return response.json();
}
