# BioClaw

### 面向生物信息学研究的 AI 助手（WhatsApp / QQ + DeepSeek）

[English](README.md) | [简体中文](README.zh-CN.md)

BioClaw 将常见生物信息学任务带到聊天界面中。你可以通过自然语言触发 BLAST、结构可视化、绘图、QC、文献检索等流程。

默认通道是 WhatsApp；也可以按项目方式扩展到 QQ + DeepSeek 工作流（见下方示例）。

## 快速开始

### 环境要求

- macOS 或 Linux
- Node.js 20+
- Docker Desktop
- Anthropic API Key

### 安装

```bash
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
npm install
cp .env.example .env
npm start
```

### 使用

在已接入的群里发送：

```text
@Bioclaw <你的请求>
```

## Second Quick Start

如果希望更“无脑”地引导安装，给 OpenClaw 发送：

```text
install https://github.com/Runchuan-BU/BioClaw
```

## QQ + DeepSeek 示例

以下为 QQ + DeepSeek 工作流示例截图：

<div align="center">
<img src="docs/images/qq/qq-deepseek-1.jpg" width="420">
</div>

<div align="center">
<img src="docs/images/qq/qq-deepseek-2.jpg" width="420">
</div>

## 网页控制台（Dashboard）

BioClaw 内置网页控制台，启动后访问 `http://localhost:3847`（端口可通过 `DASHBOARD_PORT` 环境变量修改）。

### 功能页签

| 页签 | 说明 |
|------|------|
| **概览（Overview）** | 实时统计：消息数、任务运行次数、已连接群组数、已注册模型与技能数 |
| **群组（Groups）** | 所有 WhatsApp/Telegram 群组，显示消息量和最后活跃时间 |
| **任务（Tasks）** | 定时任务列表——查看、暂停、恢复、取消任务 |
| **统计（Stats）** | 活动图表：每日消息量、每日任务运行量、成功率、平均/最大耗时；支持 7 天/14 天/30 天周期选择 |
| **告警（Alerts）** | 基于群组静默阈值的告警规则，显示当前触发状态 |
| **设置（Settings）** | 环境变量配置查看 |
| **模型（Models）** | 已配置的 AI 模型（Claude、MiniMax、Qwen）及认证状态 |
| **技能（Skills）** | 已安装的 Agent 技能列表 |

### 界面控制

- **自动刷新** — 选择刷新间隔（关闭 / 10 秒 / 30 秒 / 1 分钟 / 5 分钟）
- **深色/浅色主题** — 点击标题栏图标切换，状态保存至 `localStorage`
- **语言切换** — 中文 / English 切换，状态保存至 `localStorage`

## Demo Examples

完整示例任务与截图见：

- [ExampleTask/ExampleTask.md](ExampleTask/ExampleTask.md)

