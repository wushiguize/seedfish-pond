import { createSave, validateSave, type SaveData } from './model';
export const STORAGE_KEY = 'seedfish.pond.v1';
export const LEGACY_BACKUP_KEY = `${STORAGE_KEY}.before-v2`;
export function loadSave(): { data: SaveData; warning?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: createSave() };
    const parsed: unknown = JSON.parse(raw);
    const data = validateSave(parsed);
    if ((parsed as { version?: unknown }).version === 1) {
      try {
        if (localStorage.getItem(LEGACY_BACKUP_KEY) === null) localStorage.setItem(LEGACY_BACKUP_KEY, raw);
      } catch {
        return { data, warning: '旧版存档已读取，但本机备份空间不足。请导出存档保留原有鱼的记录。' };
      }
    }
    return { data };
  } catch {
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw) localStorage.setItem(`${STORAGE_KEY}.unreadable.${Date.now()}`,raw);
      return { data:createSave(), warning:'原存档无法读取，已在本机保留原始备份，本次使用初始池塘。' };
    } catch { return { data:createSave(), warning:'存档不可用，本次使用初始池塘。请导出存档保留新记录。' }; }
  }
}
export function persist(data: SaveData): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
