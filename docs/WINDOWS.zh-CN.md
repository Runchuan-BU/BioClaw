# Windows 使用说明（最小可用方案）

这份说明面向需要在 Windows 上尽快跑通 BioClaw 的用户，尤其是暂时不走 WhatsApp、而是先本地验证模型和生物工具链的场景。

## 当前现状

- 仓库中的现成消息通道只有 WhatsApp。
- `README.zh-CN.md` 里提到的 QQ / 飞书（Lark）目前是展示和扩展方向，不是已提交的可直接运行实现。
- 对 Windows，当前推荐方案是：
  - Windows 11
  - WSL2
  - Docker Desktop（开启 WSL2 backend）
  - 使用 CLI 模式先本地跑通

## 推荐操作路径

如果你的用户在中国，而且不方便使用 WhatsApp，最现实的顺序是：

1. 先在 Windows 上用 CLI 模式验证 BioClaw 可运行。
2. 确认模型提供方可用。
3. 后续再决定是否接 QQ / 飞书 webhook 频道。

## 安装步骤

### 1. 安装基础环境

- 安装 Node.js 20+
- 安装 Docker Desktop
- 在 Docker Desktop 设置中启用 WSL2 backend

### 2. 克隆并安装依赖

```bash
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
npm install
```

### 3. 配置 `.env`

在项目根目录创建 `.env`。最省事的方式是先复制示例：

```bash
cp config-examples/.env.local-web.example .env
```

如果你在 Windows PowerShell 里操作，也可以直接新建 `.env` 文件，然后把下面内容粘进去。

如果你在中国，通常更适合先用兼容 OpenAI 的提供方：

```bash
ENABLE_WHATSAPP=false
ENABLE_LOCAL_WEB=true
LOCAL_WEB_HOST=127.0.0.1
LOCAL_WEB_PORT=3210

MODEL_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your_api_key
OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example/v1
OPENAI_COMPATIBLE_MODEL=your-model-name
```

这几行分别是什么意思：

- `ENABLE_WHATSAPP=false`
  - 关闭 WhatsApp 通道，避免启动时要求 WhatsApp 认证。
- `ENABLE_LOCAL_WEB=true`
  - 打开本地网页聊天入口。
- `LOCAL_WEB_HOST=127.0.0.1`
  - 只允许本机访问，更安全。
- `LOCAL_WEB_PORT=3210`
  - 本地网页聊天端口，浏览器稍后会访问 `http://127.0.0.1:3210`。
- `MODEL_PROVIDER=openai-compatible`
  - 选择兼容 OpenAI 的模型接口。
- `OPENAI_COMPATIBLE_API_KEY`
  - 你从模型服务商那里拿到的密钥。
- `OPENAI_COMPATIBLE_BASE_URL`
  - 服务商提供的 API 根地址，通常以 `/v1` 结尾。
- `OPENAI_COMPATIBLE_MODEL`
  - 具体模型名，按服务商文档填写。

如果你使用 OpenRouter：

```bash
ENABLE_WHATSAPP=false
ENABLE_LOCAL_WEB=true
LOCAL_WEB_HOST=127.0.0.1
LOCAL_WEB_PORT=3210

MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.4
```

如果你还想让外部系统调 webhook，可以再加：

```bash
LOCAL_WEB_SECRET=change-me
```

之后外部系统调用 `POST /webhook` 时，在请求头里带上：

```text
x-bioclaw-secret: change-me
```

### 4. 构建容器镜像

```bash
docker build -t bioclaw-agent:latest ./container
```

### 5. 启动本地网页聊天

```bash
npm run dev
```

然后在浏览器打开：

```text
http://127.0.0.1:3210
```

你会看到一个本地聊天页面，直接输入问题即可。

### 6. 如果只想在终端里用，也可以用 CLI 模式运行

```bash
npm run cli
```

启动后直接输入任务，例如：

```text
Analyze DNA sequence ATGCGATCG and find ORFs
```

网页聊天和 CLI 这两条路径都不依赖 WhatsApp，也不依赖 QQ / 飞书。

## 为什么先推荐 CLI

- 改动最小
- 对 Windows 最稳
- 便于先验证 Docker、模型配置、容器工具链是否正常
- 在 QQ / 飞书通道未实现前，这是最快能交付给用户的使用方式

## QQ / 飞书的实际情况

当前仓库没有 QQ / 飞书通道源码，因此不能只改配置就直接启用。

如果后续要支持中国用户常用平台，建议优先级如下：

1. 飞书（Lark）Bot / Webhook
2. 企业微信 Bot / 应用回调
3. QQ Bot

原因是飞书和企业微信的 Bot / Webhook 方案通常更工程化，接入难度和稳定性都比 QQ 更可控。
