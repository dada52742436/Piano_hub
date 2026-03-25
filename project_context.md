# Project Context — Piano Listing Platform (Melbourne)

> 用于在新对话中恢复上下文。当前状态：**Phase 4 完成 — 单元测试（27 tests）、E2E baseline（36 tests）、Swagger UI、Seed 演示数据、Docker 容器化、组件抽离、图片上传、搜索/筛选/分页全部就绪。**

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
├── README_DEV.md               ← 开发者文档（Phase 4 重写）
├── project_context.md
├── docker-compose.yml          ← Phase 4 新增：postgres + backend + frontend 三服务
├── backend\
│   ├── Dockerfile              ← Phase 4 新增：多阶段构建
│   ├── package.json            ← 含 "type": "module"（关键！）
│   ├── tsconfig.json
│   ├── nest-cli.json           ← Swagger CLI 插件已移除（ESM 不兼容），只保留 assets
│   ├── prisma.config.ts        ← Prisma 7 配置：datasource.url + migrations.seed
│   ├── .env                    ← DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN
│   ├── .env.example
│   ├── prisma\
│   │   ├── schema.prisma       ← User + Listing + Booking + ListingImage 模型
│   │   ├── seed.ts             ← Phase 4 新增：演示数据（alice/bob + 7 listings）
│   │   └── migrations\         ← init + add_listing_model + add_condition_enum + bookings + images
│   ├── generated\
│   │   └── prisma\
│   │       └── package.json    ← {"type":"module"}（关键！git-ignored）
│   └── src\
│       ├── main.ts             ← 端口 3001, CORS, ValidationPipe, Swagger UI /docs
│       ├── app.module.ts       ← ConfigModule, PrismaModule, UsersModule, AuthModule, ListingsModule, BookingsModule, ServeStaticModule
│       ├── prisma\
│       │   ├── prisma.service.ts  ← 组合模式（非继承），driver adapter
│       │   └── prisma.module.ts   ← @Global()
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
│       ├── listings\
│       │   ├── dto\
│       │   │   ├── create-listing.dto.ts   ← @IsEnum(Condition)
│       │   │   ├── update-listing.dto.ts
│       │   │   └── get-listings-query.dto.ts  ← Phase 3：search/condition/brand/price/page/limit
│       │   ├── images\                    ← Phase 3 新增：图片上传子模块
│       │   │   ├── images.service.ts      ← Multer diskStorage + 所有权校验 + 5 张限制
│       │   │   ├── images.controller.ts
│       │   │   └── images.module.ts
│       │   ├── listings.service.ts        ← Phase 3：searchFilter + pagination + Promise.all
│       │   ├── listings.controller.ts
│       │   └── listings.module.ts
│       ├── bookings\                       ← Phase 2 新增
│       │   ├── dto\
│       │   │   ├── create-booking.dto.ts
│       │   │   └── update-booking-status.dto.ts
│       │   ├── bookings.service.ts
│       │   ├── bookings.controller.ts
│       │   └── bookings.module.ts
│       └── protected\
│           └── protected.controller.ts
└── frontend\
    ├── Dockerfile              ← Phase 4 新增：nginx 多阶段构建
    ├── nginx.conf              ← SPA 路由回退 + /api + /uploads 反向代理
    ├── package.json
    ├── vite.config.ts          ← port:3000, proxy /api + /uploads → localhost:3001
    └── src\
        ├── main.tsx
        ├── App.tsx             ← 所有路由
        ├── constants\
        │   └── conditions.ts   ← CONDITIONS 数组 + CONDITION_LABELS map（单一数据源）
        ├── styles\
        │   └── shared.ts       ← Phase 4 新增：sharedInputStyle, sharedBackLinkStyle
        ├── api\
        │   ├── auth.ts         ← axios 实例 + 拦截器 + auth API
        │   ├── listings.ts     ← listings + 图片 API + 401 interceptor
        │   └── bookings.ts     ← bookings API + 类型定义
        ├── context\
        │   └── AuthContext.tsx ← 全局 auth 状态 + localStorage
        ├── components\
        │   ├── ProtectedRoute.tsx
        │   └── ui\
        │       └── Field.tsx   ← Phase 4 新增：通用表单字段包装组件
        └── pages\
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            ├── DashboardPage.tsx
            ├── ListingsPage.tsx          ← Phase 3：搜索/筛选/分页；两套 state（draft/committed）
            ├── ListingDetailPage.tsx     ← Phase 3：图片展示/上传/删除
            ├── CreateListingPage.tsx     ← Phase 4：改用 Field + sharedInputStyle
            ├── MyListingsPage.tsx        ← Phase 2：Bookings 按钮
            ├── EditListingPage.tsx       ← Phase 4：改用 Field + sharedInputStyle
            ├── MyBookingsPage.tsx        ← Phase 2：买家预约列表（可取消 pending）
            └── ListingBookingsPage.tsx  ← Phase 2：卖家管理预约（可接受/拒绝）
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
enum Condition {
  new
  like_new
  good
  fair
  poor
}

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  username  String
  password  String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  listings  Listing[]
  bookings  Booking[] @relation("BookingBuyer")   // Phase 2
  @@map("users")
}

model Listing {
  id          Int            @id @default(autoincrement())
  title       String
  description String
  price       Float          // AUD
  brand       String?
  condition   Condition
  location    String?
  ownerId     Int
  owner       User           @relation(fields: [ownerId], references: [id])
  bookings    Booking[]                            // Phase 2
  images      ListingImage[]                       // Phase 3 新增
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  @@map("listings")
}

// Phase 2 — 新增
enum BookingStatus {
  pending
  accepted
  rejected
  cancelled
}

model Booking {
  id        Int           @id @default(autoincrement())
  listingId Int
  listing   Listing       @relation(fields: [listingId], references: [id])
  buyerId   Int
  buyer     User          @relation("BookingBuyer", fields: [buyerId], references: [id])
  status    BookingStatus @default(pending)
  message   String?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  @@unique([listingId, buyerId])
  @@map("bookings")
}

// Phase 3 — 新增
model ListingImage {
  id        Int      @id @default(autoincrement())
  listingId Int
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  url       String   // 公开路径，如 /uploads/listing-3-1234567890.jpg
  order     Int      @default(0)  // 展示顺序
  createdAt DateTime @default(now())
  @@map("listing_images")
}
```

- **数据库名**: `pianohub`（Docker 及新建项目）/ 旧本地实例可能仍为 `auth_demo`
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
| GET    | /listings       | 搜索/筛选/分页（query: search/condition/brand/minPrice/maxPrice/page/limit） | 无 |
| GET    | /listings/mine  | 当前用户的 listings | JWT |
| GET    | /listings/:id   | 单个 listing 详情（含 images ordered by order ASC） | 无 |
| POST   | /listings       | 创建 listing | JWT |
| PATCH  | /listings/:id   | 编辑（仅本人，否则 403） | JWT |
| DELETE | /listings/:id   | 删除（仅本人，否则 403） | JWT |

### Listing Images（Phase 3）
| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST   | /listings/:id/images           | 上传图片（multipart, field=file, max 5张, 5MB） | JWT |
| DELETE | /listings/:id/images/:imageId  | 删除图片（仅 owner，删磁盘文件） | JWT |

### Bookings（Phase 2）
| 方法 | 路径 | 描述 | 认证 | 权限 |
|------|------|------|------|------|
| POST  | /listings/:listingId/bookings | 提交预约 | JWT | 买家（非 listing 所有者）|
| GET   | /bookings/mine                | 我的所有预约 | JWT | 本人 |
| GET   | /listings/:listingId/bookings | 某 listing 的所有预约 | JWT | 卖家（listing 所有者）|
| PATCH | /bookings/:id/status          | 更新预约状态 | JWT | 卖家（accepted/rejected）或买家（cancelled）|

**状态机**: `pending` → { 卖家: `accepted` / `rejected`；买家: `cancelled` }。只有 pending 状态可被修改。  
**约束**: 同一 (listingId, buyerId) 只能有一条预约（DB `@@unique`）。

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
| `/bookings/mine` | `MyBookingsPage` | ProtectedRoute |
| `/listings/:id/bookings` | `ListingBookingsPage` | ProtectedRoute |

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

### 本地启动
```powershell
# 终端 1 — 后端 (http://localhost:3001, Swagger: http://localhost:3001/docs)
Set-Location x:\my-project150326\backend
npm run start:dev

# 终端 2 — 前端 (http://localhost:3000)
Set-Location x:\my-project150326\frontend
npm run dev

# 首次启动前（建表 + 演示数据）
cd x:\my-project150326\backend
npx prisma migrate dev
npx prisma db seed
```

### Docker 启动（Phase 4）
```bash
# 从项目根目录
docker compose up --build

# 首次运行后插入演示数据（可选）
docker compose exec backend npx prisma db seed
```

> **演示账号**（密码均为 `demo123!`）: `alice@demo.com`（4 listings）/ `bob@demo.com`（3 listings）

---

## 下一步方向（未实现）

- 全局 Navbar 导航栏
- 买家联系卖家（消息系统 / WebSocket）
- Listing 状态字段（active / sold / archived）
- 收藏 / 关注 listing
- 后续新业务模块的增量 E2E 扩展
- Tailwind CSS 迁移

---

## ⚠️ 关键 Bug 修复记录（Phase 4 本会话）

### 1. seed.ts — Condition enum 值错误
- **文件**: `backend/prisma/seed.ts`
- **问题**: `condition: 'excellent'` → TypeScript 编译报错，`excellent` 不在 Condition enum 中
- **修复**: 改为 `condition: 'like_new'`（影响 Yamaha U1 和 Bösendorfer 200 两条记录）
- **有效 enum 值**: `new | like_new | good | fair | poor`

### 2. prisma.config.ts — seed 配置位置
- **问题**: Prisma 7 不从 `package.json` 的 `"prisma": { "seed": "..." }` 读取，而从 `prisma.config.ts` 的 `migrations.seed` 读取
- **修复**: 在 `prisma.config.ts` 的 `migrations` 对象下添加 `seed: "npx tsx prisma/seed.ts"`
- **当前状态**: ✅ 已修复，`npx prisma db seed` 正常工作

### 3. nest-cli.json — 移除 @nestjs/swagger CLI 插件
- **问题**: `@nestjs/swagger` CLI 插件在编译时向 DTO 类注入含 `require('class-validator')` 的 `_OPENAPI_METADATA_FACTORY` 方法；ESM 运行时没有 `require`，导致 `ReferenceError: require is not defined` 在 NestJS 启动时崩溃
- **修复**: 从 `nest-cli.json` 完全删除 `plugins` 块
- **影响**: Swagger UI (`/docs`) 仍正常工作；但 DTO 字段不会自动生成 `@ApiProperty`（需要手动添加）
- **当前状态**: ✅ 已移除，后端启动正常

### 4. E2E 测试状态
- `backend/test/app.e2e-spec.ts` 已从 NestJS 默认脚手架测试扩展为当前阶段的综合 E2E 基线
- `npm run test:e2e` 当前可稳定运行，覆盖 **36 个测试**
- 已覆盖模块：`auth`、`protected profile`、`listings public + owner flows`、`bookings lifecycle + ownership`、`listing images`
- 单元测试当前为 **27 个测试，4 个 spec 文件**

---

## Phase 4 变更记录（2026-03-24）

### 后端
- **`nest-cli.json`**：移除 `@nestjs/swagger` plugin（ESM 不兼容，见上方 Bug 修复 #3）
- **`prisma.config.ts`**：新增 `migrations.seed: "npx tsx prisma/seed.ts"`（Prisma 7 seed 配置位置）
- **`prisma/seed.ts`**（新文件）：演示数据脚本，创建 alice/bob 账号 + 7 条 listing；使用 `upsert` + count 检查保证幂等性；修复 `condition: 'excellent'` → `'like_new'`
- **`src/auth/auth.service.spec.ts`**（新文件）：6 个单元测试（注册/登录全流程）
- **`src/listings/listings.service.spec.ts`**（新文件）：10 个单元测试（CRUD + 403 + 分页）
- **`src/listings/images/images.service.spec.ts`**（新文件）：10 个单元测试（图片上传/删除）
- **`src/app.controller.spec.ts`**：1 个基础单元测试
- **`test/app.e2e-spec.ts`**：36 个 E2E 测试，覆盖 auth、protected、listings、bookings、listing images
- **Jest 配置**（`package.json`）：`ts-jest` 覆盖 `module: "commonjs"` + `moduleNameMapper` `.js` → `.ts`，解决 ESM/CJS 冲突

### 前端
- **`src/styles/shared.ts`**（新文件）：`sharedInputStyle` + `sharedBackLinkStyle`
- **`src/components/ui/Field.tsx`**（新文件）：通用表单字段包装组件
- **`CreateListingPage.tsx`** / **`EditListingPage.tsx`**：改用 `Field` 组件 + `sharedInputStyle`，消除重复代码

### 容器化
- **`docker-compose.yml`**（新文件）：postgres + backend + frontend 三服务，含 healthcheck、volume 持久化
- **`backend/Dockerfile`**（新文件）：多阶段构建（build → production），启动时自动 `prisma migrate deploy`
- **`frontend/Dockerfile`**（新文件）：Vite 构建 → nginx 提供静态文件
- **`frontend/nginx.conf`**（新文件）：SPA 路由回退 + `/api` + `/uploads` 反向代理

### 文档
- **`README_DEV.md`**：全面重写，含 12 个章节（技术栈、依赖说明、所有功能实现细节、API 列表等）

---

## Phase 3 变更记录（2026-03-22）

### 后端
- **`prisma/schema.prisma`**：新增 `ListingImage` 模型（含 `onDelete: Cascade`、`order` 字段）；`Listing` 新增 `images ListingImage[]` 关联
- **迁移**：新增 `add_listing_image_model` migration
- **`src/listings/dto/get-listings-query.dto.ts`**（新文件）：`search / condition / brand / minPrice / maxPrice / page / limit`，`enableImplicitConversion: true` 自动转换 query string 类型
- **`src/listings/listings.service.ts`**：`findAll` 改为支持所有 query 参数，`Promise.all([findMany, count])` 并发，返回 `{ data, total, page, limit, totalPages }`
- **`src/listings/images/`**（新目录）：`ImagesService`（Multer diskStorage + max 5 张 + 5MB + MIME 校验）、`ImagesController`、`ImagesModule`
- **`src/app.module.ts`**：注册 `ServeStaticModule`（`./uploads/` → `/uploads`）

### 前端
- **`src/pages/ListingsPage.tsx`**：两套 state（`draftFilters` / `committedFilters`）；分页控件；搜索栏（关键词、成色、品牌、价格区间）
- **`src/pages/ListingDetailPage.tsx`**：水平滚动图片卡片 + 删除按钮（仅 owner）；隐藏 file input 上传；超 5 张隐藏按钮
- **`src/api/listings.ts`**：新增 `uploadImage` / `deleteImage` API 函数；`Listing` type 新增 `images` 字段；`PaginatedListings` 类型

---

## Phase 2 变更记录（2026-03-21）

### 后端
- **`prisma/schema.prisma`**：新增 `BookingStatus` enum（pending/accepted/rejected/cancelled）、`Booking` 模型（含 `@@unique([listingId, buyerId])`）、User 和 Listing 反向关联
- **迁移**：新增 `20260321060510_add_booking_model` migration
- **`src/bookings/booking-status.enum.ts`**（新文件）：TypeScript enum，供 DTO/Service 使用（不从 generated client 导入）
- **`src/bookings/dto/create-booking.dto.ts`**（新文件）：`message?: string`，`@MaxLength(500)`
- **`src/bookings/dto/update-booking-status.dto.ts`**（新文件）：`@IsEnum(BookingStatus)`
- **`src/bookings/bookings.service.ts`**（新文件）：create（400/404/409）、findByBuyer、findByListing（403）、updateStatus（状态机 + 所有权校验）
- **`src/bookings/bookings.controller.ts`**（新文件）：4 条路由，`@Controller()` 无前缀以支持两种 URL 模式
- **`src/bookings/bookings.module.ts`**（新文件）：注册 Service 和 Controller
- **`src/app.module.ts`**：注册 `BookingsModule`

### 前端
- **`src/api/bookings.ts`**（新文件）：`BookingStatus` 类型、`Booking` interface、4 个 API 函数 + 401 interceptor
- **`src/pages/MyBookingsPage.tsx`**（新文件）：买家的预约列表，按状态着色，pending 可取消
- **`src/pages/ListingBookingsPage.tsx`**（新文件）：卖家查看某 listing 预约，可接受/拒绝
- **`src/App.tsx`**：新增 `/bookings/mine`、`/listings/:id/bookings` 两条受保护路由
- **`src/pages/ListingDetailPage.tsx`**：listing 详情页下方新增预约区块（卖家→管理链接；买家→预约表单；未登录→登录提示）
- **`src/pages/MyListingsPage.tsx`**：每行新增"Bookings"按钮，跳转到该 listing 的预约管理页
- **`src/pages/ListingsPage.tsx`**：头部新增"My Bookings"链接（仅登录用户可见）

---

## Phase 1 变更记录（2026-03-21）

### 后端
- **`prisma/schema.prisma`**：新增 `enum Condition { new like_new good fair poor }`，`Listing.condition` 从 `String` 改为 `Condition`
- **迁移**：新增 `20260321054941_add_condition_enum` migration
- **`src/listings/condition.enum.ts`**（新文件）：TypeScript enum，与 Prisma enum 保持同步，供 DTO 使用
- **`src/listings/dto/create-listing.dto.ts`**：`@IsIn` → `@IsEnum(Condition)`，去除 `VALID_CONDITIONS` 常量
- **`src/listings/dto/update-listing.dto.ts`**：同上

### 前端
- **`src/constants/conditions.ts`**（新文件）：`CONDITIONS` 数组（含 value/label）+ `CONDITION_LABELS` map + `ListingCondition` 类型 —— 整个前端的单一数据源
- **`src/api/listings.ts`**：`ListingCondition` 从 `constants/conditions` 导入（不再在此处定义）；新增 **401 response interceptor**：token 过期时自动清除 localStorage 并跳转 `/login`
- **`CreateListingPage.tsx` / `EditListingPage.tsx`**：`CONDITIONS` 从 `constants/conditions` 导入，去除本地重复定义
- **`ListingsPage.tsx` / `ListingDetailPage.tsx` / `MyListingsPage.tsx`**：`condition.replace('_', ' ')` → `CONDITION_LABELS[listing.condition]`，显示规范化标签（如 "Like New"）

---

