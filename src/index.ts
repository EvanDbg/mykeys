/**
 * Node.js HTTP 服务入口
 */

import express from 'express';
import bodyParser from 'body-parser';
import { loadConfig, validateConfig } from './config';
import { SqliteStorage } from './core/storage-sqlite';
import { PasswordService } from './core/password-service';
import { WeComHandler } from './platforms/wecom/handler';
import path from 'path';
import fs from 'fs';

// 加载环境变量
import 'dotenv/config';

async function main() {
  console.log('🔐 MyKeys 密码管理服务启动中...');

  // 加载配置
  const config = loadConfig();
  const errors = validateConfig(config);

  if (errors.length > 0) {
    console.error('❌ 配置错误：');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 确保数据目录存在
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 初始化存储
  const storage = new SqliteStorage(config.databasePath);
  await storage.init();
  console.log('✅ 数据库初始化完成');

  // 初始化密码服务
  const passwordService = new PasswordService(storage, config.encryptKey);

  // 创建 Express 应用
  const app = express();

  // 解析 XML 请求体（企业微信使用 XML）
  app.use(
    bodyParser.text({ type: ['text/xml', 'application/xml'] })
  );
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 企业微信回调
  if (config.wecom) {
    const wecomHandler = new WeComHandler(config.wecom, passwordService);

    app.get('/wecom/callback', (req, res) =>
      wecomHandler.verifyUrl(req, res)
    );
    app.post('/wecom/callback', (req, res) =>
      wecomHandler.handleMessage(req, res)
    );

    console.log('✅ 企业微信回调已配置: /wecom/callback');
  }

  // TODO: Telegram Webhook (如需保留)
  // if (config.telegram) {
  //   const telegramHandler = new TelegramHandler(config.telegram, passwordService);
  //   app.post('/telegram/webhook', (req, res) => telegramHandler.handleMessage(req, res));
  //   console.log('✅ Telegram Webhook 已配置: /telegram/webhook');
  // }

  // 启动服务
  app.listen(config.port, () => {
    console.log(`🚀 服务已启动: http://localhost:${config.port}`);
    console.log(`📋 健康检查: http://localhost:${config.port}/health`);
    if (config.wecom) {
      console.log(`📱 企业微信回调: http://localhost:${config.port}/wecom/callback`);
    }
  });

  // 优雅退出
  process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭...');
    storage.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    storage.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
