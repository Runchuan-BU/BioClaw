<div align="center">
<a href="https://ivegotmagicbean.github.io/BioClaw-Page/">
<img src="bioclaw_logo.jpg" width="200">
</a>

# BioClaw

### 在聊天里跑生物信息学分析的 AI 助手

[English](README.md) | [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Runchuan-BU/BioClaw)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Runchuan-BU/BioClaw/blob/main/LICENSE)
[![Homepage](https://img.shields.io/badge/Homepage-BioClaw-blue.svg)](https://ivegotmagicbean.github.io/BioClaw-Page/zh.html)
[![Paper](https://img.shields.io/badge/bioRxiv-STELLA-b31b1b.svg)](https://www.biorxiv.org/content/10.1101/2025.07.01.662467v2)
[![arXiv](https://img.shields.io/badge/arXiv-2507.02004-b31b1b.svg)](https://arxiv.org/abs/2507.02004)

</div>

<br/><br/>

<h2 align="center">💬 访问官网 & 加入微信群</h2>

<div align="center">
<table>
  <tr>
    <td align="center">
      <a href="https://ivegotmagicbean.github.io/BioClaw-Page/zh.html">
        <img src="https://raw.githubusercontent.com/IveGotMagicBean/BioClaw-Page/main/png/CN_Homepage.png" width="650" alt="BioClaw 官网"/>
        <br/><br/>
        <img src="https://img.shields.io/badge/微信-访问主页_·_扫码入群-07c160?style=for-the-badge&logo=wechat&logoColor=white" height="50" alt="加入微信群"/>
      </a>
      <br/><br/>
      <h3>👆 点击上方图片，访问官网扫码加入微信群！</h3>
    </td>
  </tr>
</table>
</div>

<br/><br/>

<h2 align="center">📄 技术文档</h2>
<div align="center">
<table>
  <tr>
    <td align="center">
      <a href="https://www.biorxiv.org/content/10.64898/2026.04.11.716807v1">
        <img src="docs/images/tech_doc_card.png" width="650" alt="BioClaw 技术文档"/>
        <br/><br/>
        <img src="https://img.shields.io/badge/下载-技术文档_PDF-2b6cb0?style=for-the-badge&logo=adobeacrobatreader&logoColor=white" height="50" alt="下载 PDF"/>
      </a>
      <br/><br/>
      <h3>👆 点击上方查看完整技术文档</h3>
    </td>
  </tr>
</table>
</div>

<br/><br/>

<div align="center">

<p align="center">
  新的 BioClaw 兼容 skills 可以直接在 BioClaw 中开发，也可以先提交到 <a href="https://github.com/zongtingwei/Bioclaw_Skills_Hub">Bioclaw_Skills_Hub</a> 作为前期迭代和测试的空间，再根据实际效果同步到主 BioClaw 仓库中。经过验证、效果稳定的 skills，后续可以逐步整合进 BioClaw。若想获取这些后续合入的 skills 和更新内容，请在本仓库中执行 <code>git pull</code>。
</p>
</div>

## 目录

- [概览](#概览)
- [这版新增了什么](#这版新增了什么)
- [快速开始](#快速开始)
- [新手详细指南](#新手详细指南)
- [消息通道](#消息通道)
- [示例演示](#示例演示)
- [系统架构](#系统架构)
- [Skills 与 Skills Hub](#skills-与-skills-hub)
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
- 基于图片的湿实验结果解读（支持 WhatsApp 拍照或上传图片，如 SDS-PAGE 条带质量与目标条带匹配判断）

默认通道为 WhatsApp；飞书、企业微信、Discord、Slack、微信（已全面支持）、本地网页等配置见 **[docs/CHANNELS.zh-CN.md](docs/CHANNELS.zh-CN.md)**。飞书的完整配置、OpenRouter 设置、群聊限制与排障见 **[docs/FEISHU_SETUP.zh-CN.md](docs/FEISHU_SETUP.zh-CN.md)**。QQ 相关截图仍为路线图示意，详见该文档。

关于本地新增的 SEC 报告工作流、自动任务路由、Typst 报告模板、输出物与测试说明，见 **[docs/SEC_REPORT_WORKFLOW.zh-CN.md](docs/SEC_REPORT_WORKFLOW.zh-CN.md)**。

## 这版新增了什么

最近这版更新，BioClaw 用起来更像一个真正可管理的研究工作台了：

- **Web 端支持多个独立对话**：现在本地网页可以像 ChatGPT 一样开多个 chat，每个 thread 都有自己独立的记忆，不会互相串话。
- **聊天里就能直接管理系统**：现在可以直接在聊天中用 `/status`、`/doctor`、`/threads`、`/new`、`/use`、`/rename`、`/archive`、`/workspace`、`/provider`、`/model` 这些命令，不用总靠改配置文件。
- **聊天里可以直接走宿主机 SSH**：现在可以直接在对话框里输入 `ssh <host-alias>` 或 `ssh <host-alias> -- <command>`，让 BioClaw 用宿主机上已经配置好的 SSH 别名去连接和执行命令。
- **每个 thread 都能记住自己的工作目录**：通过 `/dir`，不同 thread 可以固定在不同子目录里工作，做质控、画图、查文献时不容易互相打架。
- **常用流程可以存成短命令**：用 `/commands` 和 `/alias` 可以把常见分析流程存成自己的快捷命令，后面直接一句话调出来。
- **可以看到并选择偏好的 skills**：现在 `/skills` 能列出当前内置技能，还能给当前 thread 或 agent 标记偏好的 skill。
- **本地网页更好用了**：现在 web 里有 thread 列表、重命名/归档按钮，还有一个轻量管理面板，可以直接看状态和做基本排查。
- **OpenRouter 可以先做健康检查**：新增 `npm run check:openrouter`，会用当前 `.env` 发一个最小请求，先确认 key 能不能真正调模型。

## 快速开始

如果你对 Docker、`.env`、workspace、allowlist、挂载这些概念还不熟，建议先看这份分步骤文档：

- **[docs/BEGINNER_GUIDE.zh-CN.md](docs/BEGINNER_GUIDE.zh-CN.md)**  
  面向刚入门用户，包含 API/provider 切换、workspace 是什么、什么时候需要 allowlist、如何配置额外挂载、如何验证是否生效。

## 新手详细指南

零基础上手建议直接从这里开始：

- **[docs/BEGINNER_GUIDE.zh-CN.md](docs/BEGINNER_GUIDE.zh-CN.md)**

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

常用模型 ID：`deepseek/deepseek-chat-v3.1`、`deepseek/deepseek-v4-pro`、`google/gemini-2.5-flash`、`anthropic/claude-3.5-sonnet`。完整列表：[openrouter.ai/models](https://openrouter.ai/models)

**注意**：请选用支持 [tool calling](https://openrouter.ai/models?supported_parameters=tools) 的模型（如 DeepSeek、Gemini、Claude）。会话历史在单次容器运行期间保留；空闲超时后新容器会以全新上下文启动。

**通用 OpenAI-compatible 配置**

```bash
MODEL_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your_api_key
OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example/v1
OPENAI_COMPATIBLE_MODEL=your-model-name
```

**方案 C：复用本机 Codex CLI 登录态**

```bash
MODEL_PROVIDER=openai-codex
OPENAI_CODEX_MODEL=gpt-5.4
```

要求：

- 宿主机已经安装 `codex`
- 已执行过 `codex login`，并且 `~/.codex/auth.json` 有效

BioClaw 会复用宿主机的 Codex 登录态，并把 Codex 线程状态保存在当前工作区会话目录里，这样多轮 GPT 对话可以续接。

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

目前已支持 WhatsApp、飞书、企业微信、Discord、Slack、微信（已全面支持）、QQ、本地网页通道 等渠道。


### WhatsApp 接入示例

BioClaw 支持在 WhatsApp 群聊中进行对话式任务请求，并在群内返回分析结果。

<img src="ExampleTask/1.jpg" width="300" />

### 飞书接入示例

BioClaw 同样支持在飞书/Lark 中对话式发起任务，并在会话内接收分析结果与反馈。

<img src="docs/images/feishu/feishu-bioclaw.jpg" width="300" />

### 企业微信接入示例

BioClaw 也支持在企业微信中进行团队对话式任务请求，并在聊天内返回分析结果。

<img src="docs/images/wecom/wecom-bioclaw.jpg" width="300" />

### Discord 接入示例

BioClaw 支持 Discord 渠道对话流程。截图示例将在后续版本补充。

### Slack（Socket Mode）接入示例

BioClaw 支持 Slack（Socket Mode）渠道流程。截图示例将在后续版本补充。

### 微信接入示例

BioClaw 支持微信一键接入，并可在会话内进行文件传递与后续分析联动（发送文档/图片后继续在同一线程分析）。

<img src="docs/images/weixin/weixin-bioclaw.jpg" width="300" />

### QQ 接入示例

BioClaw 也支持在 QQ 中进行对话式任务请求，并在聊天内返回分析结果。

<img src="docs/images/qq/qq-deepseek-1.jpg" width="300" />

### 本地 Web UI（Dashboard）示例

本地网页通道同时包含聊天界面与内置的 dashboard（Lab trace）运行观测视图。

<img src="docs/images/dashboard/UI-bioclaw.jpg" width="1000" />

英文版通道文档：[docs/CHANNELS.md](docs/CHANNELS.md)。

**Lab trace 观测**（SSE 时间线、工作区树）已内置于本地网页界面，无需额外配置。说明见 [docs/DASHBOARD.md](docs/DASHBOARD.md)。

### 在聊天里直接 SSH

BioClaw 现在支持在聊天控制平面里直接调用宿主机 SSH。这个能力适合用来检查远端登录节点、查看远端结果文件，或在另一台服务器上跑简短的诊断命令，而不需要离开当前对话。

先在宿主机 `~/.ssh/config` 里配置好别名，例如：

```sshconfig
Host lambda-cloud-54-140
  HostName 192.222.54.140
  User ubuntu
  IdentityFile ~/.ssh/zaixi_lambda.pem
  IdentitiesOnly yes
```

然后就可以在聊天里直接使用：

```text
/ssh list
ssh lambda-cloud-54-140
ssh lambda-cloud-54-140 -- hostname
/ssh run lambda-cloud-54-140 -- ls -la ~
```

默认情况下，BioClaw 会读取 `~/.ssh/config` 里的简单别名。如果你想进一步限制可访问主机，可以在 `.env` 里设置 `BIOCLAW_SSH_ALLOWED_HOSTS`。

### Second Quick Start

如果希望更“无脑”地引导安装，给 OpenClaw 发送：

```text
install https://github.com/Runchuan-BU/BioClaw
```

## 示例演示

以下演示展示了 BioClaw 在主流渠道中的任务能力（WhatsApp、QQ、企业微信、微信、飞书以及本地 Web UI）。

QQ / 飞书路线图示意截图已移至 [docs/CHANNELS.zh-CN.md](docs/CHANNELS.zh-CN.md)。更多任务类演示见 [ExampleTask/ExampleTask.md](ExampleTask/ExampleTask.md)。

### 9. SDS-PAGE 凝胶图审阅（WhatsApp 拍照/上传）

在 WhatsApp 中直接拍照或上传凝胶图片，请 BioClaw 判断泳道质量、条带是否清晰，以及主条带是否与目标分子量大致匹配。

<img src="docs/images/whatsapp-凝胶.jpg" width="420" />

## 系统架构

BioClaw 基于 NanoClaw 的容器化架构，并融合 STELLA 的生物医学能力：

```
聊天平台 -> Node.js 编排器 -> SQLite 状态 -> Docker 容器 -> Agent + 生物工具
```

## Skills 与 Skills Hub

BioClaw 采用两层 skill 体系：

- **内置 skills** — 约 25 个核心技能，随容器镜像打包（BLAST 搜索、差异表达、单细胞预处理、数据库查询、PubMed 文献检索等），开箱即用。
- **[Skills Hub](https://github.com/zongtingwei/Bioclaw_Skills_Hub)** — 社区维护的技能仓库，涵盖 10 个领域 70+ 专业技能（蛋白质设计、空间转录组、EHR 分析、多组学整合等）。

Agent 会在运行时自动发现 Hub 中的技能。当用户的任务超出内置 skills 范围时，Agent 会从 GitHub 拉取对应的 skill 定义，缓存到本地后执行——无需手动安装。

如需贡献新技能，请参考 [Skills Hub 贡献指南](https://github.com/zongtingwei/Bioclaw_Skills_Hub/blob/main/CONTRIBUTING.md)。经验证稳定且常用的 skills 会逐步整合进 BioClaw 内置集。

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
| `npm run check:openrouter` | `scripts/check-openrouter.mjs` | 用当前 `.env` 对 OpenRouter 发一个最小测试请求 |
| `bash scripts/clear-local-web.sh` | `scripts/clear-local-web.sh` | 清空本地 Web 聊天记录和追踪事件 |
| `npx tsx scripts/test-cli.ts "prompt"` | `scripts/test-cli.ts` | 单次 CLI 测试：发送一个 prompt 到容器 |
| `npx tsx scripts/manage-groups.ts list` | `scripts/manage-groups.ts` | 管理 WhatsApp 群组注册（list / register / remove） |
| `python3 scripts/demo.py` | `scripts/demo.py` | TP53 基因分析演示（容器内运行） |

## Notebook 导出

每次 agent 成功运行后，会自动生成可复现的 Jupyter notebook（`.ipynb`），保存在：

```
groups/{workspace}/notebooks/{timestamp}.ipynb
```

例如 Slack DM 对话可能生成：
```
groups/slack-E1KYFDKN/notebooks/2026-04-01T07-31-54.ipynb
```

每个 notebook 包含：
- **Header cell** — 日期、workspace、用户原始 prompt
- **Code cells** — agent 执行的 Python 脚本和 bash 命令
- **Markdown cells** — agent 推理、文件写入、分析总结

可在 VS Code（安装 [Jupyter 扩展](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter)）、JupyterLab 或其他 `.ipynb` 查看器中打开。

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
│   ├── SEC_REPORT_WORKFLOW.zh-CN.md  # SEC 报告工作流说明
│   ├── WINDOWS.zh-CN.md   # Windows / 本地网页
│   └── images/            # 文档配图
├── ExampleTask/           # Demo 任务与截图
└── README.md / README.zh-CN.md
```

## 引用

如果你在研究中使用 BioClaw，请参考英文 README 中的 Citation 条目。

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
