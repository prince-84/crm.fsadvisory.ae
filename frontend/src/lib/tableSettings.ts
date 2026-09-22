import { fetchApi } from './api';

// Debounce timer registry for each table
const debounceTimers: Record<string, any> = {};

export interface GlobalTableSettings {
  visibility: Record<string, boolean> | null;
  order: string[] | null;
}

/**
 * Fetch global column settings from the database for a specific table.
 */
export async function getGlobalColumnSettings(tableName: string): Promise<GlobalTableSettings | null> {
  try {
    const res = await fetchApi(`/table-columns/${tableName}`);
    if (res && res.success) {
      return {
        visibility: res.visibility && typeof res.visibility === 'object' ? res.visibility : null,
        order: Array.isArray(res.order) ? res.order : null,
      };
    }
  } catch (err) {
    console.warn(`[TableSettings] Could not fetch global column settings for '${tableName}':`, err);
  }
  return null;
}

/**
 * Save global column settings to the database with a 600ms debounce.
 * This guarantees changes made by any user or browser persist globally across the entire CRM.
 */
export function saveGlobalColumnSettings(
  tableName: string,
  settings: {
    visibility?: Record<string, boolean> | null;
    order?: string[] | null;
  }
) {
  if (debounceTimers[tableName]) {
    clearTimeout(debounceTimers[tableName]);
  }

  debounceTimers[tableName] = setTimeout(async () => {
    try {
      await fetchApi(`/table-columns/${tableName}`, {
        method: 'POST',
        body: JSON.stringify({
          visibility: settings.visibility,
          order: settings.order,
        }),
      });
    } catch (err) {
      console.warn(`[TableSettings] Failed to save global column settings for '${tableName}':`, err);
    }
  }, 600);
}
