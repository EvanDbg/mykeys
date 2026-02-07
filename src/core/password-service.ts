/**
 * 密码管理业务服务
 * 与具体消息平台解耦
 */

import { encrypt, decrypt } from './crypto';
import { cleanText, parseDate, expiryInfo } from './utils';
import type { IStorage, SecretRow, SessionData } from './storage';

export interface SaveSecretInput {
    name: string;
    site: string;
    account: string;
    password: string;
    extra?: string | null;
    expiresAt?: string | null;
}

export interface SecretDetail {
    id: number;
    name: string;
    site: string;
    account?: string;
    password: string;
    extra?: string | null;
    expiresAt?: string | null;
    expiryInfo: string;
    isRaw: boolean;
}

export class PasswordService {
    constructor(
        private storage: IStorage,
        private encryptKey: string
    ) { }

    /**
     * 保存新密码条目
     */
    async saveSecret(input: SaveSecretInput): Promise<number> {
        const [encAccount, encPassword, encExtra] = await Promise.all([
            encrypt(input.account, this.encryptKey),
            encrypt(input.password, this.encryptKey),
            input.extra ? encrypt(input.extra, this.encryptKey) : null,
        ]);

        return this.storage.saveSecret({
            name: input.name,
            site: input.site,
            account: encAccount,
            password: encPassword,
            extra: encExtra,
            expires_at: input.expiresAt || null,
        });
    }

    /**
     * 保存长文本（如 SSH 密钥、证书等）
     */
    async saveLongText(
        name: string,
        content: string,
        expiresAt?: string | null
    ): Promise<number> {
        const cleaned = cleanText(content);
        const encContent = await encrypt(cleaned, this.encryptKey);

        return this.storage.saveSecret({
            name,
            site: 'raw',
            account: '',
            password: encContent,
            extra: null,
            expires_at: expiresAt || null,
        });
    }

    /**
     * 获取密码详情（解密后）
     */
    async getSecretDetail(id: number): Promise<SecretDetail | null> {
        const row = await this.storage.getSecret(id);
        if (!row) return null;

        if (row.site === 'raw') {
            return {
                id: row.id,
                name: row.name,
                site: row.site,
                password: await decrypt(row.password, this.encryptKey),
                expiresAt: row.expires_at,
                expiryInfo: expiryInfo(row.expires_at),
                isRaw: true,
            };
        }

        const [account, password, extra] = await Promise.all([
            decrypt(row.account, this.encryptKey),
            decrypt(row.password, this.encryptKey),
            row.extra ? decrypt(row.extra, this.encryptKey) : null,
        ]);

        return {
            id: row.id,
            name: row.name,
            site: row.site,
            account,
            password,
            extra,
            expiresAt: row.expires_at,
            expiryInfo: expiryInfo(row.expires_at),
            isRaw: false,
        };
    }

    /**
     * 获取所有条目列表
     */
    async getAllSecrets(): Promise<SecretRow[]> {
        return this.storage.getAllSecrets();
    }

    /**
     * 搜索密码条目
     */
    async searchSecrets(keyword: string): Promise<SecretRow[]> {
        return this.storage.searchSecrets(keyword);
    }

    /**
     * 获取即将到期的条目
     */
    async getExpiringSecrets(days = 30): Promise<SecretRow[]> {
        return this.storage.getExpiringSecrets(days);
    }

    /**
     * 更新到期时间
     */
    async updateExpiry(id: number, expiresAt: string | null): Promise<void> {
        return this.storage.updateSecretExpiry(id, expiresAt);
    }

    /**
     * 删除条目
     */
    async deleteSecret(id: number): Promise<void> {
        return this.storage.deleteSecret(id);
    }

    /**
     * 导出备份数据（解密后）
     */
    async exportBackup(): Promise<object[]> {
        const rows = await this.storage.getAllSecrets();
        return Promise.all(
            rows.map(async (x) => {
                if (x.site === 'raw') {
                    return {
                        id: x.id,
                        name: x.name,
                        type: 'raw',
                        content: await decrypt(x.password, this.encryptKey),
                        expires_at: x.expires_at,
                    };
                }
                const [account, password, extra] = await Promise.all([
                    decrypt(x.account, this.encryptKey),
                    decrypt(x.password, this.encryptKey),
                    x.extra ? decrypt(x.extra, this.encryptKey) : null,
                ]);
                return {
                    id: x.id,
                    name: x.name,
                    site: x.site,
                    account,
                    password,
                    extra,
                    expires_at: x.expires_at,
                };
            })
        );
    }

    /**
     * 获取到期提醒消息
     */
    async getExpiryReminder(): Promise<string | null> {
        const rows = await this.storage.getExpiringSecrets(7);
        if (!rows.length) return null;

        const groups: Record<string, string[]> = {
            e: [],
            t: [],
            '1': [],
            '3': [],
            '7': [],
        };

        for (const x of rows) {
            const d = Math.ceil(
                (new Date(x.expires_at!).getTime() - Date.now()) / 864e5
            );
            const key = d < 0 ? 'e' : d === 0 ? 't' : d === 1 ? '1' : d <= 3 ? '3' : '7';
            groups[key].push(`• ${x.name}`);
        }

        let msg = '';
        if (groups.e.length) msg += `⚠️ 已过期：\n${groups.e.join('\n')}\n\n`;
        if (groups.t.length) msg += `🔴 今天：\n${groups.t.join('\n')}\n\n`;
        if (groups['1'].length) msg += `🔴 明天：\n${groups['1'].join('\n')}\n\n`;
        if (groups['3'].length) msg += `🟡 3天内：\n${groups['3'].join('\n')}\n\n`;
        if (groups['7'].length) msg += `🟢 7天内：\n${groups['7'].join('\n')}`;

        return msg ? `⏰ 到期提醒\n\n${msg.trim()}` : null;
    }

    // 会话管理代理方法
    async getSession(userId: number): Promise<SessionData> {
        return this.storage.getSession(userId);
    }

    async setSession(userId: number, data: SessionData): Promise<void> {
        return this.storage.setSession(userId, data);
    }

    async clearSession(userId: number): Promise<void> {
        return this.storage.clearSession(userId);
    }
}

// 导出工具函数供平台适配器使用
export { parseDate, expiryInfo, cleanText };
