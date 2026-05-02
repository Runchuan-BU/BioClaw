# BioClaw V2 UI 升级指南

为 BioClaw 添加了一套全新的 Web UI（V2），同时保留原版界面不变。数据完全兼容，无需迁移。

---

## V2.1 小更新（2026-05-01）

在 V2 基础上的迭代改进，老用户 `git pull` + 重建容器即可。

### 🧬 3D 蛋白结构查看器（新增）

- 内置 3Dmol 渲染器（本地托管，国内网络也能用）
- 点击聊天里 agent 返回的 `.pdb` / `.cif` / `.mmcif` / `.mol2` / `.sdf` / `.xyz` 文件 → 右侧抽屉直接 3D 展示
- Workspace tab 顶部加了 PDB ID 输入框 + 6 个示例芯片（1CRN / 4HHB / 6VXX / 1A3N / 2HHB / 1IGT），输入即拉
- 渲染功能：6 种风格（卡通 / 棒状 / 球状 / 线条 / 球棍 / 表面）× 5 种配色（彩虹 / 按链 / B 因子 / 残基 / 单色），加自旋 / 深色背景 / 重置 / 截图 / 链残基原子统计
- 工具条文字跟随中英文切换实时刷新
- 检测到 agent 写的"假" PDB（缺二级结构 / ATOM 太少 / 全是注释）时，弹提示 + 一键从 RCSB 拉真版本

### 📂 Workspace 抽屉（新增）

- 抽屉顶部加 [推理过程] / [工作目录] tab 切换；工作目录占满整个抽屉，可直接点文件预览

### 🛠 抽屉布局优化

- 右侧边栏整体优化，预览体验更舒服

### 🤖 Agent 行为修复

- **System prompt 加 `[Data integrity]` 段落**：禁止凭记忆构造 PDB / 序列 / 数据集；下载失败必须明确告知用户而不是写假占位文件；PDB 下载完必须验证 ATOM > 100 + END
- **容器 SSL 证书路径修复**：之前 Python `urllib` / `requests` 因为 OpenSSL 默认找 `/usr/lib/ssl/cert.pem`（不存在）导致 HTTPS 下载全部失败，agent 没办法只能伪造文件。现在通过 `SSL_CERT_FILE` 等环境变量指向实际路径 `/etc/ssl/certs/ca-certificates.crt`，agent 终于能真正 wget RCSB

### 🐛 其他修复

- 文件 URL 大小写不敏感回退（agent 把 `1crn.pdb` 写到磁盘，链接里写 `1CRN.pdb` 也能打开）
- 页面加载时 trace 按**当前 chat** 过滤，不再串显其他会话的旧事件
- 欢迎页 "🧬 蛋白 3D 结构" 卡片改为纯 prompt 填充（不再 surprise 自动加载）
- 3Dmol.js 改为本地托管（`npm install 3dmol`，从 `/vendor/3Dmol-min.js` 服务），国内不依赖外网 CDN
- `container/build.sh` 现在串行执行基础镜像和 Viz overlay 两个 build，**老/新用户安装升级流程不变**，一条命令把 Python + SSL 修复都盖进去

---

## 改动总览

### 新增文件

| 文件/目录 | 说明 |
|-----------|------|
| `src/channels/local-web/assets/v2/index.html` | V2 页面结构 |
| `src/channels/local-web/assets/v2/style.css` | V2 样式（多主题、响应式） |
| `src/channels/local-web/assets/v2/app.js` | V2 前端逻辑 |

### 修改文件

| 文件 | 改动 | 说明 |
|------|------|------|
| `src/channels/local-web/channel.ts` | +5 行 | `/` 默认指向 V2，原版迁到 `/v1`，`/v2` 保留为别名 |
| `container/agent-runner/src/index.ts` | ~160 行 | OpenAI 兼容接口支持 SSE 流式输出；thinking/tool_use 步骤推到 trace |
| `src/index.ts` | +8 行 | 跳过 streaming chunks 不推送到聊天 |
| `src/container-runner.ts` | +1 行 | `ContainerOutput.status` 新增 `'streaming'` 类型 |

### 不受影响的内容

- 原版 UI 仍可用，仅路由从 `/` 换成 `/v1`（页面与数据完全不变）
- 所有聊天记录、会话、群组配置不受影响
- WhatsApp / 微信 / 飞书等其他 channel 不受影响
- `.env` 文件不会被覆盖

---

## 新增功能

- 9 套主题切换 + 暗色模式
- 左侧 Thread 列表，可同时管理多个对话
- 右侧 Lab Trace 抽屉，实时查看 agent 推理过程、工具调用
- **流式输出**：回答一字一字显示；思考过程在 Lab Trace 里，最终结果在聊天框
- 中英文切换、可拖拽调节面板大小、移动端适配

---

## 全新用户安装

```bash
git clone git@github.com:Runchuan-BU/BioClaw.git
cd BioClaw
npm install
cp .env.example .env       # 编辑填入 API key
./container/build.sh
npm run web
```

启动后：
- V2 UI（默认）：`http://localhost:3000/`（也可走 `/v2`）
- 原版 UI：`http://localhost:3000/v1`

---

## 已有用户升级

适用于已经 clone 过原仓库 (`Runchuan-BU/BioClaw`) 的用户。**原目录直接升级**，不需要重新 clone，不需要重填 API key，数据自动保留。

### 第 1 步（建议）：备份当前容器镜像

为之后想回退做双保险，可以瞬间切回：

```bash
docker tag bioclaw-agent:latest bioclaw-agent:backup
```

### 第 2 步：拉取 V2 改动

```bash
cd /原来的BioClaw目录
git pull origin main
```

### 第 3 步：重建容器并重启

```bash
./container/build.sh                # 1-2 分钟（缓存复用，只重跑 COPY 步骤）
npm run stop:web && npm run web
```

完成。`http://localhost:3000/` 默认就是新版 V2 UI，原版迁到 `http://localhost:3000/v1`（数据不变）。

---

## 不喜欢想回退到原版

V2 改动是可逆的，**数据不会丢**。

### 方式 A：有备份镜像（瞬间完成）

如果升级前做了 Step 1 的备份：

```bash
git reset --hard origin/main                          # 代码回退
docker tag bioclaw-agent:backup bioclaw-agent:latest  # 镜像换回备份
npm run stop:web && npm run web                       # 重启
```

### 方式 B：没备份镜像（需要重 build）

```bash
git reset --hard origin/main
./container/build.sh           # 1-2 分钟
npm run stop:web && npm run web
```
