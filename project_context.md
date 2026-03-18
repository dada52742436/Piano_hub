# Project Context — Piano Listing Platform (Melbourne)

> 用于在新对话中恢复上下文。当前状态：**Listing 模块 MVP 全部完成，所有测试通过。**

---

## 项目概述

在 `x:\my-project150326` 下搭建了一个墨尔本二手钢琴平台，包含：

- **Backend**: NestJS 11 (strict TypeScript) + Prisma 7 + PostgreSQL + JWT
- **Frontend**: React 19 + Vite 8 + TypeScript + React Router v7 + Axios
- **背景**: 墨尔本二手钢琴平台（货币 AUD $）
- **功能**: 用户注册、登录、bcrypt 密码存储、JWT 认证、Listing CRUD（含权限校验）

---

## 目录结构

```
x:\my-project150326\
├── .gitignore
├── README.md
├── project_context.md          ← 本文件
├── backend\
│   ├── package.json            ← 含 "type": "module"（关键！）
│   ├── tsconfig.json
│   ├── prisma.config.ts
│   ├── .env                    ← DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN
│   ├── .env.example
│   ├── prisma\
│   │   └── schema.prisma       ← User 模型
│   ├── generated\
│   │   └── prisma\
│   │       └── package.json    ← {"type":"module"}（关键！）
│   └── src\
│       ├── main.ts             ← 端口 3001, CORS, ValidationPipe
│       ├── app.module.ts       ← ConfigModule, PrismaModule, UsersModule, AuthModule
│       ├── app.controller.ts
│       ├── prisma\
│       │   ├── prisma.service.ts
│       │   └── prisma.module.ts
│       ├── users\
│       │   ├── users.service.ts
│       │   └── users.module.ts
│       ├── auth\
│       │   ├── dto\
│       │   │   ├── register.dto.ts
│       │   │   └── login.dto.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.module.ts
│       │   ├── jwt.strategy.ts
│       │   └── jwt-auth.guard.ts
│       └── protected\
│           └── protected.controller.ts
└── frontend\
    ├── package.json
    ├── vite.config.ts          ← port:3000, proxy /api → localhost:3001
    ├── index.html
    └── src\
        ├── main.tsx
        ├── App.tsx             ← BrowserRouter + 路由配置
        ├── api\
        │   └── auth.ts         ← axios 实例 + 拦截器 + API 方法
        ├── context\
        │   └── AuthContext.tsx ← 全局 auth 状态 + localStorage
        ├── components\
        │   └── ProtectedRoute.tsx
        └── pages\
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            └── DashboardPage.tsx
```

---

## 技术栈与版本

| 技术 | 版本 | 备注 |
|------|------|------|
| NestJS | 11 | strict 模式 |
| Prisma | 7.5.0 | 破坏性变更：需要 driver adapter |
| @prisma/adapter-pg | 7.x | Prisma 7 必须 |
| PostgreSQL | 本地 5432 | 数据库名：auth_demo |
| @nestjs/jwt | latest | JWT 签发/验证 |
| passport-jwt | latest | Bearer token 提取 |
| bcrypt | latest | saltRounds=10 |
| React | 19 | |
| Vite | 8 | |
| react-router-dom | 7 | |
| axios | 1 | |

---

## 关键技术细节（踩坑记录）

### 1. Prisma 7 + Node.js 22 ESM/CJS 冲突（已解决）

**问题**: `ReferenceError: exports is not defined in ES module scope`

**原因**: Prisma 7 生成 ESM 代码，与 Node.js 22 的 CJS 加载机制冲突

**解决方案**（三处修改）:
1. `backend/package.json` 添加 `"type": "module"`
2. 创建 `backend/generated/prisma/package.json`，内容为 `{"type": "module"}`
3. `backend/src/app.controller.ts` import 使用 `.js` 扩展名

### 2. Prisma 7 使用组合模式（非继承）

```typescript
// prisma.service.ts — 正确方式
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

export class PrismaService {
  readonly prisma: PrismaClient;
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    this.prisma = new PrismaClient({ adapter });
  }
}
```

### 3. JWT `expiresIn` TypeScript 类型问题

```typescript
// auth.module.ts — 需要类型断言
expiresIn: process.env.JWT_EXPIRES_IN as `${number}${'s'|'m'|'h'|'d'}`,
```

### 4. Prisma 7 schema.prisma 配置

```prisma
generator client {
  provider        = "prisma-client"
  output          = "../generated/prisma"
  moduleFormat    = "esm"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## API 端点

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | /auth/register | 注册新用户，返回 JWT | 无 |
| POST | /auth/login | 登录，返回 JWT | 无 |
| GET | /protected/profile | 获取当前用户信息 | Bearer Token |

**注册/登录响应格式**:
```json
{
  "accessToken": "eyJ...",
  "user": { "id": 1, "email": "...", "username": "..." }
}
```

---

## 数据库

- **数据库名**: `auth_demo`
- **用户**: `postgres`
- **端口**: `5432`
- **User 表** (`users`): `id`, `email` (unique), `username`, `password` (hashed), `createdAt`, `updatedAt`

---

## 环境变量 (`backend/.env`)

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/auth_demo"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"
```

---

## 启动命令

```powershell
# 终端 1 — 后端 (http://localhost:3001)
Set-Location x:\my-project150326\backend
npm run start:dev

# 终端 2 — 前端 (http://localhost:3000 或 3002)
Set-Location x:\my-project150326\frontend
npm run dev
```

> 注意：如果 3000 端口被占用，Vite 会自动使用 3002。

---

## 完成状态

**14/14 步骤全部完成，5 项手动测试全部通过：**

1. ✅ NestJS 初始化 + 依赖安装
2. ✅ Prisma + PostgreSQL schema + 数据库迁移
3. ✅ PrismaService（Prisma 7 组合模式）
4. ✅ UsersService（findByEmail, findById, create）
5. ✅ Auth DTOs + AuthService（bcrypt + JWT）
6. ✅ JwtStrategy + JwtAuthGuard
7. ✅ AuthController（register/login 端点）
8. ✅ ProtectedController（JWT 保护路由）
9. ✅ React + Vite 前端初始化
10. ✅ AuthContext（全局状态 + localStorage）
11. ✅ LoginPage + RegisterPage
12. ✅ ProtectedRoute + DashboardPage
13. ✅ CORS + Vite 代理配置
14. ✅ 端到端集成测试全部通过

---

## 可能的后续扩展方向

- **Token 刷新**: 添加 `/auth/refresh` 端点
- **用户角色**: User 模型添加 `role` 字段（admin/user）
- **邮箱验证**: nodemailer 接入注册验证邮件
- **UI 框架**: 替换内联样式为 Ant Design 或 Tailwind CSS
- **部署**: Docker + Nginx 反向代理 + `npm run build`
- **修改密码**: 添加 `/auth/change-password` 端点
