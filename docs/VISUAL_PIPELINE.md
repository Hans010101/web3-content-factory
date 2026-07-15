# 视觉资产与证据截图流水线

## 目标与输出约定

本模块将中央事件事实包转换为适合币安广场移动端阅读的视觉资产。默认输出为 `1200×1500` PNG（4:5），单篇最多组合四张：结论卡、原始证据、行情卡、事件时间线。

视觉系统使用深色情报终端风格，强调内容层级而不是装饰。所有卡片必须出现来源、更新时间和“非投资建议”声明。传闻不能使用“已确认”状态。

## 目录

| 路径 | 作用 |
| --- | --- |
| `templates/visual/*.html` | Playwright/浏览器渲染模板 |
| `templates/visual/base.css` | 品牌 token 与浏览器样式 |
| `templates/visual/demo-cards.json` | 演示事实包 |
| `lib/visual/render-card.mjs` | 基于 Sharp 的免浏览器 PNG 渲染器 |
| `lib/visual/evidence-config.mjs` | 站点截图 profile、manifest 与 Page 适配器 |
| `lib/visual/qa.mjs` | 数据及位图 QA |
| `scripts/render-visual-demo.mjs` | 批量生成演示图和 QA 报告 |
| `scripts/capture-evidence.mjs` | 截图预检与可选 Playwright 执行入口 |

## 本地生成

现有工程已经间接包含 `sharp`，不需要增加依赖：

```bash
node scripts/render-visual-demo.mjs
```

指定自定义输入和输出目录：

```bash
node scripts/render-visual-demo.mjs path/to/cards.json path/to/output
```

单独检查 PNG：

```bash
node scripts/visual-qa.mjs public/demo-assets/security-brief.png
```

## 卡片输入协议

通用字段：

```json
{
  "id": "event-unique-id",
  "kind": "info",
  "category": "breaking",
  "status": "已确认",
  "updatedAt": "2026-07-14 14:32 SGT",
  "title": "事件标题",
  "source": "官方公告 · 链上数据",
  "reference": "EVT-20260714-031"
}
```

- `info` 额外需要 `summary`，可带最多三个 `metrics`。
- `market` 额外需要 `symbol`、`changePercent`、`window` 和至少两个点的 `series`。
- `timeline` 额外需要 `events`，建议 3–5 项。
- `category` 可选：`breaking`、`market`、`onchain`、`policy`、`research`。

生产接入时应先从事件事实包派生卡片 JSON，再渲染图片；不要把模型自由生成的 HTML 直接交给浏览器。

## 证据截图

截图模块采用可注入 Page 的设计：`captureEvidenceWithPage(page, options)` 只依赖 Playwright Page 兼容接口，不把浏览器依赖绑进主应用。

无需浏览器即可检查站点匹配与截图参数：

```bash
node scripts/capture-evidence.mjs \
  --url=https://www.sec.gov/example \
  --event-id=EVT-20260714-031 \
  --dry-run
```

生产截图 worker 安装 Playwright/Chromium 后，可去掉 `--dry-run`。截图产物必须与同名 JSON manifest 一起保存，manifest 记录原始 URL、抓取时间、profile、viewport 与选择器。后续应在对象存储层补写 SHA-256、HTTP 响应头和归档地址。

当前内置 profile：X、Binance 公告、SEC、GitHub 与通用网页。高频来源应增加专属 profile，并至少做一次回归截图；通用 profile 不适合作为大规模稳定采集方案。

### 截图质量规范

1. 必须保留发布主体、发布时间、正文关键段和来源域名。
2. 隐藏广告、导航、Cookie 浮层及与证据无关的推荐模块。
3. 截图不能代替事实核验；X 普通账号截图默认只能作为线索。
4. 页面不可稳定访问时，使用 API 返回数据生成“来源引用卡”，并附原始 URL，不能伪造网页截图。
5. 所有裁切都保留原图和 manifest，发布图可以二次排版但不得改动原文。

## QA 与发布闸门

自动 QA 当前检查：格式、尺寸、文件大小、透明通道、动态范围、品牌/来源区字体是否实际渲染，以及标题、来源、更新时间和卡片类型必填字段。信息卡还会检查核心信息右侧安全区，文字进入该区域会直接失败；文本总容量则通过估算字宽预警和固定行数截断控制。

上线前还应在截图 worker 增加浏览器像素回归，并在发布队列执行人工抽检：

- 中文字体是否缺字；
- 数字是否与事件事实包一致；
- `已确认/待确认` 标签是否正确；
- 来源与时间是否可见；
- 缩略图状态下标题能否读清；
- 证据图是否包含敏感个人信息。

高风险事件（黑客、监管、上/下币、破产）即使通过自动 QA，也必须进入人工审核。

## 部署建议

主应用只负责提交视觉任务并读取结果。截图与渲染建议拆成独立 worker：

```text
事件事实包 → visual_job 队列 → PNG 渲染 / 证据截图 → QA → 对象存储 → 发布队列
```

渲染任务以 `eventId + templateVersion + contentHash` 作为幂等键。浏览器 worker 使用低权限容器、域名白名单、网络超时和最大页面大小限制，避免任意 URL 带来的 SSRF 与资源耗尽风险。
