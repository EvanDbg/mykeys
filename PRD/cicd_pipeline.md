# Docker 配置 + GitHub Actions CI/CD

## 目标

1. **优化 Docker 部署配置** - 简化生产环境部署流程
2. **添加 GitHub Actions** - 每次提交自动构建 Docker 镜像并推送到 GHCR
3. **安全检查** - 确保敏感信息不被上传

---

## 安全检查结果 ✅

| 文件 | 状态 | 说明 |
|------|------|------|
| `.env` | ✅ 安全 | 已在 .gitignore 中 |
| `.secrets.local` | ✅ 安全 | 已在 .gitignore 中 |
| `wrangler.toml` | ✅ 安全 | 已在 .gitignore 中 |
| `.gitignore` | ✅ 已修复 | 移除重复条目 |

---

## 已实现的功能

### GitHub Actions Workflow

**文件**: `.github/workflows/docker-build.yml`

**触发条件**:
- Push 到 `main` 分支（且修改了 Dockerfile/src/package.json/tsconfig.json）
- Pull Request 到 `main` 分支
- 手动触发 (workflow_dispatch)

**功能**:
- ✅ 登录 GitHub Container Registry (ghcr.io)
- ✅ 多平台构建 (linux/amd64, linux/arm64)
- ✅ 自动标签 (分支名, commit SHA, latest)
- ✅ 缓存优化 (GHA cache)
- ✅ OCI 镜像标签

**拉取镜像**:
```bash
docker pull ghcr.io/evandbg/mykeys:latest
```

---

## 部署指南

### 快速部署

```bash
# 1. 创建 .env 文件
cp .env.example .env
# 编辑 .env 填入真实配置

# 2. 使用 docker-compose 启动
docker compose up -d

# 或直接使用预构建镜像
docker run -d \
  --name mykeys \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  ghcr.io/evandbg/mykeys:latest
```

