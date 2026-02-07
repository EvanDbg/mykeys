FROM node:20-alpine

WORKDIR /app

# 安装构建依赖 (better-sqlite3 需要编译)
RUN apk add --no-cache python3 make g++

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# 清理构建依赖
RUN apk del python3 make g++ && rm -rf /var/cache/apk/*

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/mykeys.db
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 数据持久化挂载点
VOLUME ["/app/data"]

# 启动服务
CMD ["node", "dist/index.js"]
