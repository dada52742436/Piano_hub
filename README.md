# PianoHub Melbourne

> 墨尔本二手钢琴交易平台 MVP — A marketplace for buying and selling second-hand pianos in Melbourne, Australia.

---

## 项目简介

本项目是一个面向墨尔本地区的二手钢琴买卖平台。卖家可以发布钢琴 Listing，买家可以浏览和查看详情。平台采用 JWT 身份认证保护卖家操作，并在后端做所有权校验，防止用户篡改他人数据。

**技术栈：**
- **Backend**: NestJS 11 (strict TypeScript) + Prisma 7 + PostgreSQL + JWT
- **Frontend**: React 19 + Vite 8 + TypeScript + React Router v7 + Axios

---

## 已实现功能

### 1. 用户认证系统

| 功能 | 说明 |
|------|------|
| 用户注册 | 邮箱 + 用户名 + 密码，bcrypt（saltRounds=10）加密存储 |
| 用户登录 | 邮箱 + 密码，验证成功返回 JWT Access Token |
| JWT 认证 | Bearer Token，有效期 7 天，所有受保护接口统一校验 |
| 全局 Auth 状态 | React Context + localStorage，刷新页面不丢失登录状态 |
| 受保护路由 | 前端 `ProtectedRoute` 组件，未登录访问自动跳转 `/login` |

### 2. Listing（钢琴发布）模块

#### 2a. 后端 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/listings` | 获取所有 listings（含卖家公开信息） | 无 |
| GET | `/listings/mine` | 获取当前登录用户发布的所有 listings | JWT |
| GET | `/listings/:id` | 获取单个 listing 详情 | 无 |
| POST | `/listings` | 创建新 listing | JWT |
| PATCH | `/listings/:id` | 编辑 listing（仅本人，否则返回 403） | JWT |
| DELETE | `/listings/:id` | 删除 listing（仅本人，否则返回 403） | JWT |

**字段说明：**
- `title`（必填，3–100字符）
- `description`（必填，10–2000字符）
- `price`（必填，≥ 0，AUD）
- `condition`（必填，枚举：`new` / `like_new` / `good` / `fair` / `poor`）
- `brand`（选填）
- `location`（选填，墨尔本区域）

**所有权校验：** `ownerId` 始终从 JWT 注入（`req.user.id`），不接受客户端传入；编辑/删除操作若非本人触发 403。

#### 2b. 前端页面

| 路径 | 页面 | 说明 | 保护 |
|------|------|------|------|
| `/listings` | `ListingsPage` | 所有 listings 网格展示，AUD 价格，登录后显示发布/我的按钮 | 公开 |
| `/listings/:id` | `ListingDetailPage` | 单个 listing 详情，本人显示 Edit / Delete 按钮 | 公开 |
| `/listings/new` | `CreateListingPage` | 发布新 listing 表单 | 需登录 |
| `/listings/mine` | `MyListingsPage` | 当前用户所有发布，支持直接删除 | 需登录 |
| `/listings/:id/edit` | `EditListingPage` | 预填充编辑表单，非本人自动跳走 | 需登录 |

### 3. 导航与路由

- 默认路径 `/` 重定向至 `/listings`
- 登录 / 注册成功后跳转 `/listings`
- `DashboardPage` 提供「Browse Listings」快捷跳转
- `ListingsPage` 提供「Dashboard」快捷跳转

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
  condition   String
  location    String?
  ownerId     Int
  owner       User     @relation(fields: [ownerId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("listings")
}
```

---

## 环境要求

- Node.js 22+
- PostgreSQL（本地 5432，数据库名：`auth_demo`）

**`backend/.env` 配置：**

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/auth_demo"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"
```

---

## 启动方式

```powershell
# 终端 1 — 后端（http://localhost:3001）
cd backend
npm run start:dev

# 终端 2 — 前端（http://localhost:3000）
cd frontend
npm run dev
```

> 前端通过 Vite proxy 将 `/api` 请求转发至 `localhost:3001`，无需手动处理跨域。

---

## 目录结构

```
my-project150326/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          ← User + Listing 模型
│   ├── prisma.config.ts           ← Prisma 7 配置（含 datasource.url）
│   ├── src/
│   │   ├── auth/                  ← 注册、登录、JWT 策略、Guard
│   │   ├── users/                 ← UsersService
│   │   ├── listings/              ← Listings CRUD 模块
│   │   │   ├── dto/
│   │   │   ├── listings.service.ts
│   │   │   ├── listings.controller.ts
│   │   │   └── listings.module.ts
│   │   ├── prisma/                ← PrismaService（组合模式）
│   │   └── main.ts                ← 端口 3001, CORS, ValidationPipe
│   └── generated/prisma/          ← Prisma Client（由 prisma generate 生成）
└── frontend/
    ├── vite.config.ts             ← port:3000, proxy /api → :3001
    └── src/
        ├── api/
        │   ├── auth.ts            ← axios 实例 + 拦截器 + auth 方法
        │   └── listings.ts        ← listings CRUD 方法 + 类型
        ├── context/AuthContext.tsx
        ├── components/ProtectedRoute.tsx
        └── pages/                 ← 所有页面组件
```

---

## 待实现功能

- [ ] 全局 Navbar 导航栏
- [ ] 搜索 / 筛选（价格区间、品牌、成色）
- [ ] 图片上传
- [ ] 买家联系卖家（站内消息系统）

预约流程全靠微信/电话

客户管理混乱

很难建立评价和信誉体系

所以这个平台做的事情就是：

把“钢琴买卖 + 服务预约 + 用户评价 + 商家管理”整合成一个完整系统。

二、为什么这个项目很适合你

结合你现在的方向，这个项目特别适合你：

你想做后端 + 部分前端

你想做一个有竞争力的全栈项目

你以后想投 full-stack / backend / software engineer

你平时也更适合做有真实业务逻辑的系统，而不是纯展示型项目

这个项目的好处是它能同时体现：

用户认证

权限管理

数据建模

订单系统

支付系统

搜索筛选

文件上传

地图和区域服务

消息通知

后台管理

这类项目比“博客系统”“待办清单”“电影网站”更有说服力。

三、项目核心模块大纲

我建议你把项目拆成 5个核心业务模块。

1. 用户系统

角色建议分成四类：

Buyer / Customer：普通用户，买钢琴、预约服务

Seller / Service Provider：卖家、调音师、维修师、搬运人员、老师

Admin：平台管理员

Guest：未登录游客

主要功能

注册 / 登录

邮箱验证

忘记密码

用户资料页

地址管理

收藏功能

查看订单 / 预约记录

2. 二手钢琴市场模块

这是平台的 Marketplace 部分。

用户可以做的事

浏览钢琴列表

搜索品牌（Yamaha, Kawai 等）

筛选价格、类型、地区、成色

查看钢琴详情页

收藏商品

联系卖家

下单或提交询价

卖家可以做的事

发布钢琴

上传图片

设置价格

填写品牌、型号、年份、状态

标记是否含搬运

管理上架/下架状态

详情页信息建议

品牌

型号

类型（upright / grand）

年份

状态

调音记录

是否含送货

所在 suburb

图片

卖家评分

3. 服务预约模块

这个是平台最核心、最有商业味道的模块。

服务分类可以有：

Piano Tuning

Piano Repair

Piano Moving

Piano Lessons

用户端功能

选择服务类型

选择日期时间

填写地址

填写钢琴信息

选择服务商

支付订金或全款

查看预约状态

服务商功能

设置可预约时间

设置服务区域

设置价格

接单 / 拒单

查看即将到来的预约

标记服务完成

查看收入记录

预约状态建议

Pending

Confirmed

In Progress

Completed

Cancelled

Refunded

4. 评价与信誉系统

这是平台能不能显得“真实”的关键。

功能

用户完成服务后评分

对卖家和服务商写评论

展示平均评分

展示服务次数

举报虚假评论

管理员审核异常内容

这个模块会让你的项目看起来更像真实产品，而不是课程作业。

5. 后台管理系统 Admin Dashboard

这是面试官很爱看的部分，因为它体现你理解完整业务。

管理员功能

查看所有用户

管理商品发布

审核服务商资料

处理举报

查看订单与预约

查看平台收入

数据统计图表

冻结账号 / 下架内容

四、完整业务流程

下面我按真实产品流程给你讲。

流程 1：普通用户预约调音
步骤

用户注册登录

进入调音服务页

输入地址和 suburb

平台筛选附近可服务的调音师

用户查看价格、评分、可预约时间

选择时间并提交预约

支付订金

调音师收到通知

调音师确认订单

用户在预约当天完成服务

平台更新订单状态为 completed

用户留下评分和评论

技术上涉及

登录认证

地址和区域匹配

日历预约

支付

状态机流转

通知系统

评论系统

流程 2：卖家发布二手钢琴
步骤

卖家注册为 seller

填写钢琴品牌、型号、状态等

上传图片

提交审核或直接发布

用户浏览商品

用户联系卖家或下单

平台记录成交

用户可追加搬运服务

技术上涉及

文件上传

表单校验

商品 CRUD

搜索和筛选

订单系统

商家后台

流程 3：服务商入驻平台
步骤

服务商申请入驻

提交个人资料、证书、服务区域、报价

管理员审核

审核通过后可接单

服务商设置可预约时间

用户下单后服务商确认

服务完成后进入收入统计

技术上涉及

多角色权限

审核流程

后台管理

可用时间管理

收入记录

五、你怎么做这个项目：开发流程

我建议你不要一口气做完，而是按MVP → 增强版 → 商业化版三阶段推进。

阶段 1：MVP 最小可用版本

先做最核心的东西，让项目能跑起来。

目标

做出一个可演示的网站，支持：

注册登录

浏览钢琴商品

发布商品

浏览服务

提交预约

后台查看订单

技术重点

Auth

Database schema

API routes

Basic UI

CRUD

这个阶段做完，你已经可以写进简历了
阶段 2：增强版

把项目从“作业”变成“作品”。

增加

Stripe 支付

邮件通知

评分评论

搜索和筛选

图片上传

服务商可用时间

Admin Dashboard

数据统计

这个阶段做完，竞争力会明显提升
阶段 3：商业化版

把它往真实创业产品方向推。

增加

平台抽成

多城市支持

Google Maps

区域服务范围

聊天/站内消息

服务商订阅会员

优先曝光

SEO 优化

六、技术栈推荐

你想以后偏后端和全栈，我建议这套：

前端

Next.js

TypeScript

Tailwind CSS

shadcn/ui

后端

Next.js Route Handlers 或 NestJS

我更建议你先用 Next.js 全栈

后期再拆服务也行

数据库

PostgreSQL

Prisma ORM

认证

Auth.js 或 Clerk

我更建议你用 Auth.js，面试更能讲原理

文件上传

UploadThing 或 AWS S3

支付

Stripe

地图

Google Maps API

通知

Resend 发邮件

或 Twilio 发短信

部署

Vercel（前端和 API）

Supabase / Neon（数据库）

七、数据库表设计思路

你很重视数据库，这个项目也正好能体现你这方面的优势。

核心表建议如下：

users

id

name

email

password_hash

role

phone

avatar_url

created_at

provider_profiles

id

user_id

provider_type

bio

suburb

travel_radius_km

hourly_rate

verified

piano_listings

id

seller_id

brand

model

piano_type

year

condition

price

suburb

description

status

listing_images

id

listing_id

image_url

sort_order

services

id

provider_id

service_type

title

price

duration_minutes

active

availability_slots

id

provider_id

start_time

end_time

is_booked

bookings

id

customer_id

provider_id

service_id

booking_date

status

address

notes

total_price

orders

id

buyer_id

listing_id

status

total_price

payment_status

reviews

id

reviewer_id

target_user_id

booking_id

rating

comment

payments

id

booking_id / order_id

amount

currency

status

stripe_payment_intent_id

admin_reports

id

reporter_id

target_type

target_id

reason

status

八、你如何收益

这个部分我分成项目收益和商业收益两层讲。

第一层：你作为求职者的收益

这是你最现实、最先能拿到的收益。

1. 简历价值很高

你可以在简历里写：

Built a full-stack marketplace and booking platform for piano services

Implemented role-based access control, scheduling, payments, reviews, and admin dashboard

Designed relational database schema using PostgreSQL and Prisma

Deployed scalable production-ready application using Vercel and cloud services

这类描述比“做了个博客”强很多。

2. 面试时特别好讲

这个项目很适合回答下面这些常见问题：

你做过什么复杂项目？

你是怎么设计数据库的？

如何处理权限控制？

订单状态怎么管理？

如何防止重复预约？

如何设计支付流程？

你如何处理文件上传和搜索筛选？

也就是说，它非常适合拿来做项目深挖题。

3. 展示你不只是写页面

很多毕业生项目只会做：

登录

展示列表

点进详情页

但你这个项目能展示：

真实业务建模

平台型产品思维

多角色权限

商业逻辑

后台系统

这会让你更像一个真正的软件工程候选人。

第二层：你作为产品 owner 的收益

如果以后你真的想试着变现，这项目也有空间。

模式 1：服务预约抽成

平台每一单抽 10%-15%

例如：

调音 $220

平台抽成 $22

如果一个月 100 单，就是：

$2,200 / 月

模式 2：卖家上架收费

例如：

普通免费

置顶商品 $9.99

首页推荐 $19.99

模式 3：服务商会员

例如：

免费版：每月只能接 5 单

Pro 版：$29 / 月，无限接单、优先展示

模式 4：广告和推荐

例如：

钢琴搬运推荐

钢琴老师推荐

琴行广告位

模式 5：线索费

就算用户没在线支付，只要你把客户线索提供给服务商，也可以收 lead fee。

九、这个项目怎么落地最现实

我建议你现在不要想着“一上线就赚钱”，而是按下面思路：

第一步

把它当成高质量求职项目

目标：

做出能上线展示的版本

写进简历

放到 GitHub

放到 portfolio

第二步

找真实用户验证
比如：

华人钢琴群

Facebook Marketplace 卖家

墨尔本调音师

钢琴老师

问他们：

愿不愿意用一个统一预约平台

最需要的功能是什么

第三步

只测试一个细分场景
例如先只做：

钢琴调音预约平台

不要一开始全做买卖、维修、搬运、老师。

你可以先从一个垂直点切进去，再扩展。

十、你应该怎么开始

我建议你的启动顺序是：

第 1 周

确定项目功能范围

画页面结构图

设计数据库 ERD

建立 Next.js 项目

做登录注册

第 2 周

做用户资料

做钢琴列表和详情页

做发布商品功能

第 3 周

做服务列表

做预约提交

做订单状态

第 4 周

做商家后台

做管理员后台基础功能

第 5 周

接 Stripe

接图片上传

做评论系统

第 6 周

优化 UI

部署上线

写 README

准备项目讲解稿

十一、你最后能拿到什么

如果你认真做完，最后你会有：

一个完整全栈项目

一个可上线访问的网站

一个高质量 GitHub 仓库

一套能在面试里反复使用的项目故事

一份很强的简历项目经历

甚至一个未来可变现的小产品雏形

十二、我对你的建议

对你来说，最好的收益路径不是“先拿这个赚钱”，而是：

先用它帮你拿到更好的软件岗位机会。

因为你现在真正最值钱的，不是钢琴行业本身，而是你把一个真实行业需求做成软件产品的能力。

这个能力，比项目本身更值钱。
