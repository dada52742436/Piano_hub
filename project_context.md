# Project Context — PianoHub

> 用于在 Claude / Codex 新对话中快速恢复项目上下文。  
> 当前状态：**auth hardening、listing status、saved listings、inquiries、transactions、simulated payments、Stripe real payment step 1/2、dashboard、URL-synced listings search 已完成。**

---

## 1. 项目概述

项目路径：

- `x:\my-project150326`

PianoHub 是一个面向墨尔本二手钢琴交易场景的全栈 marketplace 项目。

当前技术栈：

- Backend: NestJS 11 + TypeScript strict + Prisma 7 + PostgreSQL + JWT + bcrypt
- Frontend: React 19 + Vite 8 + TypeScript + React Router v7 + Axios
- Auth: `httpOnly cookie session`
- Payment:
  - 本地开发保留 simulated payment flow
  - 已接入 Stripe Checkout 基础层和 webhook 基础处理

---

## 2. 当前模块完成度

### 已完成的大模块

- Auth
  - register / login / logout
  - cookie session
  - protected profile
- Listings
  - create / read / update / delete
  - search / filter / pagination
  - URL state sync
  - public browse + owner flows
- Listing status
  - `active / sold / archived`
  - public listings only show `active`
- Listing images
  - upload / delete
- Bookings
  - buyer request
  - seller accept / reject
  - buyer cancel
- Saved listings
- Inquiries
- Transactions
  - buyer initiate
  - seller accept
  - buyer confirm
  - seller complete / cancel
  - buyer cancel
  - expiry / release rules
  - complete -> listing sold
  - complete -> close competing transactions / bookings / inquiries
  - terminal transaction 后允许同 buyer 针对同 listing 重新发起新 transaction
- Payments
  - simulated payment flow
  - `paid` is required before transaction can complete
  - Stripe Checkout Session backend
  - Stripe webhook backend
  - frontend `Pay with Stripe` entry
  - success / cancel pages
- Dashboard
  - account stats
  - needs attention
  - seller workspace
  - buyer workspace
  - recent activity
  - payment stats
- Layout
  - shared navbar
  - unified page language

### 当前仍未完成或只完成基础层的部分

- Stripe end-to-end local verification still depends on correct env + Stripe CLI
- README / docs刚刚需要同步到最新 Stripe 阶段
- provider-specific deployment guide 未完成
- Stripe Connect / payout 未开始

---

## 3. 当前关键业务边界

### Inquiry / Booking / Transaction 的区别

- Inquiry = 轻量联系 / 初步咨询
- Booking = 预约 / 跟进
- Transaction = 正式成交流程

不要把 booking 和 transaction 混用。

### Listing status

- public `GET /listings` 只返回 `active`
- `sold / archived` listing 不接受新的 booking / inquiry / transaction
- `/listings/mine` 仍显示 owner 的全部 listings

### Transactions

- 同一 buyer 对同一 listing 同时只能有一条活跃 transaction
- 若旧 transaction 已是 `cancelled / completed`，允许重新发起
- seller accepted 后会写：
  - `sellerAcceptedAt`
  - `expiresAt`
- buyer 超时不推进时，transaction 自动释放为 `cancelled`
- completed 之前必须已有 `paid` payment
- 某 transaction completed 后：
  - listing -> `sold`
  - competing transactions -> `cancelled`
  - competing bookings -> `rejected`
  - open inquiries -> `closed`

### Payments

当前有两层 payment：

1. simulated payment
2. Stripe real payment baseline

当前规则：

- payment 只能在 transaction 已到：
  - `seller_accepted`
  - 或 `buyer_confirmed`
  时创建
- `paid` payment 是 transaction `completed` 的前置条件
- frontend 仍保留 simulate 按钮作为开发 fallback

---

## 4. 当前 Stripe 状态

### 已完成

Backend:

- `POST /transactions/:transactionId/payments/checkout-session`
- `POST /payments/webhook`
- payment table 已新增：
  - `providerCheckoutSessionId`
  - `checkoutUrl`
- Stripe webhook 处理：
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`

Frontend:

- `My Transactions` 里新增：
  - `Pay with Stripe`
  - `Resume Stripe Checkout`
- `My Payments` 可显示 provider，并恢复 pending Stripe checkout
- 新增：
  - `/payments/success`
  - `/payments/cancel`

### 当前最常见问题

真实 Stripe checkout 失败时，优先排查：

1. `backend/.env` 是否已配置：
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_SUCCESS_URL`
   - `STRIPE_CANCEL_URL`
   - `STRIPE_CURRENCY`
2. 后端是否已重启
3. `stripe listen --forward-to http://localhost:3001/payments/webhook` 是否正在运行
4. `STRIPE_WEBHOOK_SECRET` 是否和当前 CLI 输出一致
5. transaction 状态是否确实为：
   - `seller_accepted`
   - 或 `buyer_confirmed`

### 当前真实状态

最近一次检查中，用户本地 `backend/.env` 里：

- `STRIPE_SECRET_KEY` 已帮用户写入
- `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` / `STRIPE_CURRENCY` 已写入
- `STRIPE_WEBHOOK_SECRET` 仍需用户从 `stripe listen` 输出中手动填入

---

## 5. 当前关键文件

### 后端

- [backend/src/auth/auth.controller.ts](/x:/my-project150326/backend/src/auth/auth.controller.ts)
- [backend/src/auth/jwt.strategy.ts](/x:/my-project150326/backend/src/auth/jwt.strategy.ts)
- [backend/src/listings/listings.service.ts](/x:/my-project150326/backend/src/listings/listings.service.ts)
- [backend/src/bookings/bookings.service.ts](/x:/my-project150326/backend/src/bookings/bookings.service.ts)
- [backend/src/inquiries/inquiries.service.ts](/x:/my-project150326/backend/src/inquiries/inquiries.service.ts)
- [backend/src/transactions/transactions.service.ts](/x:/my-project150326/backend/src/transactions/transactions.service.ts)
- [backend/src/payments/payments.service.ts](/x:/my-project150326/backend/src/payments/payments.service.ts)
- [backend/src/payments/payments.controller.ts](/x:/my-project150326/backend/src/payments/payments.controller.ts)
- [backend/src/payments/stripe.service.ts](/x:/my-project150326/backend/src/payments/stripe.service.ts)
- [backend/test/app.e2e-spec.ts](/x:/my-project150326/backend/test/app.e2e-spec.ts)

### 前端

- [frontend/src/context/AuthContext.tsx](/x:/my-project150326/frontend/src/context/AuthContext.tsx)
- [frontend/src/api/client.ts](/x:/my-project150326/frontend/src/api/client.ts)
- [frontend/src/api/payments.ts](/x:/my-project150326/frontend/src/api/payments.ts)
- [frontend/src/pages/MyTransactionsPage.tsx](/x:/my-project150326/frontend/src/pages/MyTransactionsPage.tsx)
- [frontend/src/pages/MyPaymentsPage.tsx](/x:/my-project150326/frontend/src/pages/MyPaymentsPage.tsx)
- [frontend/src/pages/ListingTransactionsPage.tsx](/x:/my-project150326/frontend/src/pages/ListingTransactionsPage.tsx)
- [frontend/src/pages/PaymentSuccessPage.tsx](/x:/my-project150326/frontend/src/pages/PaymentSuccessPage.tsx)
- [frontend/src/pages/PaymentCancelPage.tsx](/x:/my-project150326/frontend/src/pages/PaymentCancelPage.tsx)
- [frontend/src/pages/DashboardPage.tsx](/x:/my-project150326/frontend/src/pages/DashboardPage.tsx)
- [frontend/src/pages/ListingsPage.tsx](/x:/my-project150326/frontend/src/pages/ListingsPage.tsx)

---

## 6. 当前测试基线

### Backend unit tests

```bash
cd backend
npx jest --runInBand
```

当前总数：

- `74`

### Backend e2e

```bash
cd backend
npm run test:e2e
```

当前总数：

- `73`

已覆盖：

- auth / cookie session
- protected profile
- listings
- listing status
- bookings
- listing images
- saved listings
- inquiries
- transactions
- payments（模拟主链路）

### Frontend typecheck

```bash
cd frontend
.\node_modules\.bin\tsc -b --pretty false
```

最近一次在真实 payment step 2 后已通过。

---

## 7. 已知上下文与协作偏好

用户偏好：

- 中文沟通
- 按 step 推进，不喜欢无边界自动扩展
- 大模块默认 backend-first
- 每做完一个 step 要给出清楚的：
  - current goal
  - files to add/modify
  - responsibilities
  - code summary
  - run / test / issues / completed

文档约定：

- `README_DEV.md` 是当前最可信的中文开发快照
- `project_context.md` 是为后续 AI 接手准备的上下文恢复文件

---

## 8. 建议的下一步方向

最自然的后续方向有：

1. Stripe 本地联调收尾
   - 配齐 webhook secret
   - 跑通一次真实 checkout -> webhook -> paid -> complete
2. 更新 README / README_DEV 到当前 Stripe 阶段
3. provider 级部署说明（优先 Railway）
4. Stripe Connect / marketplace payout 设计
