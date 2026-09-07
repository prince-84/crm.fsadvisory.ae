export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');

// Default fallback token for active UI session bootstrap (Faraz Shafi - Super Admin)
export const DEFAULT_CRM_TOKEN = 'fsa_admin_SoV0AEsvUjupEOBRx11Wqr23525pUGofvmxGttz6jLDsKME0hT';

export async function fetchApi(endpoint: string, options: RequestInit = {}, isRetry: boolean = false): Promise<any> {
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace(/^\/api/, '');
  }

  // Retrieve active session token from localStorage or initialize with bootstrap token
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    let stored = localStorage.getItem('crm_token');
    // If token is missing, or is an old legacy string (does not start with fsa_), heal with DEFAULT_CRM_TOKEN
    if (!stored || !stored.startsWith('fsa_')) {
      stored = DEFAULT_CRM_TOKEN;
      try {
        localStorage.setItem('crm_token', DEFAULT_CRM_TOKEN);
      } catch {}
    }
    token = stored;
  } else {
    token = DEFAULT_CRM_TOKEN;
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
    // If token was rejected as invalid or expired (401) and we haven't retried yet, heal token and retry
    if (response.status === 401 && !isRetry && typeof window !== 'undefined') {
      try {
        localStorage.setItem('crm_token', DEFAULT_CRM_TOKEN);
      } catch {}
      return fetchApi(endpoint, options, true);
    }

    const errorData = await response.json().catch(() => ({}));
    const err: any = new Error(errorData.message || `API Error: ${response.status}`);
    err.errors = errorData.errors;
    err.status = response.status;
    throw err;
  }

  return response.json();
}
