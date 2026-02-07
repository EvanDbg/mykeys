/**
 * 存储层接口定义
 */

export interface SecretRow {
    id: number;
    name: string;
    site: string;
    account: string;
    password: string;
    extra: string | null;
    expires_at: string | null;
    created_at: string;
}

export interface SessionData {
    step: SessionStep;
    name?: string;
    site?: string;
    account?: string;
    password?: string;
    expiresAt?: string | null;
    extra?: string | null;
}

export type SessionStep =
    | 'idle'
    | 'ask_site'
    | 'ask_account'
    | 'ask_password'
    | 'ask_expiry'
    | 'ask_extra';

/**
 * 存储层抽象接口
 */
export interface IStorage {
    // 初始化数据库
    init(): Promise<void>;

    // Secret 操作
    getSecret(id: number): Promise<SecretRow | null>;
    getAllSecrets(): Promise<SecretRow[]>;
    searchSecrets(keyword: string, limit?: number): Promise<SecretRow[]>;
    getExpiringSecrets(days: number): Promise<SecretRow[]>;
    saveSecret(data: Omit<SecretRow, 'id' | 'created_at'>): Promise<number>;
    updateSecretExpiry(id: number, expiresAt: string | null): Promise<void>;
    deleteSecret(id: number): Promise<void>;

    // Session 操作
    getSession(userId: number): Promise<SessionData>;
    setSession(userId: number, data: SessionData): Promise<void>;
    clearSession(userId: number): Promise<void>;
}
