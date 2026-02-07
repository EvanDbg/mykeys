/**
 * SQLite 存储实现
 * 使用 better-sqlite3 实现本地持久化存储
 */

import Database from 'better-sqlite3';
import type { IStorage, SecretRow, SessionData } from './storage';

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

export class SqliteStorage implements IStorage {
    private db: Database.Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
    }

    async init(): Promise<void> {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        site TEXT DEFAULT '',
        account TEXT DEFAULT '',
        password TEXT DEFAULT '',
        extra TEXT,
        expires_at DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        user_id INTEGER PRIMARY KEY,
        step TEXT,
        data TEXT,
        updated_at DATETIME
      )
    `);
    }

    async getSecret(id: number): Promise<SecretRow | null> {
        const stmt = this.db.prepare('SELECT * FROM secrets WHERE id = ?');
        return (stmt.get(id) as SecretRow | undefined) || null;
    }

    async getAllSecrets(): Promise<SecretRow[]> {
        const stmt = this.db.prepare(
            'SELECT * FROM secrets ORDER BY created_at DESC'
        );
        return stmt.all() as SecretRow[];
    }

    async searchSecrets(keyword: string, limit = 5): Promise<SecretRow[]> {
        const stmt = this.db.prepare(
            'SELECT id, name, site FROM secrets WHERE name LIKE ? OR site LIKE ? LIMIT ?'
        );
        return stmt.all(`%${keyword}%`, `%${keyword}%`, limit) as SecretRow[];
    }

    async getExpiringSecrets(days: number): Promise<SecretRow[]> {
        const stmt = this.db.prepare(`
      SELECT name, expires_at FROM secrets 
      WHERE expires_at IS NOT NULL 
        AND expires_at <= date('now', '+${days} days')
    `);
        return stmt.all() as SecretRow[];
    }

    async saveSecret(
        data: Omit<SecretRow, 'id' | 'created_at'>
    ): Promise<number> {
        const stmt = this.db.prepare(`
      INSERT INTO secrets (name, site, account, password, extra, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(
            data.name,
            data.site,
            data.account,
            data.password,
            data.extra,
            data.expires_at
        );
        return result.lastInsertRowid as number;
    }

    async updateSecretExpiry(id: number, expiresAt: string | null): Promise<void> {
        const stmt = this.db.prepare(
            'UPDATE secrets SET expires_at = ? WHERE id = ?'
        );
        stmt.run(expiresAt, id);
    }

    async deleteSecret(id: number): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM secrets WHERE id = ?');
        stmt.run(id);
    }

    async getSession(userId: number): Promise<SessionData> {
        const stmt = this.db.prepare(
            'SELECT data, updated_at FROM sessions WHERE user_id = ?'
        );
        const row = stmt.get(userId) as
            | { data: string; updated_at: string }
            | undefined;
        if (!row) return { step: 'idle' };

        const elapsed = Date.now() - new Date(row.updated_at).getTime();
        if (elapsed > SESSION_TIMEOUT_MS) return { step: 'idle' };

        return JSON.parse(row.data);
    }

    async setSession(userId: number, data: SessionData): Promise<void> {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (user_id, step, data, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
        stmt.run(userId, data.step, JSON.stringify(data));
    }

    async clearSession(userId: number): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
        stmt.run(userId);
    }

    close(): void {
        this.db.close();
    }
}
