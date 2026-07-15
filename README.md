# Web3 内容工厂

面向币安广场内容矩阵的 Web3 热点情报工作台。系统把分散的数据源收敛为可追溯的事件事实包，完成去重、热度评分、账号路由、二创、配图审核与发布编排。

当前版本包含可本地运行的控制台、真实数据源适配器、个人 API 配置中心、模型生成接口和 HTTP API。免密来源可直接采集；X、CoinGecko、YouTube、链上 RPC 等来源在用户填写自己的密钥后启用。默认不要求任何密钥，也不会向外部账号发布内容。

## 核心流程

```text
数据源适配器 -> 原始素材 -> 事件聚类/去重 -> 热点评分 -> 事实包
                                              |
                                              v
                                    账号路由 -> 文案/视觉素材
                                              |
                                              v
                                      审核队列 -> 发布适配器
```

设计原则：

- 免费信号源负责广覆盖，付费源只增强高价值候选事件。
- X/社区内容用于发现，一手来源与链上/市场数据用于确认。
- 模型只基于结构化事实包写作，不允许凭空补全事实。
- 同一事件只指定一个主账号；其他账号必须提供独立角度。
- 默认 `dry-run`，所有外部发布都要求显式启用并保留审计记录。

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

开发地址以终端输出为准，通常为 `http://localhost:3000`。另开终端执行校验：

```bash
npm run lint
npm test
npm run build
```

本地无需配置密钥。需要准备接入配置时：

```bash
cp config/env.example .env.local
```

不要提交 `.env.local`、Square API Key、OAuth Token 或任何私钥。仓库根目录 `.env.example` 是当前代码实际读取的最小运行变量清单；`config/env.example` 是后续完整部署的环境蓝图。两者的同名发布密钥保持一致，正式部署时只生成一份环境配置。

### 个人配置中心

打开控制台左侧“配置中心”即可按当前用户配置：

- DeepSeek、OpenRouter 或任意 OpenAI Chat Completions 兼容模型。
- X、CoinGecko、YouTube、GitHub、EVM RPC 与交易所官方 RSS/Atom。
- 四个相互独立的 Binance Square 内容账号凭据。

本地未绑定 D1 时使用进程内临时加密存储，服务重启后配置会清空；本地 Sites 开发环境绑定 D1 时会持久化公开配置。部署环境使用 D1 表 `user_integrations` 与 `user_ai_preferences`，实际包含密钥的配置经 AES-GCM 加密后保存，列表 API 只返回是否已配置，绝不返回明文。生产环境必须在平台密钥管理中设置高强度 `MASTER_ENCRYPTION_KEY`；纯公开 URL 等不含秘密字段的配置无需该密钥。

内容工作台会调用当前用户选择的默认模型；模型未配置或调用失败时，会明确提示并回退到本地事实模板。数据采集接口也会自动合并当前用户保存的对应来源配置。

### 来源诊断与容错路由

信息源中心采用“首选后端 → 备选后端”的有序路由，并对每个渠道执行真实轻量探测。单个渠道异常会被隔离，诊断结果包含当前后端、接入等级、耗时和处理建议，并缓存 60 秒以减少重复外部请求。

新增“公开网页监控”用于没有 RSS 的项目官网和长文：优先通过 Jina Reader 提取正文，失败后回退公开网页直读；内容指纹变化才会形成新事件。该功能拒绝本机、私有网段和带内嵌凭据的 URL，避免把采集接口变成内网访问通道。

这一能力层的设计借鉴了 MIT 许可项目 [Agent-Reach](https://github.com/Panniantong/Agent-Reach) 的 ordered backends、doctor 和真实探测思想；没有引入其桌面 Cookie、浏览器登录态或本地 CLI 依赖，因为这些路径不适合 Cloudflare 多用户服务，也可能增加平台封号风险。

### 采集 API

不传来源时可用演示信号验证完整入库流程：

```bash
curl -X POST http://localhost:3000/api/collect \
  -H 'content-type: application/json' \
  -d '{"adapters":["mock"],"topics":["BTC"],"limitPerAdapter":10}'
```

采集 Binance 公开市场异动（无需账号）：

```bash
curl -X POST http://localhost:3000/api/collect \
  -H 'content-type: application/json' \
  -d '{"adapters":["binance-market"],"topics":["BTC","ETH","BNB"],"limitPerAdapter":10,"configs":{"binance-market":{"changeThreshold":3}}}'
```

RSS 通过请求中的 `configs.rss.feedUrls` 指定已审核的官方 Feed。可用 `GET /api/health` 检查适配器，`GET /api/dashboard` 获取工作台数据。事件草稿经审批和入队后，调用 `POST /api/publications/run` 会处理已到期队列；当前使用 dry-run Mock Square 发布器，返回模拟帖子 ID，不会触达真实账号。

## Docker 预演

Docker 文件用于在正式部署前验证可重复构建，不替代 Cloudflare Sites/D1 的最终托管配置。

```bash
docker compose up --build
```

容器默认以开发模式启动并映射 `3000` 端口。真实生产部署前应按 [部署手册](docs/DEPLOYMENT.md) 完成数据库、对象存储、队列、密钥托管和可观测性设计。

## 配置目录

- `config/sources.example.json`：免费优先的数据源目录、预算与采集频率。
- `config/accounts.example.json`：内容矩阵账号定位、主题、风格和风控阈值。
- `config/policies.example.json`：评分、自动化分级、去重和发布策略。
- `config/env.example`：外部服务密钥的环境变量名称，不含真实值。

建议复制 example 文件形成环境专属配置，不要直接改模板。账号配置中的 `secretEnv` 只保存环境变量名，密钥值始终由部署环境注入。

## 文档

- [系统架构](docs/ARCHITECTURE.md)
- [数据源接入指南](docs/DATA_SOURCES.md)
- [币安广场多账号发布](docs/BINANCE_SQUARE.md)
- [运维、合规与故障处理](docs/OPERATIONS.md)
- [后续部署步骤](docs/DEPLOYMENT.md)

## 当前边界

本仓库现在可以演示和验证工作流，但正式上线前仍需完成：

1. 申请并验证需要认证的数据源账号、配额和内容使用条款。
2. 为现有适配器补齐生产级限流、游标、缓存、失败队列和来源条款监控。
3. 选择截图浏览器运行环境和对象存储，并完成真实页面证据截图授权测试。
4. 为每个合法授权的币安广场账号申请独立发布 Key。
5. 建立审核值班、撤稿、版权投诉与安全事件流程。

任何自动生成内容都不应构成投资建议。监管、上/下币、安全攻击、破产、资产冻结及匿名爆料必须人工复核。
