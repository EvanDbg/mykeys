/**
 * 后台管理 REST API 路由
 */

import { Router, Request, Response } from 'express';
import { PasswordService } from '../core/password-service.js';
import { createAuthMiddleware } from './auth.js';
import { generateAdminHtml } from './ui.js';
import type { AdminConfig } from '../config.js';

export function createAdminRouter(config: AdminConfig, passwordService: PasswordService): Router {
    const router = Router();

    // 认证中间件（API 路由需要认证）
    const authRequired = createAuthMiddleware(config);

    // 管理界面（先检查认证）
    router.get('/', authRequired, (_req: Request, res: Response) => {
        res.type('text/html').send(generateAdminHtml());
    });

    // API 路由 - 全部需要认证
    router.use('/api', authRequired);

    // 获取所有密码列表
    router.get('/api/secrets', async (_req: Request, res: Response) => {
        try {
            const secrets = await passwordService.getAllSecrets();
            // 返回列表时不包含敏感信息
            const list = secrets.map(s => ({
                id: s.id,
                name: s.name,
                site: s.site,
                expires_at: s.expires_at,
                created_at: s.created_at,
            }));
            res.json({ success: true, data: list });
        } catch (error) {
            console.error('获取密码列表失败:', error);
            res.status(500).json({ success: false, error: '获取失败' });
        }
    });

    // 获取单条密码详情（解密）
    router.get('/api/secrets/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ success: false, error: '无效的 ID' });
                return;
            }

            const detail = await passwordService.getSecretDetail(id);
            if (!detail) {
                res.status(404).json({ success: false, error: '记录不存在' });
                return;
            }

            res.json({ success: true, data: detail });
        } catch (error) {
            console.error('获取密码详情失败:', error);
            res.status(500).json({ success: false, error: '获取失败' });
        }
    });

    // 新增密码
    router.post('/api/secrets', async (req: Request, res: Response) => {
        try {
            const { name, site, account, password, extra, expiresAt, isRaw, content } = req.body;

            if (!name) {
                res.status(400).json({ success: false, error: '名称不能为空' });
                return;
            }

            let id: number;
            if (isRaw) {
                // 长文本模式
                if (!content) {
                    res.status(400).json({ success: false, error: '内容不能为空' });
                    return;
                }
                id = await passwordService.saveLongText(name, content, expiresAt || null);
            } else {
                // 标准密码模式
                if (!site || !account || !password) {
                    res.status(400).json({ success: false, error: '网站、账号、密码不能为空' });
                    return;
                }
                id = await passwordService.saveSecret({
                    name,
                    site,
                    account,
                    password,
                    extra: extra || null,
                    expiresAt: expiresAt || null,
                });
            }

            res.json({ success: true, data: { id } });
        } catch (error) {
            console.error('新增密码失败:', error);
            res.status(500).json({ success: false, error: '保存失败' });
        }
    });

    // 更新密码
    router.put('/api/secrets/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ success: false, error: '无效的 ID' });
                return;
            }

            const existing = await passwordService.getSecretDetail(id);
            if (!existing) {
                res.status(404).json({ success: false, error: '记录不存在' });
                return;
            }

            const { name, site, account, password, extra, expiresAt, isRaw, content } = req.body;

            if (isRaw || existing.isRaw) {
                // 长文本类型：content 映射到 password
                await passwordService.updateSecret(id, {
                    name,
                    password: content,
                    expiresAt,
                });
            } else {
                // 普通密码类型
                await passwordService.updateSecret(id, {
                    name,
                    site,
                    account,
                    password,
                    extra,
                    expiresAt,
                });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('更新密码失败:', error);
            res.status(500).json({ success: false, error: '更新失败' });
        }
    });

    // 删除密码
    router.delete('/api/secrets/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ success: false, error: '无效的 ID' });
                return;
            }

            const existing = await passwordService.getSecretDetail(id);
            if (!existing) {
                res.status(404).json({ success: false, error: '记录不存在' });
                return;
            }

            await passwordService.deleteSecret(id);
            res.json({ success: true });
        } catch (error) {
            console.error('删除密码失败:', error);
            res.status(500).json({ success: false, error: '删除失败' });
        }
    });

    return router;
}
