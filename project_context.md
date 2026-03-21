# Project Context — Piano Listing Platform (Melbourne)

> 用于在新对话中恢复上下文。当前状态：**Listing 模块 MVP 全部完成，所有测试通过。**

---

## 项目概述

在 `x:\my-project150326` 下搭建了一个墨尔本二手钢琴交易平台，包含：

- **Backend**: NestJS 11 (strict TypeScript) + Prisma 7 + PostgreSQL + JWT
- **Frontend**: React 19 + Vite 8 + TypeScript + React Router v7 + Axios
- **背景**: 墨尔本二手钢琴平台（货币 AUD $）
- **功能**: 用户注册、登录、bcrypt 密码存储、JWT 认证、Listing CRUD（含所有者权限校验）

---

## 目录结构

```
x:\my-project150326\
├── .gitignore
├── README.md
├── project_context.md
├── backend\
│   ├── package.json            ← 含 "type": "module"（关键！）
│   ├── tsconfig.json
│   ├── prisma.config.ts        ← Prisma 7 配置，含 datasource.url
│   ├── .env                    ← DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN
│   ├── .env.example
│   ├── prisma\
│   │   ├── schema.prisma       ← User + Listing 模型
│   │   └── migrations\         ← 含 init + add_listing_model 两次迁移
│   ├── generated\
│   │   └── prisma\
│   │       └── package.json    ← {"type":"module"}（关键！）
│   └── src\
│       ├── main.ts             ← 端口 3001, CORS, ValidationPipe
│       ├── app.module.ts       ← ConfigModule, PrismaModule, UsersModule, AuthModule, ListingsModule
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
│       ├── listings\           ← 新增
│       │   ├── dto\
│       │   │   ├── create-listing.dto.ts
│       │   │   └── update-listing.dto.ts
│       │   ├── listings.service.ts
│       │   ├── listings.controller.ts
│       │   └── listings.module.ts
│       └── protected\
│           └── protected.controller.ts
└── frontend\
    ├── package.json
    ├── vite.config.ts          ← port:3000, proxy /api → localhost:3001
    └── src\
        ├── main.tsx
        ├── App.tsx             ← 所有路由（含 listings 路由）
        ├── api\
        │   ├── auth.ts         ← axios 实例 + 拦截器 + auth API
        │   └── listings.ts     ← 新增：listings CRUD API
        ├── context\
        │   └── AuthContext.tsx ← 全局 auth 状态 + localStorage
        ├── components\
        │   └── ProtectedRoute.tsx
        └── pages\
            ├── LoginPage.tsx       ← 登录后跳 /listings
            ├── RegisterPage.tsx    ← 注册后跳 /listings
            ├── DashboardPage.tsx   ← 含 Browse Listings 按钮
            ├── ListingsPage.tsx    ← 新增：公开列表页
            ├── ListingDetailPage.tsx  ← 新增：详情页（本人显示 Edit/Delete）
            ├── CreateListingPage.tsx  ← 新增：发布页（受保护）
            ├── MyListingsPage.tsx     ← 新增：我的发布页（受保护）
            └── EditListingPage.tsx    ← 新增：编辑页（受保护）
```

---

## 技术栈与版本

| 技术 | 版本 | 备注 |
|------|------|------|
| NestJS | 11 | strict 模式 |
| Prisma | 7.5.0 | 破坏性变更：需要 driver adapter，url 在 prisma.config.ts |
| @prisma/adapter-pg | 7.x | Prisma 7 必须 |
| PostgreSQL | 本地 5432 | 数据库名：auth_demo |
| @nestjs/jwt | latest | JWT 签发/验证 |
| passport-jwt | latest | Bearer token 提取 |
| bcrypt | latest | saltRounds=10 |
| class-validator | latest | DTO 字段校验 |
| React | 19 | |
| Vite | 8 | |
| react-router-dom | 7 | |
| axios | 1 | |

---

## 关键技术细节（踩坑记录）

### 1. Prisma 7 — url 不能放在 schema.prisma

**问题**: `The datasource property 'url' is no longer supported in schema files`

**解决**: `url` 必须放在 `prisma.config.ts` 的 `datasource.url`，schema 里只留 `provider`：

```prisma
// schema.prisma — 正确
datasource db {
  provider = "postgresql"
}
```

```typescript
// prisma.config.ts — 正确
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env["DATABASE_URL"] },
});
```

### 2. Prisma 7 + Node.js 22 ESM/CJS 冲突（已解决）

**解决方案**（三处修改）:
1. `backend/package.json` 添加 `"type": "module"`
2. 创建 `backend/generated/prisma/package.json`，内容为 `{"type": "module"}`
3. 所有 import 使用 `.js` 扩展名

### 3. Prisma 7 使用组合模式（非继承）

```typescript
// prisma.service.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

export class PrismaService {
  readonly prisma: PrismaClient;
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    this.prisma = new PrismaClient({ adapter });
  }
}
// 用法：this.prismaService.prisma.listing.findMany(...)
```

### 4. Prisma 7 schema.prisma generator 配置

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "esm"
}
```

### 5. JWT `expiresIn` TypeScript 类型问题

```typescript
expiresIn: process.env.JWT_EXPIRES_IN as `${number}${'s'|'m'|'h'|'d'}`,
```

---

## 数据库 Schema

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  username  String
  password  String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  listings  Listing[]
  @@map("users")
}

model Listing {
  id          Int      @id @default(autoincrement())
  title       String
  description String
  price       Float
  brand       String?
  condition   String   // "new" | "like_new" | "good" | "fair" | "poor"
  location    String?
  ownerId     Int
  owner       User     @relation(fields: [ownerId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("listings")
}
```

- **数据库名**: `auth_demo`
- **用户**: `postgres` / **端口**: `5432`

---

## API 端点

### Auth
| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | /auth/register | 注册，返回 JWT + user | 无 |
| POST | /auth/login | 登录，返回 JWT + user | 无 |
| GET  | /protected/profile | 当前用户信息 | Bearer Token |

### Listings
| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET    | /listings       | 所有 listings（含 owner 公开信息） | 无 |
| GET    | /listings/mine  | 当前用户的 listings | JWT |
| GET    | /listings/:id   | 单个 listing 详情 | 无 |
| POST   | /listings       | 创建 listing | JWT |
| PATCH  | /listings/:id   | 编辑（仅本人，否则 403） | JWT |
| DELETE | /listings/:id   | 删除（仅本人，否则 403） | JWT |

**注意**: `/listings/mine` 路由在 Controller 中必须声明在 `/:id` 之前，否则 NestJS 会把 "mine" 当成 id 解析。

**权限实现**:
- Controller：从 `req.user.id`（JWT 注入）获取 requesterId，不从 body 读取
- Service：`update()` / `remove()` 先 findOne（404），再比对 `ownerId !== requesterId`（403）

---

## 前端路由

| 路径 | 组件 | 保护 |
|------|------|------|
| `/` | → redirect `/listings` | — |
| `/listings` | `ListingsPage` | 公开 |
| `/listings/:id` | `ListingDetailPage` | 公开 |
| `/listings/new` | `CreateListingPage` | ProtectedRoute |
| `/listings/mine` | `MyListingsPage` | ProtectedRoute |
| `/listings/:id/edit` | `EditListingPage` | ProtectedRoute |
| `/login` | `LoginPage` | 公开 |
| `/register` | `RegisterPage` | 公开 |
| `/dashboard` | `DashboardPage` | ProtectedRoute |

**登录/注册成功后跳转**: `/listings`（非 `/dashboard`）

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

# 终端 2 — 前端 (http://localhost:3000)
Set-Location x:\my-project150326\frontend
npm run dev
```

---

## 下一步方向（未实现）

- 全局 Navbar 导航栏
- 搜索 / 筛选（价格、品牌、成色）
- 图片上传
- 买家联系卖家（消息系统）

---

