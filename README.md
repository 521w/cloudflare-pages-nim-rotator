# Cloudflare Pages 多 key 轮换代理 → NVIDIA NIM

不花现金、不缠本地进程。GitHub + Cloudflare Pages 一键部署：

- 克隆仓库
- Pages 连到 GitHub
- Dashboard 里绑 2 个 KV namespace + 2 个 env var
- 部署完拿 Pages URL 当 OpenAI 兼容 endpoint 用
- 浏览器访问 `/admin` 看到管理面板（添加 / 验证 / 删 key + 7 日统计）

## 仓库结构

```
functions/
  v1/chat/completions.js   ← OpenAI 兼容 chat completions · 多 key 轮换
  v1/models.js             ← OpenAI 兼容 models list
  health.js                ← 健康检查
  admin/                   ← 管理面板
    _middleware.js         ← cookie 鉴权
    index.js               ← GET /admin · SPA HTML
    api/
      login.js             ← POST /admin/api/login  { password }
      logout.js            ← POST /admin/api/logout
      keys.js              ← GET/POST/PUT/DELETE/TOGGLE/CLEAR-COOLDOWN
      test.js              ← POST /admin/api/test  单 key 验证
      stats.js             ← GET /admin/api/stats   7 日统计
index.html                 ← Pages 默认首页
package.json               ← 占位(无 npm 依赖)
```

Functions 自动识别 · 不需要 wrangler · 不需要 npm install

## 用法 · 客户端

部署完成后,你的 endpoint = `https://YOUR-PROJ.pages.dev/v1`

### OpenAI SDK（Python · Node.js · Hermes）

```python
from openai import OpenAI
client = OpenAI(
    base_url="https://YOUR-PROJ.pages.dev/v1",
    api_key="anything",
)
resp = client.chat.completions.create(
    model="meta/llama-3.3-70b-instruct",
    messages=[{"role": "user", "content": "hello"}],
)
print(resp.choices[0].message.content)
```

### Hermes Agent `~/.hermes/config.yaml`

```yaml
providers:
  - name: nim_cf_pages
    type: openai
    base_url: "https://YOUR-PROJ.pages.dev/v1"
    api_key: "anything"
    models:
      - meta/llama-3.3-70b-instruct
default_provider: nim_cf_pages
default_model: meta/llama-3.3-70b-instruct
```

### 健康检查

```
curl https://YOUR-PROJ.pages.dev/health
```

返回活跃 / cooldown / disabled / total keys 列表。

## 部署 · 5 步

### 1. Cloudflare Pages 创建项目

- 登录 https://dash.cloudflare.com
- `Workers & Pages` → `Create`
- `Pages` 标签 → `Connect to Git` → 选 `521w/cloudflare-pages-nim-rotator`
- Build settings:
  - Build command: **留空**
  - Build output directory: **留空** (或 `/`)
  - Root directory: **留空** (或 `/`)
- `Save and Deploy`

### 2. 创建并绑定 2 个 KV namespace

`Storage` → `KV` → `Create a namespace`:

| Namespace | 名字 |
|---|---|
| 第一个 | `nim_keys` |
| 第二个 | `nim_stats` |

回到 Pages → 项目 → `Settings` → `Functions` → `KV namespace bindings`:

| Variable name | KV namespace |
|---|---|
| `NIM_KEYS` | `nim_keys` |
| `NIM_STATS` | `nim_stats` |

绑完须 `Retry deployment` 一次。

### 3. 设置 2 个 env var

Pages → 项目 → `Settings` → `Environment variables`:

| Variable name | Value | Type |
|---|---|---|
| `ADMIN_PASSWORD` | 你设置的密码（随便长一点） | Secret |
| `ADMIN_SECRET` | 一长串随机字符串（≥ 32 字符） | Secret |

```bash
# 生成 ADMIN_SECRET:
openssl rand -hex 32
```

### 4. 加 key （两种方式）

**方式 A · Dashboard 手动**
`Storage` → `KV` → `nim_keys` → 加一行：

| Key 名称 | Value |
|---|---|
| `key:1` | `{"value":"nvapi-真实key1","cooldownUntil":0,"active":true,"note":"home"}` |

每个 key 添加一行，id 建议 `key:1`、`key:2`、`key:3` 等连续。

**方式 B · 管理面板**
浏览器打开 `https://YOUR-PROJ.pages.dev/admin` → 输密码 → 「添加新 key」表单。管理面板功能：

- 列表：所有 key + 状态（active / cooldown / disabled）
- 添加：填 id(可省) + nvapi-长字符串 + 备注
- 验证：点「验证」按钮 → 1-3 秒返回 ok/fail + 延迟 + 模型数
- 启用/禁用：toggle 开关，被禁用的 key 不参与轮换
- 清 cooldown：手动恢复冷却中的 key
- 删除：一键删（不可恢复）
- 统计：今日/7 日共请求数 + ok/fail

### 5. 验证

```bash
curl https://YOUR-PROJ.pages.dev/health
```

```bash
curl https://YOUR-PROJ.pages.dev/v1/chat/completions \
  -H "Authorization: Bearer anything" \
  -H "Content-Type: application/json" \
  -d '{"model":"meta/llama-3.3-70b-instruct","messages":[{"role":"user","content":"hi"}]}'
```

第一条返回 200 + 模型输出 → 完成。

## 多 key 轮换怎么工作

1. 每次请求 → Pages Function 读 KV 所有 `key:*` 记录
2. 跳过 `active=false` 和 `cooldownUntil > now` 的
3. 候选空了 → 返回 503 `all keys cooling down or disabled`
4. 随机选一条 → 透传 NVIDIA NIM
5. NIM 返回 429/402 → KV 里更新 `cooldownUntil = now + retry-after` (默认 5 分钟) + 记 `lastFailStatus`/`lastFailAt`
6. 写一行 stats 计数:`stats:YYYY-MM-DD:total / ok / fail / status:CODE / key:id`

冷却期间该 key 不会被选中。冷却结束后自动恢复。

## 限制

- Cloudflare Pages 免费层 **100,000 请求/天**,超出 503
- 不绑卡·不充电费·0 元
- Function cold start ~100ms · 首请求慢点
- 只支持 `/v1/chat/completions` 和 `/v1/models` · embedding / rerank 不支持
- KV 限额:100k read/天 + 1k write/天 · 冷却写不频繁,配额一般不会撞
- stats 保留 14 天 (TTL)

## 安全

- 管理面板 `/admin/*` 用 HMAC-SHA-256 签名 cookie 鉴权,设 `ADMIN_PASSWORD` + `ADMIN_SECRET` 两 env
- `ADMIN_SECRET` 缺失或为默认值时仍可登录但 cookie 不安全 — 部署后务必设置
- 在公网开放前提:`ADMIN_PASSWORD` 用强密码 (≥ 16 字符)
- `PROXY_AUTH` env 设任意字符串客户端带 `Authorization: Bearer xxx` · 简化可空
- 不暴露 nvapi 完整 key,KV 里就是源 — Pages project 只你能访问

## 许可证

MIT · 自由使用
