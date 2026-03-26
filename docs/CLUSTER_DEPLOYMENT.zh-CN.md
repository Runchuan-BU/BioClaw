# BioClaw 集群部署指南

本文档面向两类场景：

- **真实 HPC 集群模式**：有 login node + Slurm/PBS + compute node
- **伪集群远端执行模式**：暂时只有一台普通云服务器，可先验证 BioClaw 通过 SSH 编排远端执行

---

## 1. 推荐拓扑

```
用户 (WhatsApp / Web)
        │
        ▼
┌─────────────────────┐
│   实验室服务器        │  ← BioClaw 部署在这里，仅此一处
│   (lab server)      │
│                     │
│  /mnt/lab-data  ────┼──── 共享存储（只读）
│  /mnt/lab-ref   ────┼──── 参考数据库（只读）
│  /mnt/lab-results ──┼──── 结果目录（读写）
│  /mnt/lab-scratch ──┼──── 临时工作区（读写）
└──────────┬──────────┘
           │ SSH（宿主机持有密钥，容器不可见）
           ▼
┌─────────────────────┐
│   Login Node        │  ← 作业提交入口
│   (login.hpc.edu)   │
└──────────┬──────────┘
           │ sbatch / qsub
           ▼
┌─────────────────────┐
│   Compute Nodes     │  ← 只跑调度后的任务，不部署 BioClaw
└─────────────────────┘
```

如果你当前**还没有真正的 Slurm/PBS login node**，但有一台可 SSH 的普通 Linux 云服务器，也可以先按下面的“伪集群远端执行模式”联调：

```
用户 (WhatsApp / Web)
        │
        ▼
┌─────────────────────┐
│   实验室服务器        │  ← BioClaw 部署在这里
│   (lab server)      │
│                     │
│  /mnt/lab-results ──┼──── 本地结果目录（读写）
│  /mnt/lab-scratch ──┼──── 本地脚本队列（读写）
└──────────┬──────────┘
           │ SSH（宿主机持有密钥，容器不可见）
           ▼
┌─────────────────────┐
│  普通云服务器         │  ← 无 Slurm，仅后台执行脚本
│  (remote-exec)      │
│  ~/bioclaw-remote/  │
└─────────────────────┘
```

**核心原则：**
- BioClaw 只部署在实验室服务器，不部署到 login / compute / storage 节点
- SSH 密钥只保留在宿主机，容器内不可见
- 数据通过共享存储挂载，不通过 scp 临时传输
- 作业提交通过宿主机 wrapper 脚本，容器只生成脚本内容

---

## 2. 宿主机准备

### 2.1 专用用户

```bash
sudo useradd -m -s /bin/bash bioclaw
sudo loginctl enable-linger bioclaw   # 允许无登录状态下运行服务
```

### 2.2 SSH 配置（宿主机 → login node）

```bash
# 统一以 bioclaw 用户操作，避免 known_hosts / config / key 落到错误用户
sudo -u bioclaw mkdir -p /home/bioclaw/.ssh
sudo -u bioclaw chmod 700 /home/bioclaw/.ssh
sudo -u bioclaw ssh-keygen -t ed25519 -f /home/bioclaw/.ssh/id_bioclaw -N ""
sudo -u bioclaw ssh-copy-id -i /home/bioclaw/.ssh/id_bioclaw.pub user@login.hpc.edu

# /home/bioclaw/.ssh/config
Host hpc-login
    HostName login.hpc.edu
    User your_hpc_username
    IdentityFile /home/bioclaw/.ssh/id_bioclaw
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

验证：

```bash
sudo -u bioclaw ssh hpc-login "hostname"
```

### 2.3 共享存储挂载

根据集群实际情况选择挂载方式：

**NFS：**
```bash
# /etc/fstab
storage.hpc.edu:/lab/data     /mnt/lab-data     nfs  ro,_netdev  0 0
storage.hpc.edu:/lab/ref      /mnt/lab-ref      nfs  ro,_netdev  0 0
storage.hpc.edu:/lab/results  /mnt/lab-results  nfs  rw,_netdev  0 0
storage.hpc.edu:/lab/scratch  /mnt/lab-scratch  nfs  rw,_netdev  0 0
```

**SSHFS（备选，共享存储不可直接挂载时）：**
```bash
sshfs user@login.hpc.edu:/lab/data /mnt/lab-data -o ro,reconnect,ServerAliveInterval=15
```

---

## 3. mount-allowlist.json 配置

文件位置：`/home/bioclaw/.config/bioclaw/mount-allowlist.json`（宿主机，容器不可见）

```bash
sudo -u bioclaw mkdir -p /home/bioclaw/.config/bioclaw
```

写入以下内容（根据实际挂载路径调整）：

```json
{
  "allowedRoots": [
    {
      "path": "/mnt/lab-data",
      "allowReadWrite": false,
      "description": "原始实验数据（只读）"
    },
    {
      "path": "/mnt/lab-ref",
      "allowReadWrite": false,
      "description": "参考数据库，如 NCBI、UniProt（只读）"
    },
    {
      "path": "/mnt/lab-results",
      "allowReadWrite": true,
      "description": "分析结果输出目录（读写，仅 main group）"
    },
    {
      "path": "/mnt/lab-scratch",
      "allowReadWrite": true,
      "description": "临时工作区（读写，仅 main group）"
    }
  ],
  "blockedPatterns": [
    "password",
    "secret",
    "token",
    "private"
  ],
  "nonMainReadOnly": true
}
```

`nonMainReadOnly: true` 确保非 main group（其他用户）即使请求读写也只能只读。

---

## 4. 群组挂载配置

`containerConfig` 持久化在 SQLite 数据库 `store/messages.db` 的 `registered_groups.container_config` 字段中。当前 `register_group` IPC 工具不接受该字段，需在宿主机直接用 SQL 写入。

**前提：群组必须已注册**（先通过 main group 发送 `register_group` 指令，再执行下面的 UPDATE）。

```bash
# 假设 BioClaw 部署在 /srv/bioclaw；如果你用别的路径，请替换下面的数据库路径
sudo -u bioclaw sqlite3 /srv/bioclaw/store/messages.db <<'EOF'
UPDATE registered_groups
SET container_config = json('{
  "additionalMounts": [
    {"hostPath": "/mnt/lab-data",    "containerPath": "lab-data", "readonly": true},
    {"hostPath": "/mnt/lab-ref",     "containerPath": "ref",      "readonly": true},
    {"hostPath": "/mnt/lab-results", "containerPath": "results",  "readonly": false},
    {"hostPath": "/mnt/lab-scratch", "containerPath": "scratch",  "readonly": false}
  ]
}')
WHERE folder = 'main';
SELECT folder, container_config FROM registered_groups WHERE folder = 'main';
EOF
```

> **注意：** `registered_groups` 会在 BioClaw 进程启动时加载到内存。修改 `container_config` 后，需要重启整个 BioClaw 服务，而不是只重启某个群组容器。
>
> ```bash
> sudo systemctl restart bioclaw
> ```

容器内可见路径：

| 宿主机路径 | 容器内路径 | 权限 |
|-----------|-----------|------|
| `/mnt/lab-data` | `/workspace/extra/lab-data` | 只读 |
| `/mnt/lab-ref` | `/workspace/extra/ref` | 只读 |
| `/mnt/lab-results` | `/workspace/extra/results` | 读写 |
| `/mnt/lab-scratch` | `/workspace/extra/scratch` | 读写 |

---

## 5. 宿主机 wrapper 脚本

这组脚本运行在宿主机上，由 `bioclaw` 用户通过 SSH 调用 HPC login node，SSH 密钥始终留在宿主机不进入容器。

**当前集成方式（过渡阶段）：** BioClaw 目前的 IPC 层不支持直接调用宿主机命令。落地路径有两种：

- **推荐（Scheduled Task）：** 在 agent 内用 `schedule_task` 触发一个 isolated 任务，该任务通过标准工具生成作业脚本后写入 `/workspace/extra/scratch/bioclaw/pending/*.sbatch`，再由宿主机上的 `cluster-dispatch-pending` 定期扫描该目录、调用 wrapper 提交。
- **备选（手动）：** 实验室管理员在宿主机侧以 bioclaw 用户手动调用这些脚本，适合低频作业场景。

> BioClaw 原生 IPC host-side command 执行能力正在规划中，届时将支持直接从 agent 调用这些脚本。

### 5.1 真实 HPC 集群模式（Slurm / PBS）

#### cluster-submit

```bash
#!/bin/bash
# 用法: cluster-submit <脚本路径>
# 提交作业到 HPC，返回纯数字 job ID
set -euo pipefail

SCRIPT="$1"
if [[ ! -f "$SCRIPT" ]]; then
  echo "ERROR: script not found: $SCRIPT" >&2
  exit 1
fi

submit_output="$(ssh hpc-login "sbatch --parsable" < "$SCRIPT")"
printf '%s\n' "${submit_output%%;*}"
```

#### cluster-dispatch-pending

```bash
#!/bin/bash
# 用法: cluster-dispatch-pending
# 扫描 scratch 队列目录，提交待处理的 .sbatch 脚本
set -euo pipefail

QUEUE_DIR="${BIOCLAW_CLUSTER_QUEUE_DIR:-/mnt/lab-scratch/bioclaw/pending}"
SUBMITTED_DIR="${BIOCLAW_CLUSTER_SUBMITTED_DIR:-/mnt/lab-scratch/bioclaw/submitted}"
FAILED_DIR="${BIOCLAW_CLUSTER_FAILED_DIR:-/mnt/lab-scratch/bioclaw/failed}"

mkdir -p "$QUEUE_DIR" "$SUBMITTED_DIR" "$FAILED_DIR"
shopt -s nullglob

for script in "$QUEUE_DIR"/*.sbatch; do
  base="$(basename "$script")"
  staging="${script}.submitting"
  stderr_file="${staging}.stderr"
  mv "$script" "$staging"

  if submit_output="$(cluster-submit "$staging" 2>"$stderr_file")"; then
    job_id="${submit_output%%;*}"
    if [[ ! "$job_id" =~ ^[0-9]+$ ]]; then
      echo "ERROR: unexpected sbatch output: $submit_output" >&2
      mv "$staging" "$FAILED_DIR/$base"
      mv "$stderr_file" "$FAILED_DIR/$base.stderr"
      continue
    fi

    mv "$staging" "$SUBMITTED_DIR/$base"
    printf '%s\n' "$job_id" > "$SUBMITTED_DIR/$base.jobid"
    rm -f "$stderr_file"
  else
    mv "$staging" "$FAILED_DIR/$base"
    if [[ -f "$stderr_file" ]]; then
      mv "$stderr_file" "$FAILED_DIR/$base.stderr"
    fi
  fi
done
```

#### cluster-status

```bash
#!/bin/bash
# 用法: cluster-status [job_id]
# 无参数时列出所有作业，有参数时查询指定作业
set -euo pipefail

if [[ $# -eq 0 ]]; then
  ssh hpc-login "squeue -u \$USER --format='%.10i %.20j %.8T %.10M %.6D %R'"
else
  JOB_ID="$1"
  if [[ ! "$JOB_ID" =~ ^[0-9_]+$ ]]; then
    echo "ERROR: invalid job ID: $JOB_ID" >&2
    exit 1
  fi
  ssh hpc-login "squeue -j '$JOB_ID' --format='%.10i %.20j %.8T %.10M %.6D %R' 2>/dev/null || sacct -j '$JOB_ID' --format=JobID,JobName,State,Elapsed,ExitCode -n"
fi
```

#### cluster-cancel

```bash
#!/bin/bash
# 用法: cluster-cancel <job_id>
set -euo pipefail

JOB_ID="$1"
if [[ ! "$JOB_ID" =~ ^[0-9_]+$ ]]; then
  echo "ERROR: invalid job ID: $JOB_ID" >&2
  exit 1
fi
ssh hpc-login "scancel '$JOB_ID'"
echo "Cancelled job $JOB_ID"
```

#### cluster-sync-results

```bash
#!/bin/bash
# 用法: cluster-sync-results <远程结果目录> <本地目标目录>
# 将计算结果从集群同步回共享存储（仅在共享存储不可直接挂载时使用）
set -euo pipefail

REMOTE_DIR="$1"
LOCAL_DIR="$2"

mkdir -p "$LOCAL_DIR"
rsync -avz --progress hpc-login:"$REMOTE_DIR/" "$LOCAL_DIR/"
```

安装：

```bash
sudo chmod +x /usr/local/bin/cluster-submit
sudo chmod +x /usr/local/bin/cluster-dispatch-pending
sudo chmod +x /usr/local/bin/cluster-status
sudo chmod +x /usr/local/bin/cluster-cancel
sudo chmod +x /usr/local/bin/cluster-sync-results
```

推荐再加一个 systemd timer，周期性提交 pending 目录中的脚本：

```ini
# /etc/systemd/system/cluster-dispatch-pending.service
[Unit]
Description=Dispatch pending BioClaw cluster jobs
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=bioclaw
ExecStart=/usr/local/bin/cluster-dispatch-pending
```

```ini
# /etc/systemd/system/cluster-dispatch-pending.timer
[Unit]
Description=Run BioClaw cluster dispatcher every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
Unit=cluster-dispatch-pending.service

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cluster-dispatch-pending.timer
systemctl list-timers --all | grep cluster-dispatch-pending
```

### 5.2 伪集群远端执行模式（普通云服务器）

当你**还没有可用的 Slurm/PBS login node** 时，可以先用一台普通 Linux 云服务器验证以下链路：

1. BioClaw 在本地挂载的 `scratch/pending/` 中生成脚本
2. 宿主机通过 SSH 将脚本复制到远端
3. 远端后台执行该脚本
4. 结果写到远端 `results/` 目录
5. 宿主机同步远端结果到本地 `results/`
6. BioClaw 再从挂载目录中读取结果

这套模式对应的示例脚本位于：

- `examples/cluster-scripts/remote-submit`
- `examples/cluster-scripts/remote-status`
- `examples/cluster-scripts/remote-cancel`
- `examples/cluster-scripts/remote-sync-results`
- `examples/cluster-scripts/remote-dispatch-pending`

#### SSH alias

在宿主机 `~/.ssh/config` 中配置一个远端别名，例如：

```sshconfig
Host remote-exec
    HostName 192.222.54.140
    User ubuntu
    IdentityFile /home/bioclaw/.ssh/id_remote_exec
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

验证：

```bash
sudo -u bioclaw ssh remote-exec "hostname; whoami"
```

#### 远端目录约定

默认脚本使用：

- `BIOCLAW_REMOTE_HOST=remote-exec`
- `BIOCLAW_REMOTE_BASE_DIR=$HOME/bioclaw-remote`

首次准备远端目录：

```bash
sudo -u bioclaw ssh remote-exec "mkdir -p ~/bioclaw-remote/{runs,results,logs}"
```

#### remote-submit

```bash
# 用法: remote-submit <script_path>
# 返回: run_id
remote-submit /mnt/lab-scratch/bioclaw/pending/remote-e2e.sh
```

行为：

- 将本地脚本复制到远端 `runs/<run_id>/script.sh`
- 在远端生成 `launcher.sh`
- 后台执行该脚本
- 记录：
  - `pid`
  - `started_at`
  - `finished_at`
  - `exit_code`
  - `stdout.log`
  - `stderr.log`

#### remote-status

```bash
remote-status <run_id>
```

示例输出：

```text
RUN_ID=20260326T102637Z-remote-e2e-ab12cd
STATE=SUCCEEDED
PID=2731566
STARTED_AT=2026-03-26T10:26:37+00:00
FINISHED_AT=2026-03-26T10:26:37+00:00
EXIT_CODE=0
RUN_DIR=/home/ubuntu/bioclaw-remote/runs/20260326T102637Z-remote-e2e-ab12cd
STDOUT_LOG=/home/ubuntu/bioclaw-remote/runs/20260326T102637Z-remote-e2e-ab12cd/stdout.log
STDERR_LOG=/home/ubuntu/bioclaw-remote/runs/20260326T102637Z-remote-e2e-ab12cd/stderr.log
```

#### remote-cancel

```bash
remote-cancel <run_id>
```

#### remote-sync-results

```bash
remote-sync-results /mnt/lab-results
```

这会把远端 `${BIOCLAW_REMOTE_BASE_DIR}/results/` 同步到本地 `/mnt/lab-results/`。

#### remote-dispatch-pending

```bash
BIOCLAW_REMOTE_QUEUE_DIR=/mnt/lab-scratch/bioclaw/pending \
BIOCLAW_REMOTE_SUBMITTED_DIR=/mnt/lab-scratch/bioclaw/submitted \
BIOCLAW_REMOTE_FAILED_DIR=/mnt/lab-scratch/bioclaw/failed \
remote-dispatch-pending
```

它会扫描本地 `pending/` 中的 `.sh` / `.bash` / `.sbatch`，调用 `remote-submit` 后：

- 成功：移动到 `submitted/`，并写入 `*.runid`
- 失败：移动到 `failed/`，并保留 `*.stderr`

#### 这套模式验证了什么

这不是 Slurm/PBS 调度验证，但可以先把以下关键链路跑通：

- BioClaw 生成脚本
- 宿主机 SSH 访问远端
- 远端后台执行
- 结果回传到本地挂载目录
- BioClaw 再读结果

等你拿到真正的 login node 后，再把 `remote-*` 切换为 `cluster-*` 即可，上层 BioClaw 工作流不需要推翻重来。

---

## 6. Slurm 作业脚本模板

agent 在容器内生成脚本内容，写入 `/workspace/extra/scratch/bioclaw/pending/`，再由宿主机 `cluster-dispatch-pending` 提交。

```bash
#!/bin/bash
#SBATCH --job-name=bioclaw-blast
#SBATCH --output=/lab/results/%j.out
#SBATCH --error=/lab/results/%j.err
#SBATCH --time=02:00:00
#SBATCH --mem=16G
#SBATCH --cpus-per-task=8
#SBATCH --partition=normal

module load blast+/2.14.0

blastp \
  -query /lab/data/query.faa \
  -db /lab/ref/nr \
  -out /lab/results/blast_out.txt \
  -outfmt 6 \
  -num_threads 8 \
  -evalue 1e-5
```

---

## 7. systemd 服务（推荐）

```ini
# /etc/systemd/system/bioclaw.service
[Unit]
Description=BioClaw Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=bioclaw
WorkingDirectory=/srv/bioclaw
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=CONTAINER_RUNTIME=docker

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable bioclaw
sudo systemctl start bioclaw
journalctl -u bioclaw -f
```

---

## 8. 安全要点

| 项目 | 做法 |
|------|------|
| SSH 密钥 | 只在宿主机 `~bioclaw/.ssh/`，不挂入容器 |
| 共享数据 | 原始数据和参考库默认只读 |
| 非 main group | `nonMainReadOnly: true` 强制只读 |
| allowlist | 存放在 `~/.config/bioclaw/`，容器不可见，agent 无法篡改 |
| 作业提交 | 通过宿主机 wrapper，容器只生成脚本文本 |
| 凭证 | 只有 `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` 进入容器，见 `docs/SECURITY.md` |

---

## 9. 故障排查

**挂载被拒绝**
```
Mount REJECTED: Path "/mnt/lab-data" is not under any allowed root
```
检查 `/home/bioclaw/.config/bioclaw/mount-allowlist.json` 是否存在且路径匹配。

**SSH 连接失败**
```bash
sudo -u bioclaw ssh -v hpc-login "hostname"
```
确认 `/home/bioclaw/.ssh/config` 中 `Host hpc-login` 配置正确，密钥已由 `bioclaw` 用户执行 `ssh-copy-id`。

**普通云服务器远端执行失败**
```bash
sudo -u bioclaw ssh -v remote-exec "hostname; whoami"
remote-status <run_id>
```
确认：

- `Host remote-exec` 配置正确
- 宿主机上的私钥可被远端接受
- 远端 `${BIOCLAW_REMOTE_BASE_DIR}` 目录可写
- `runs/<run_id>/stderr.log` 中没有脚本执行错误

**共享存储不可见**
```bash
ls /mnt/lab-data
```
检查 NFS/SSHFS 挂载状态：`mount | grep lab`

**容器运行时检查**
```bash
# Docker
docker info
# Apptainer
apptainer --version
```

**查看 BioClaw 日志**
```bash
journalctl -u bioclaw -n 100 --no-pager
```
