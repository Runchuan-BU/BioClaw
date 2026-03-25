<div align="center">
<img src="bioclaw_logo.jpg" width="200">

# BioClaw

### 在聊天里跑生物信息学分析的 AI 助手

[English](README.md) | [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Runchuan-BU/BioClaw)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Runchuan-BU/BioClaw/blob/main/LICENSE)
[![Paper](https://img.shields.io/badge/bioRxiv-STELLA-b31b1b.svg)](https://www.biorxiv.org/content/10.1101/2025.07.01.662467v2)
[![arXiv](https://img.shields.io/badge/arXiv-2507.02004-b31b1b.svg)](https://arxiv.org/abs/2507.02004)

<p align="center">
  新的 BioClaw 兼容 skills 会先提交到 <a href="https://github.com/zongtingwei/Bioclaw_Skills_Hub">Bioclaw_Skills_Hub</a> 仓库，在那里先完成迭代和测试，再视效果同步到主 BioClaw 仓库中。如果你想贡献新的 skills，请优先提交到该仓库。经过验证、效果稳定的 skills，后续会逐步整合进 BioClaw。若想获取这些后续合入的 skills 和更新内容，请在本仓库中执行 <code>git pull</code>。
</p>

</div>

---

## 目录

- [概览](#概览)
- [快速开始](#快速开始)
- [消息通道](#消息通道)
- [示例演示](#示例演示)
- [系统架构](#系统架构)
- [内置工具](#内置工具)
- [项目结构](#项目结构)
- [引用](#引用)
- [许可证](#许可证)

## 概览

BioClaw 将常见的生物信息学任务带到聊天界面中。研究者可以通过自然语言完成：

- BLAST 序列检索
- 蛋白结构渲染（PyMOL）
- 测序数据质控（FastQC / MultiQC）
- 差异分析可视化（火山图等）
- 文献检索与摘要

默认通道为 WhatsApp；飞书、企业微信、Discord、Slack、本地网页等配置见 **[docs/CHANNELS.zh-CN.md](docs/CHANNELS.zh-CN.md)**。飞书的完整配置、OpenRouter 设置、群聊限制与排障见 **[docs/FEISHU_SETUP.zh-CN.md](docs/FEISHU_SETUP.zh-CN.md)**。QQ 相关截图仍为路线图示意，详见该文档。

## 快速开始

### 环境要求

- macOS 或 Linux
- Node.js 20+
- Docker Desktop
- Anthropic API Key 或 OpenRouter API Key

### 安装

**一键安装**（推荐新手使用）：

```bash
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
bash setup.sh
```

安装脚本会自动检查环境、安装依赖、构建 Docker 镜像，并引导你配置 API 密钥。

**手动安装：**

```bash
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
npm install
cp .env.example .env        # 编辑 .env，配置模型提供方密钥（见下文）
docker build -t bioclaw-agent:latest container/
npm start                    # WhatsApp：首次运行请在终端扫描二维码
```

### 模型提供方配置

BioClaw 现在支持两条模型路径：

- **Anthropic**：默认路径，保留原来的 Claude Agent SDK 工作流
- **OpenRouter / OpenAI-compatible**：可选路径，适合 OpenRouter 或其他兼容 `/chat/completions` 的服务

请在项目根目录创建 `.env`，然后选择以下其中一种配置。

**方案 A：Anthropic（默认）**

```bash
ANTHROPIC_API_KEY=your_anthropic_key
```

**方案 B：OpenRouter**（支持 Gemini、DeepSeek、Claude、GPT 等）

```bash
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=deepseek/deepseek-chat-v3.1
```

常用模型 ID：`deepseek/deepseek-chat-v3.1`、`google/gemini-2.5-flash`、`anthropic/claude-3.5-sonnet`。完整列表：[openrouter.ai/models](https://openrouter.ai/models)

**注意**：请选用支持 [tool calling](https://openrouter.ai/models?supported_parameters=tools) 的模型（如 DeepSeek、Gemini、Claude）。会话历史在单次容器运行期间保留；空闲超时后新容器会以全新上下文启动。

**通用 OpenAI-compatible 配置**

```bash
MODEL_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your_api_key
OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example/v1
OPENAI_COMPATIBLE_MODEL=your-model-name
```

修改 `.env` 后，重启 BioClaw：

```bash
npm run dev
```

容器启动后，可以通过 `docker logs <container-name>` 查看当前实际使用的是哪条 provider 路径。

### 使用

在已接入的群聊中发送：

```text
@Bioclaw <你的请求>
```

## 消息通道

各平台逐步配置、环境变量、本地网页与 **Windows（WSL2）** 说明见 **[docs/CHANNELS.zh-CN.md](docs/CHANNELS.zh-CN.md)**；其中 Windows 细节补充在 **[docs/WINDOWS.zh-CN.md](docs/WINDOWS.zh-CN.md)**。需要**本地浏览器（对话与实验追踪同一页）**时，在项目根目录执行 **`npm run web`** 即可（仍会读取 `.env`）。

英文版通道文档：[docs/CHANNELS.md](docs/CHANNELS.md)。

**Lab trace 观测**（SSE 时间线、工作区树）已内置于本地网页界面，无需额外配置。说明见 [docs/DASHBOARD.md](docs/DASHBOARD.md)。

### Second Quick Start

如果希望更“无脑”地引导安装，给 OpenClaw 发送：

```text
install https://github.com/Runchuan-BU/BioClaw
```

## 示例演示

QQ / 飞书路线图示意截图已移至 [docs/CHANNELS.zh-CN.md](docs/CHANNELS.zh-CN.md)。任务类演示见 [ExampleTask/ExampleTask.md](ExampleTask/ExampleTask.md)。

## 系统架构

BioClaw 基于 NanoClaw 的容器化架构，并融合 STELLA 的生物医学能力：

```
聊天平台 -> Node.js 编排器 -> SQLite 状态 -> Docker 容器 -> Agent + 生物工具
```

## 内置工具

### 命令行工具

- BLAST+
- SAMtools
- BEDTools
- BWA
- minimap2
- FastQC
- seqtk
- fastp
- MultiQC
- seqkit
- bcftools / tabix
- pigz
- sra-toolkit
- salmon / kallisto
- PyMOL

### Python 库

- BioPython
- pandas / NumPy / SciPy
- matplotlib / seaborn
- scikit-learn
- RDKit
- PyDESeq2
- scanpy
- pysam

## 实用脚本

所有脚本位于 `scripts/` 目录：

| 命令 | 脚本 | 说明 |
|------|------|------|
| `bash setup.sh` | `scripts/setup.sh` | 一键安装：检查环境、安装依赖、构建镜像、配置密钥 |
| `npm run web` | `scripts/start-web.mjs` | 启动 BioClaw 本地 Web 界面（聊天 + 实验追踪） |
| `npm run open:web` | `scripts/open-local-web.mjs` | 用默认浏览器打开 Web 界面 |
| `npm run stop:web` | `scripts/stop-bioclaw-web.mjs` | 停止 Web 服务进程 |
| `bash scripts/clear-local-web.sh` | `scripts/clear-local-web.sh` | 清空本地 Web 聊天记录和追踪事件 |
| `npx tsx scripts/test-cli.ts "prompt"` | `scripts/test-cli.ts` | 单次 CLI 测试：发送一个 prompt 到容器 |
| `npx tsx scripts/manage-groups.ts list` | `scripts/manage-groups.ts` | 管理 WhatsApp 群组注册（list / register / remove） |
| `python3 scripts/demo.py` | `scripts/demo.py` | TP53 基因分析演示（容器内运行） |

## 项目结构

```text
BioClaw/
├── src/                   # Node.js 编排器
├── container/             # Agent 镜像与运行器
├── scripts/               # 实用脚本（安装、Web、测试）
├── groups/                # 各群工作区与 CLAUDE.md
├── docs/
│   ├── CHANNELS.md        # 消息通道（英文）
│   ├── CHANNELS.zh-CN.md  # 消息通道（中文）
│   ├── WINDOWS.zh-CN.md   # Windows / 本地网页
│   └── images/            # 文档配图
├── ExampleTask/           # Demo 任务与截图
└── README.md / README.zh-CN.md
```

## 引用

如果你在研究中使用 BioClaw，请参考英文 README 中的 Citation 条目。

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
