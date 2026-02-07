/**
 * 配置管理模块
 */

export interface WeComConfig {
    corpId: string;
    agentId: string;
    secret: string;
    token: string;
    encodingAesKey: string;
}

export interface TelegramConfig {
    botToken: string;
    allowedUserId: string;
}

export interface AdminConfig {
    enabled: boolean;
    username: string;
    password: string;
}

export interface AppConfig {
    // 加密密钥
    encryptKey: string;

    // 数据库路径
    databasePath: string;

    // HTTP 服务端口
    port: number;

    // 企业微信配置
    wecom?: WeComConfig;

    // Telegram 配置
    telegram?: TelegramConfig;

    // 后台管理配置
    admin?: AdminConfig;
}

/**
 * 从环境变量加载配置
 */
export function loadConfig(): AppConfig {
    const config: AppConfig = {
        encryptKey: process.env.ENCRYPT_KEY || '',
        databasePath: process.env.DATABASE_PATH || './data/mykeys.db',
        port: parseInt(process.env.PORT || '3000', 10),
    };

    // 企业微信配置
    if (process.env.WECOM_CORP_ID) {
        config.wecom = {
            corpId: process.env.WECOM_CORP_ID,
            agentId: process.env.WECOM_AGENT_ID || '',
            secret: process.env.WECOM_SECRET || '',
            token: process.env.WECOM_TOKEN || '',
            encodingAesKey: process.env.WECOM_ENCODING_AES_KEY || '',
        };
    }

    // Telegram 配置
    if (process.env.TELEGRAM_BOT_TOKEN) {
        config.telegram = {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            allowedUserId: process.env.ALLOWED_USER_ID || '',
        };
    }

    // 后台管理配置
    if (process.env.ADMIN_ENABLED === 'true') {
        config.admin = {
            enabled: true,
            username: process.env.ADMIN_USERNAME || 'admin',
            password: process.env.ADMIN_PASSWORD || '',
        };
    }

    return config;
}

/**
 * 验证配置完整性
 */
export function validateConfig(config: AppConfig): string[] {
    const errors: string[] = [];

    if (!config.encryptKey || config.encryptKey.length < 16) {
        errors.push('ENCRYPT_KEY 必须至少 16 个字符');
    }

    if (!config.wecom && !config.telegram) {
        errors.push('至少需要配置一个消息平台（企业微信或 Telegram）');
    }

    if (config.wecom) {
        if (!config.wecom.corpId) errors.push('WECOM_CORP_ID 未配置');
        if (!config.wecom.agentId) errors.push('WECOM_AGENT_ID 未配置');
        if (!config.wecom.secret) errors.push('WECOM_SECRET 未配置');
        if (!config.wecom.token) errors.push('WECOM_TOKEN 未配置');
        if (!config.wecom.encodingAesKey)
            errors.push('WECOM_ENCODING_AES_KEY 未配置');
    }

    if (config.telegram) {
        if (!config.telegram.botToken) errors.push('TELEGRAM_BOT_TOKEN 未配置');
        if (!config.telegram.allowedUserId) errors.push('ALLOWED_USER_ID 未配置');
    }

    return errors;
}
