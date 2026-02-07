/**
 * 后台管理认证中间件
 */

import { Request, Response, NextFunction } from 'express';
import type { AdminConfig } from '../config.js';

/**
 * 创建 Basic Auth 认证中间件
 */
export function createAuthMiddleware(config: AdminConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Basic ')) {
            res.setHeader('WWW-Authenticate', 'Basic realm="MyKeys Admin"');
            res.status(401).json({ error: '需要认证' });
            return;
        }

        const base64 = authHeader.slice(6);
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        const [username, password] = decoded.split(':');

        if (username !== config.username || password !== config.password) {
            res.status(401).json({ error: '用户名或密码错误' });
            return;
        }

        next();
    };
}
