// Fetch runtime config from server, then boot the app.
(async function boot() {
  var cfg = {};
  try {
    var r = await fetch('/api/config');
    cfg = await r.json();
  } catch (e) { console.warn('Failed to load /api/config, using defaults', e); }

  var chatJid = cfg.chatJid || 'local-web@local.web';
  var assistantName = cfg.assistantName || 'Bioclaw';
  var AUTH_TOKEN = cfg.authToken || '';
  var STREAM_QS = cfg.streamQs || '';
  var THREAD_KEY = 'bioclaw-web-thread-jid';
  var THEME_KEY = 'bioclaw-theme';
  var PALETTE_KEY = 'bioclaw-palette';
  var SIDEBAR_KEY = 'bioclaw-sidebar-collapsed';
  var COMPOSER_HEIGHT_KEY = 'bioclaw-composer-height';
  var MAIN_SPLIT_KEY = 'bioclaw-main-left-size-v2';
  var THREAD_SPLIT_KEY = 'bioclaw-thread-rail-width-v2';
  var TRACE_SPLIT_KEY = 'bioclaw-trace-sidebar-width-v2';
  // One-time cleanup of pre-redesign stored sizes (could squeeze the new layout)
  try {
    ['bioclaw-main-left-size', 'bioclaw-thread-rail-width', 'bioclaw-trace-sidebar-width', 'bioclaw-composer-height']
      .forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}
  var threads = [];

  // Set session JID in settings drawer
  var jidEl = document.getElementById('sessionJid');
  if (jidEl) jidEl.textContent = chatJid;

const LANG_KEY = 'bioclaw-web-lang';
const THEMES = ['default', 'ocean', 'sakura', 'cream', 'mono-light', 'midnight', 'slate', 'forest', 'wine'];

    const unifiedRoot = document.getElementById('unifiedRoot');
    const unifiedLayout = document.getElementById('unifiedLayout');
    const tabTraceBtn = document.getElementById('tabTraceBtn');   // may be null (removed)
    const tabChatBtn = document.getElementById('tabChatBtn');     // may be null (removed)
    const panelTrace = document.getElementById('panelTrace');     // now a drawer
    const panelChat = document.getElementById('panelChat');
    const openTraceBtn = document.getElementById('openTraceBtn');
    const closeTraceBtn = document.getElementById('closeTrace');
    const mainPanelResizer = document.getElementById('mainPanelResizer');
    const chatShell = document.querySelector('.chat-shell');
    const threadRail = document.querySelector('.thread-rail');
    const threadRailResizer = document.getElementById('threadRailResizer');
    const threadListEl = document.getElementById('threadList');
    const newThreadBtn = document.getElementById('newThreadBtn');
    const messagesEl = document.getElementById('messages');
    const form = document.getElementById('composer');
    const input = document.getElementById('text');
    const composerResizer = document.getElementById('composerResizer');
    const fileInput = document.getElementById('file');
    const fileNameEl = document.getElementById('filename');
    const sendBtn = document.getElementById('send');
    const statusEl = document.getElementById('status');
    const connDot = document.getElementById('connDot');
    const connLabel = document.getElementById('connLabel');
    const connPill = document.getElementById('connPill');
    const traceConnDot = document.getElementById('traceConnDot');
    const traceConnLabel = document.getElementById('traceConnLabel');
    const traceConnPill = document.getElementById('traceConnPill');
    const themeGrid = document.getElementById('themeGrid');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const chatShellEl = document.getElementById('chatShell');
    const workStrip = document.getElementById('workStrip');
    const workStripLabel = document.getElementById('workStripLabel');
    const workStripDetail = document.getElementById('workStripDetail');
    const workStripTime = document.getElementById('workStripTime');
    const chatHero = document.getElementById('chatHero');
    const langBtn = document.getElementById('langBtn');
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const openSettingsBtn = document.getElementById('openSettings');
    const closeSettingsBtn = document.getElementById('closeSettings');
    const settingsConnValue = document.getElementById('settingsConnValue');
    const settingsTraceConnValue = document.getElementById('settingsTraceConnValue');
    const manageRefreshBtn = document.getElementById('manageRefreshBtn');
    const manageCommandInput = document.getElementById('manageCommandInput');
    const manageCommandBtn = document.getElementById('manageCommandBtn');
    const manageCommandOutput = document.getElementById('manageCommandOutput');
    const manageStatusPanel = document.getElementById('manageStatusPanel');
    const manageDoctorPanel = document.getElementById('manageDoctorPanel');

    const traceMain = document.querySelector('.trace-main');
    const timeline = document.getElementById('timeline');
    const traceSidebar = document.querySelector('.trace-sidebar');
    const traceSidebarResizer = document.getElementById('traceSidebarResizer');
    const groupSel = document.getElementById('group');
    const treeEl = document.getElementById('tree');
    const traceStreamCb = document.getElementById('traceShowStream');

    // Default: hide raw stream chunks (they're noisy; the consolidated message is enough).
    // Force-clear any previously-saved 'true' state so users with old localStorage start clean.
    var traceShowStream = false;
    try { localStorage.setItem('bioclaw-trace-stream', '0'); } catch (e) {}

    let lastSignature = '';
    let pollTimer = null;
    let chatEs = null;
    let lastConnMode = null;
    let traceEs = null;
    let traceBooted = false;
    var lang = 'zh';
    var currentTab = 'chat';

    var I18N = {
      zh: {
        pageTitle: 'BioClaw',
        tabChat: '对话',
        tabTrace: '实验追踪',
        connPillTitle: '新消息',
        connConnecting: '连接中…',
        tracePillTitle: '实验追踪',
        traceIdle: '未连接',
        settingsTitle: '设置',
        settingsAria: '打开设置',
        closeSettingsAria: '关闭',
        threadsTitle: '对话',
        threadsHint: '每个对话独立保存记忆与历史。',
        newThread: '新对话',
        newThreadPrompt: '输入新对话标题（可留空）',
        threadUntitled: '新对话',
        threadEmpty: '还没有其他对话。点击右上角创建一个新的独立线程。',
        secDisplay: '显示',
        secConnection: '连接',
        secControl: '控制台',
        lblLang: '界面语言',
        lblTheme: '外观',
        lblConn: '对话列表',
        lblTraceConn: '追踪列表',
        lblSession: '会话 ID',
        lblControlCommand: '控制命令',
        lblStatusPanel: '状态',
        lblDoctorPanel: '诊断',
        langToggle: 'English',
        themeLight: '浅色主题',
        themeDark: '深色主题',
        themeSwitchToLight: '切换到浅色主题',
        themeSwitchToDark: '切换到深色主题',
        resizeInputAria: '调整输入框高度',
        resizeInputTitle: '拖动这里调整输入框高度，双击恢复默认高度',
        resizePanelsAria: '调整左右主栏宽度',
        resizePanelsTitle: '拖动这里调整实验追踪和对话区域的宽度',
        resizeThreadsAria: '调整对话列表宽度',
        resizeThreadsTitle: '拖动这里调整左侧对话列表宽度',
        resizeTraceAria: '调整追踪侧栏宽度',
        resizeTraceTitle: '拖动这里调整实验追踪右侧栏宽度',
        manageRefresh: '刷新',
        manageRunCommand: '执行',
        manageCommandPlaceholder: '例如：/status 或 /workspace list',
        manageEmpty: '暂无数据。',
        manageLoading: '加载中…',
        manageCommandError: '命令执行失败',
        manageFetchError: '加载失败',
        threadCreateFail: '创建对话失败',
        threadRenamePrompt: '输入新的对话标题',
        threadRenameFail: '重命名对话失败',
        threadArchiveConfirm: '确认归档这个对话？',
        threadArchiveFail: '归档对话失败',
        threadRenameAction: '重命名',
        threadArchiveAction: '归档',
        chatTitle: '对话',
        chatHintTpl: 'Enter 发送 · Shift+Enter 换行 · 默认无需 @{name}',
        traceSub: 'Agent 每次运行按思考链分组展示。默认隐藏流式输出片段；勾选下方可显示全部（适合调试）。',
        groupLabel: '群组',
        allGroups: '全部',
        reloadTrace: '刷新',
        traceStreamLabel: '显示流式片段（调试）',
        evtRunStart: '开始处理',
        evtRunEnd: '运行结束',
        evtRunError: '运行异常',
        evtStream: '模型输出片段',
        evtContainer: '容器启动',
        evtIpc: '跨群发送',
        evtThinking: '思考',
        evtToolUse: '工具调用',
        evtUnknown: '事件',
        traceMsgCount: '待处理消息',
        tracePromptLen: '提示长度',
        traceOutChars: '本段输出字符',
        traceSession: '会话 ID',
        traceContainer: '容器名',
        traceIpcKind: '类型',
        traceRawJson: '原始 JSON',
        placeholder: '例如：用 BioPython 读取 FASTA 并统计 GC 含量…',
        uploadHint: '上传文件会写入群组工作区，Agent 可通过路径访问。',
        uploadLabel: '上传文件',
        noFile: '未选择',
        send: '发送',
        sseLive: '实时更新',
        poll2s: '约 2 秒刷新',
        offline: '离线',
        sseWait: '连接中…',
        sseOk: '已连接',
        sseBad: '已断开',
        roleAssistant: '助手',
        roleYou: '你',
        userFallback: '用户',
        uploadedPrefix: '已上传 · ',
        openFile: '打开',
        download: '下载',
        copy: '复制',
        copied: '已复制',
        copyFail: '复制失败',
        downloadFile: '下载文件',
        uploading: '正在上传…',
        uploadFail: '上传失败',
        sendFail: '发送失败',
        sidebarTitle: '工作区树',
        sidebarHint: '选择上方群组后加载 groups/&lt;folder&gt;',
        treePick: '请选择群组',
        treeEmpty: '（空）',
        loadFail: '加载失败',
        lblPalette: '配色',
        themeLightShort: '浅色',
        themeDarkShort: '深色',
        sidebarToggleAria: '折叠 / 展开侧栏',
        welcomeTitle: '欢迎使用 BioClaw',
        welcomeSub: 'AI 生物研究助手 · 直接用自然语言描述你想做的分析',
        suggestFastaTitle: 'FASTA · GC 含量',
        suggestFastaDesc: '读取 FASTA 文件并计算 GC 含量',
        suggestBlastTitle: '序列搜索',
        suggestBlastDesc: 'BLAST 一段未知序列定位物种',
        suggestDataTitle: '数据可视化',
        suggestDataDesc: '读 CSV 生成 volcano plot',
        suggestPubmedTitle: '文献速查',
        suggestPubmedDesc: '近期 CRISPR off-target 相关论文',
        suggest3dTitle: '🧬 蛋白 3D 结构',
        suggest3dDesc: '点击填入提示词；发出后 agent 会下载 PDB 文件，点击文件即可 3D 预览',
        drawerTabTrace: '推理过程',
        drawerTabWorkspace: '工作目录',
        ws3dTitle: '蛋白 3D 结构',
        ws3dHint: '输入 PDB ID 或点击示例',
        ws3dLoad: '载入',
        workThinking: '正在思考',
        workRunning: '正在执行',
        workDone: '已完成',
        workError: '运行异常',
        viewTrace: '查看思考过程',
        thoughtsDone: '查看思考过程',
        traceDrawerTitle: '实验追踪',
        traceDrawerAria: '实验追踪面板',
      },
      en: {
        pageTitle: 'BioClaw',
        tabChat: 'Chat',
        tabTrace: 'Lab trace',
        connPillTitle: 'Messages',
        connConnecting: 'Connecting…',
        tracePillTitle: 'Trace',
        traceIdle: 'Idle',
        settingsTitle: 'Settings',
        settingsAria: 'Open settings',
        closeSettingsAria: 'Close',
        threadsTitle: 'Threads',
        threadsHint: 'Each thread keeps its own memory and history.',
        newThread: 'New chat',
        newThreadPrompt: 'Enter a title for the new chat (optional)',
        threadUntitled: 'New chat',
        threadEmpty: 'No extra chats yet. Create a new independent thread from the button above.',
        secDisplay: 'Display',
        secConnection: 'Connection',
        secControl: 'Control',
        lblLang: 'Language',
        lblTheme: 'Appearance',
        lblConn: 'Chat list',
        lblTraceConn: 'Trace feed',
        lblSession: 'Session ID',
        lblControlCommand: 'Control command',
        lblStatusPanel: 'Status',
        lblDoctorPanel: 'Doctor',
        langToggle: '中文',
        themeLight: 'Light theme',
        themeDark: 'Dark theme',
        themeSwitchToLight: 'Switch to light theme',
        themeSwitchToDark: 'Switch to dark theme',
        resizeInputAria: 'Resize composer',
        resizeInputTitle: 'Drag to resize the composer. Double-click to reset.',
        resizePanelsAria: 'Resize main panels',
        resizePanelsTitle: 'Drag to resize the trace and chat columns.',
        resizeThreadsAria: 'Resize thread list',
        resizeThreadsTitle: 'Drag to resize the thread list column.',
        resizeTraceAria: 'Resize trace sidebar',
        resizeTraceTitle: 'Drag to resize the trace sidebar.',
        manageRefresh: 'Refresh',
        manageRunCommand: 'Run',
        manageCommandPlaceholder: 'For example: /status or /workspace list',
        manageEmpty: 'No data yet.',
        manageLoading: 'Loading…',
        manageCommandError: 'Command failed',
        manageFetchError: 'Load failed',
        threadCreateFail: 'Failed to create thread',
        threadRenamePrompt: 'Enter a new title',
        threadRenameFail: 'Failed to rename thread',
        threadArchiveConfirm: 'Archive this thread?',
        threadArchiveFail: 'Failed to archive thread',
        threadRenameAction: 'Rename',
        threadArchiveAction: 'Archive',
        chatTitle: 'Chat',
        chatHintTpl: 'Enter to send · Shift+Enter for newline · @{name} optional by default',
        traceSub: 'Each agent run is grouped as a thinking chain. Stream output chunks are hidden by default; enable below for debugging.',
        groupLabel: 'Group',
        allGroups: 'All',
        reloadTrace: 'Refresh',
        traceStreamLabel: 'Show stream chunks (debug)',
        evtRunStart: 'Run started',
        evtRunEnd: 'Run finished',
        evtRunError: 'Run failed',
        evtStream: 'Model output chunk',
        evtContainer: 'Container started',
        evtIpc: 'IPC send',
        evtThinking: 'Thinking',
        evtToolUse: 'Tool call',
        evtUnknown: 'Event',
        traceMsgCount: 'Messages batched',
        tracePromptLen: 'Prompt length',
        traceOutChars: 'Chunk chars',
        traceSession: 'Session',
        traceContainer: 'Container',
        traceIpcKind: 'Kind',
        traceRawJson: 'Raw JSON',
        placeholder: 'e.g. Read a FASTA with BioPython and report GC content…',
        uploadHint: 'Uploads go to the group workspace; the agent can read them by path.',
        uploadLabel: 'Upload file',
        noFile: 'No file chosen',
        send: 'Send',
        sseLive: 'Live',
        poll2s: '~2s refresh',
        offline: 'Offline',
        sseWait: 'Connecting…',
        sseOk: 'Connected',
        sseBad: 'Disconnected',
        roleAssistant: 'Assistant',
        roleYou: 'You',
        userFallback: 'User',
        uploadedPrefix: 'Uploaded · ',
        openFile: 'Open',
        download: 'Download',
        copy: 'Copy',
        copied: 'Copied',
        copyFail: 'Copy failed',
        downloadFile: 'Download file',
        uploading: 'Uploading…',
        uploadFail: 'Upload failed',
        sendFail: 'Send failed',
        sidebarTitle: 'Workspace tree',
        sidebarHint: 'Pick a group above to load groups/&lt;folder&gt;',
        treePick: 'Select a group',
        treeEmpty: '(empty)',
        loadFail: 'Load failed',
        lblPalette: 'Palette',
        themeLightShort: 'Light',
        themeDarkShort: 'Dark',
        sidebarToggleAria: 'Toggle sidebar',
        welcomeTitle: 'Welcome to BioClaw',
        welcomeSub: 'AI bioinformatics assistant — describe what you want to analyze in plain language',
        suggestFastaTitle: 'FASTA · GC content',
        suggestFastaDesc: 'Read a FASTA file and compute GC content',
        suggestBlastTitle: 'Sequence search',
        suggestBlastDesc: 'BLAST an unknown sequence to identify species',
        suggestDataTitle: 'Data visualization',
        suggestDataDesc: 'Read a CSV and generate a volcano plot',
        suggestPubmedTitle: 'PubMed quickscan',
        suggestPubmedDesc: 'Recent CRISPR off-target papers',
        suggest3dTitle: '🧬 Protein 3D structure',
        suggest3dDesc: 'Click to fill a prompt; after sending, the agent downloads the PDB and clicking it shows the 3D view',
        drawerTabTrace: 'Trace',
        drawerTabWorkspace: 'Workspace',
        ws3dTitle: 'Protein 3D viewer',
        ws3dHint: 'Enter a PDB ID or pick an example',
        ws3dLoad: 'Load',
        workThinking: 'Thinking',
        workRunning: 'Running',
        workDone: 'Done',
        workError: 'Run error',
        viewTrace: 'View thoughts',
        thoughtsDone: 'View thoughts',
        traceDrawerTitle: 'Lab trace',
        traceDrawerAria: 'Lab trace panel',
      },
    };

    function T() { return I18N[lang]; }

    function applyLang(next) {
      lang = next === 'en' ? 'en' : 'zh';
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      var t = T();
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
      document.title = t.pageTitle;
      if (tabTraceBtn) tabTraceBtn.textContent = t.tabTrace;
      if (tabChatBtn) tabChatBtn.textContent = t.tabChat;
      connPill.title = t.connPillTitle;
      traceConnPill.title = t.tracePillTitle;
      document.getElementById('settingsHeading').textContent = t.settingsTitle;
      openSettingsBtn.setAttribute('aria-label', t.settingsAria);
      closeSettingsBtn.setAttribute('aria-label', t.closeSettingsAria);
      document.getElementById('threadsTitle').textContent = t.threadsTitle;
      document.getElementById('threadsHint').textContent = t.threadsHint;
      newThreadBtn.textContent = t.newThread;
      document.getElementById('secDisplay').textContent = t.secDisplay;
      document.getElementById('secConnection').textContent = t.secConnection;
      document.getElementById('secControl').textContent = t.secControl;
      document.getElementById('lblLang').textContent = t.lblLang;
      document.getElementById('lblTheme').textContent = t.lblTheme;
      document.getElementById('lblConn').textContent = t.lblConn;
      document.getElementById('lblTraceConn').textContent = t.lblTraceConn;
      document.getElementById('lblSession').textContent = t.lblSession;
      document.getElementById('lblControlCommand').textContent = t.lblControlCommand;
      document.getElementById('lblStatusPanel').textContent = t.lblStatusPanel;
      document.getElementById('lblDoctorPanel').textContent = t.lblDoctorPanel;
      langBtn.textContent = t.langToggle;
      var openTraceBtnLabelEl = document.getElementById('openTraceBtnLabel');
      if (openTraceBtnLabelEl) openTraceBtnLabelEl.textContent = (t.tabTrace || 'Lab trace');
      var drawerTabTraceLabelEl = document.getElementById('drawerTabTraceLabel');
      if (drawerTabTraceLabelEl) drawerTabTraceLabelEl.textContent = (t.drawerTabTrace || 'Trace');
      var drawerTabWorkspaceLabelEl = document.getElementById('drawerTabWorkspaceLabel');
      if (drawerTabWorkspaceLabelEl) drawerTabWorkspaceLabelEl.textContent = (t.drawerTabWorkspace || 'Workspace');
      var ws3dTitleEl = document.getElementById('ws3dLoaderTitle');
      if (ws3dTitleEl) ws3dTitleEl.textContent = (t.ws3dTitle || 'Protein 3D viewer');
      var ws3dHintEl = document.getElementById('ws3dLoaderHint');
      if (ws3dHintEl) ws3dHintEl.textContent = (t.ws3dHint || 'Enter a PDB ID or pick an example');
      var ws3dLoadBtnEl = document.getElementById('ws3dLoadBtn');
      if (ws3dLoadBtnEl) ws3dLoadBtnEl.textContent = (t.ws3dLoad || 'Load');
      // Refresh active 3D viewer's button labels too
      if (window.__bioclawRefreshProteinViewerLang) window.__bioclawRefreshProteinViewerLang();
      var traceDrawerTitleEl = document.getElementById('traceDrawerTitle');
      if (traceDrawerTitleEl) traceDrawerTitleEl.textContent = (t.tabTrace || 'Lab trace');
      var lblPaletteEl = document.getElementById('lblPalette');
      if (lblPaletteEl) lblPaletteEl.textContent = t.lblPalette;
      if (sidebarToggle) sidebarToggle.setAttribute('aria-label', t.sidebarToggleAria);
      var traceDrawerTitleEl = document.getElementById('traceDrawerTitle');
      if (traceDrawerTitleEl) traceDrawerTitleEl.textContent = t.traceDrawerTitle;
      manageRefreshBtn.textContent = t.manageRefresh;
      manageCommandBtn.textContent = t.manageRunCommand;
      manageCommandInput.placeholder = t.manageCommandPlaceholder;
      document.getElementById('chatTitle').textContent = t.chatTitle;
      document.getElementById('chatHint').textContent = t.chatHintTpl.replace('{name}', assistantName);
      document.getElementById('traceSub').textContent = t.traceSub;
      document.getElementById('i18n-group-label').textContent = t.groupLabel;
      document.getElementById('opt-all').textContent = t.allGroups;
      document.getElementById('reloadTrace').textContent = t.reloadTrace;
      document.getElementById('traceStreamLabel').textContent = t.traceStreamLabel;
      input.placeholder = t.placeholder;
      document.getElementById('uploadHint').textContent = t.uploadHint;
      document.getElementById('uploadLabel').textContent = t.uploadLabel;
      sendBtn.textContent = t.send;
      document.getElementById('i18n-sidebar-title').textContent = t.sidebarTitle;
      document.getElementById('i18n-sidebar-hint').innerHTML = t.sidebarHint;
      if (composerResizer) {
        composerResizer.setAttribute('aria-label', t.resizeInputAria);
        composerResizer.title = t.resizeInputTitle;
      }
      if (mainPanelResizer) {
        mainPanelResizer.setAttribute('aria-label', t.resizePanelsAria);
        mainPanelResizer.title = t.resizePanelsTitle;
      }
      if (threadRailResizer) {
        threadRailResizer.setAttribute('aria-label', t.resizeThreadsAria);
        threadRailResizer.title = t.resizeThreadsTitle;
      }
      if (traceSidebarResizer) {
        traceSidebarResizer.setAttribute('aria-label', t.resizeTraceAria);
        traceSidebarResizer.title = t.resizeTraceTitle;
      }
      var hasFile = fileInput.files && fileInput.files[0];
      fileNameEl.textContent = hasFile ? fileInput.files[0].name : t.noFile;
      if (!groupSel.value) treeEl.textContent = t.treePick;
      if (manageStatusPanel && !manageStatusPanel.textContent) manageStatusPanel.textContent = t.manageEmpty;
      if (manageDoctorPanel && !manageDoctorPanel.textContent) manageDoctorPanel.textContent = t.manageEmpty;
      syncThemeUi();
      renderThreads();
      if (lastConnMode === null) {
        connDot.classList.remove('live', 'poll');
        connLabel.textContent = t.connConnecting;
        settingsConnValue.textContent = t.connConnecting;
      } else setChatConn(lastConnMode);
      syncTracePillText();
    }

    function syncTracePillText() {
      if (traceEs) return;
      var t = T();
      traceConnLabel.textContent = t.traceIdle;
      settingsTraceConnValue.textContent = t.traceIdle;
    }

    (function initLang() {
      var saved = null;
      try {
        saved = localStorage.getItem(LANG_KEY) || localStorage.getItem('bioclaw-local-web-lang') || localStorage.getItem('bioclaw-dashboard-lang');
      } catch (e) {}
      applyLang(saved === 'en' ? 'en' : 'zh');
    })();

    function setChatConn(mode) {
      lastConnMode = mode;
      var t = T();
      connDot.classList.remove('live', 'poll');
      var label = t.offline;
      if (mode === 'sse') { connDot.classList.add('live'); label = t.sseLive; }
      else if (mode === 'poll') { connDot.classList.add('poll'); label = t.poll2s; }
      connLabel.textContent = label;
      settingsConnValue.textContent = label;
    }

    function stopTraceSse() {
      if (traceEs) { traceEs.close(); traceEs = null; }
      traceConnDot.classList.remove('live');
      traceConnPill.classList.remove('ok', 'bad');
      var t = T();
      traceConnLabel.textContent = t.traceIdle;
      settingsTraceConnValue.textContent = traceConnLabel.textContent;
    }

    function startTraceSse() {
      if (traceEs) return;
      var t = T();
      traceConnLabel.textContent = t.sseWait;
      settingsTraceConnValue.textContent = t.sseWait;
      traceConnPill.classList.remove('ok', 'bad');
      var url = '/api/trace/stream' + STREAM_QS;
      traceEs = new EventSource(url);
      traceEs.onopen = function () {
        traceConnLabel.textContent = T().sseOk;
        settingsTraceConnValue.textContent = traceConnLabel.textContent;
        traceConnDot.classList.add('live');
        traceConnPill.classList.add('ok');
        traceConnPill.classList.remove('bad');
      };
      traceEs.onmessage = function () {
        // Always update streaming bubble + work strip
        processTraceTick();
        // Only refresh trace timeline when the trace panel is visible
        if (traceBooted && !panelTrace.classList.contains('hidden-narrow')) {
          loadTrace(); loadTree();
        }
      };
      traceEs.onerror = function () {
        traceConnLabel.textContent = T().sseBad;
        settingsTraceConnValue.textContent = traceConnLabel.textContent;
        traceConnDot.classList.remove('live');
        traceConnPill.classList.add('bad');
        traceConnPill.classList.remove('ok');
      };
    }

    function authHeaders() {
      var h = {};
      if (AUTH_TOKEN) h['Authorization'] = 'Bearer ' + AUTH_TOKEN;
      return h;
    }

    function prettyJson(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return String(value);
      }
    }

    function formatManageStatus(status) {
      if (!status) return T().manageEmpty;
      var channels = Array.isArray(status.channels) ? status.channels : [];
      var tasks = Array.isArray(status.tasks) ? status.tasks : [];
      var lines = [
        'Chat: ' + (status.chatJid || 'unknown'),
        'Workspace: ' + (status.workspaceFolder || 'unbound'),
        'Agent: ' + (status.agentId || 'unbound') + (status.agentName ? ' (' + status.agentName + ')' : ''),
        'Provider: ' + (status.provider || 'unknown'),
        'Model: ' + (status.model || 'unknown'),
        'Memory: ' + (status.memoryConfigured ? 'configured' : 'empty'),
        'Channels: ' + (channels.length ? channels.map(function (channel) {
          return channel.name + '=' + (channel.connected ? 'up' : 'down');
        }).join(', ') : 'none'),
        'Tasks: ' + tasks.length,
      ];
      if (tasks.length) {
        lines.push('');
        lines.push('Scheduled tasks:');
        tasks.slice(0, 8).forEach(function (task) {
          lines.push('- ' + task.id + ' [' + task.status + ']' + (task.label ? ' ' + task.label : '') + (task.nextRun ? ' next=' + task.nextRun : ''));
        });
      }
      return lines.join('\n');
    }

    function formatManageDoctor(doctor) {
      if (!doctor) return T().manageEmpty;
      var checks = Array.isArray(doctor.checks) ? doctor.checks : [];
      var lines = [
        'Runtime: ' + (doctor.runtime || 'unknown'),
      ];
      if (!checks.length) return lines.join('\n');
      lines.push('');
      checks.forEach(function (check) {
        lines.push('- [' + check.status + '] ' + check.name + ': ' + check.detail);
      });
      return lines.join('\n');
    }

    async function refreshManagementPanels() {
      var t = T();
      if (manageStatusPanel) manageStatusPanel.textContent = t.manageLoading;
      if (manageDoctorPanel) manageDoctorPanel.textContent = t.manageLoading;
      try {
        var [statusRes, doctorRes] = await Promise.all([
          fetch('/api/manage/status?chatJid=' + encodeURIComponent(chatJid), { headers: authHeaders() }),
          fetch('/api/manage/doctor?chatJid=' + encodeURIComponent(chatJid), { headers: authHeaders() }),
        ]);
        if (!statusRes.ok || !doctorRes.ok) throw new Error(t.manageFetchError);
        var statusData = await statusRes.json();
        var doctorData = await doctorRes.json();
        if (manageStatusPanel) manageStatusPanel.textContent = formatManageStatus(statusData.status);
        if (manageDoctorPanel) manageDoctorPanel.textContent = formatManageDoctor(doctorData.doctor);
      } catch (e) {
        var message = e && e.message ? e.message : t.manageFetchError;
        if (manageStatusPanel) manageStatusPanel.textContent = message;
        if (manageDoctorPanel) manageDoctorPanel.textContent = message;
      }
    }

    async function runManageCommand(text) {
      var t = T();
      if (!text) return;
      if (manageCommandBtn) manageCommandBtn.disabled = true;
      if (manageCommandOutput) manageCommandOutput.textContent = t.manageLoading;
      try {
        var res = await fetch('/api/manage/command', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ chatJid: chatJid, text: text }),
        });
        if (!res.ok) throw new Error(t.manageCommandError);
        var data = await res.json();
        if (manageCommandOutput) {
          manageCommandOutput.textContent = data.response || prettyJson(data.data) || t.manageEmpty;
        }
        await refreshManagementPanels();
      } catch (e) {
        if (manageCommandOutput) {
          manageCommandOutput.textContent = e && e.message ? e.message : t.manageCommandError;
        }
      } finally {
        if (manageCommandBtn) manageCommandBtn.disabled = false;
      }
    }

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function escAttr(s) {
      return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    }

    (function setupMarkdownSanitize() {
      if (typeof DOMPurify !== 'undefined' && !globalThis.__bioclawDpHook) {
        globalThis.__bioclawDpHook = true;
        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
          if (node.tagName === 'A' && node.hasAttribute('href')) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noreferrer noopener');
          }
        });
      }
    })();

    function linkifyBareFilePaths(t) {
      return String(t).replace(/(^|\s|[>\u00a0])(\/files\/[\w./%-]+)/g, function (_, sep, p) {
        return sep + '[' + p + '](' + p + ')';
      });
    }

    function markdownToSafeHtml(raw) {
      if (typeof marked === 'undefined' || typeof marked.parse !== 'function' || typeof DOMPurify === 'undefined') {
        return esc(raw).replace(/(\/files\/[\w./%-]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>').replace(/\n/g, '<br>');
      }
      try {
        if (typeof marked.setOptions === 'function') marked.setOptions({ gfm: true, breaks: true });
        var linked = linkifyBareFilePaths(raw);
        var html = marked.parse(linked, { async: false });
        return DOMPurify.sanitize(html, {
          ALLOWED_TAGS: ['p','br','strong','em','b','i','code','pre','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','a','hr','del','ins','sub','sup','table','thead','tbody','tr','th','td','img'],
          ALLOWED_ATTR: ['href','title','class','colspan','rowspan','align','src','alt','width','height','loading'],
          ALLOW_DATA_ATTR: false,
        });
      } catch (e2) {
        return esc(raw).replace(/\n/g, '<br>');
      }
    }

    function extractFileLinks(text) {
      var matches = String(text).match(/\/files\/[\w./%-]+/g);
      if (!matches) return [];
      var seen = {};
      var list = [];
      for (var i = 0; i < matches.length; i++) {
        var item = matches[i];
        if (seen[item]) continue;
        seen[item] = true;
        list.push(item);
      }
      return list;
    }

    function renderFileActions(paths) {
      if (!paths || paths.length === 0) return '';
      var t = T();
      return '<div class="file-action-list">' + paths.map(function (p) {
        var name = p.split('/').pop() || p;
        return '<div class="file-action-item">' +
          '<div class="file-action-name">' + esc(name) + '</div>' +
          '<div class="file-actions">' +
          '<a class="file-button" href="' + escAttr(p) + '" target="_blank" rel="noreferrer">' + esc(t.openFile) + '</a>' +
          '<a class="file-button" href="' + escAttr(p) + '" download>' + esc(t.downloadFile) + '</a>' +
          '</div></div>';
      }).join('') + '</div>';
    }


    /**
     * Walk a flat steps array and pair each `thinking` step with the next `tool`
     * step that follows. The thinking text becomes `tool.thinkingPreview`, and
     * the standalone thinking step is dropped (its content lives on the tool now).
     * If a thinking step has no following tool (last in run, etc.), it stays
     * as its own step.
     */
    function pairThinkingWithTool(steps) {
      var out = [];
      var pendingThinking = null;
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (s.kind === 'thinking') {
          // If there's already a pending thinking, push the older one first
          if (pendingThinking) out.push(pendingThinking);
          pendingThinking = s;
          continue;
        }
        if (s.kind === 'tool' && pendingThinking) {
          // Attach the thinking text to this tool step and consume it
          var merged = {};
          for (var k in s) if (s.hasOwnProperty(k)) merged[k] = s[k];
          merged.thinkingPreview = pendingThinking.detail || '';
          out.push(merged);
          pendingThinking = null;
          continue;
        }
        // Non-tool, non-thinking — flush pending thinking, then push this
        if (pendingThinking) { out.push(pendingThinking); pendingThinking = null; }
        out.push(s);
      }
      if (pendingThinking) out.push(pendingThinking);
      return out;
    }

    /**
     * Turn a step (thinking/tool) into a one-line plain-language summary
     * understandable by a biology user with zero CS/AI background.
     * E.g. "正在分析序列相似性" / "Comparing sequence similarity".
     * Returns null if no summary is available.
     */
    function humanizeStep(kind, toolName, rawInput, rawText) {
      var zh = (lang === 'zh');
      function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
      function parseInput(v) {
        if (!v) return null;
        if (typeof v === 'object') return v;
        try { return JSON.parse(v); } catch (_) { return null; }
      }
      function basename(p) { return String(p || '').split('/').filter(Boolean).pop() || p; }
      function hostname(u) {
        try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return String(u || ''); }
      }
      // Friendly database / website name from URL
      function siteToFriendly(host) {
        host = String(host || '').toLowerCase();
        // Literature & preprints
        if (host.includes('pubmed.ncbi') || host.includes('ncbi.nlm.nih.gov/pubmed')) return zh ? 'PubMed 文献库' : 'PubMed';
        if (host.includes('biorxiv')) return zh ? 'bioRxiv 预印本' : 'bioRxiv';
        if (host.includes('medrxiv')) return zh ? 'medRxiv 预印本' : 'medRxiv';
        if (host.includes('arxiv')) return 'arXiv';
        if (host.includes('nature.com') || host.includes('cell.com') || host.includes('science.org')) return zh ? '期刊文章' : 'a journal article';
        if (host.includes('plos.org')) return 'PLOS';
        if (host.includes('elifesciences')) return 'eLife';
        if (host.includes('frontiersin')) return zh ? 'Frontiers 期刊' : 'Frontiers journal';
        if (host.includes('scholar.google')) return zh ? 'Google Scholar 学术搜索' : 'Google Scholar';
        if (host.includes('semanticscholar')) return 'Semantic Scholar';
        // Sequence/genome databases
        if (host.includes('ncbi.nlm.nih.gov')) return zh ? 'NCBI 数据库' : 'NCBI';
        if (host.includes('ddbj.nig.ac.jp')) return 'DDBJ';
        if (host.includes('ebi.ac.uk')) return zh ? 'EBI 数据库' : 'EBI';
        if (host.includes('ensembl')) return zh ? 'Ensembl 基因组库' : 'Ensembl';
        if (host.includes('ucsc.edu') || host.includes('genome.ucsc.edu')) return zh ? 'UCSC 基因组浏览器' : 'UCSC Genome Browser';
        if (host.includes('1000genomes')) return zh ? '1000 Genomes 计划' : '1000 Genomes';
        if (host.includes('gnomad')) return zh ? 'gnomAD 群体变异库' : 'gnomAD';
        if (host.includes('clinvar')) return 'ClinVar';
        if (host.includes('omim')) return zh ? 'OMIM 遗传病数据库' : 'OMIM';
        // Proteins & structures
        if (host.includes('uniprot')) return zh ? 'UniProt 蛋白库' : 'UniProt';
        if (host.includes('rcsb') || host.includes('pdb.org')) return zh ? 'PDB 蛋白结构库' : 'PDB';
        if (host.includes('alphafold')) return zh ? 'AlphaFold 结构数据库' : 'AlphaFold DB';
        if (host.includes('interpro')) return 'InterPro';
        if (host.includes('pfam')) return 'Pfam';
        if (host.includes('string-db')) return zh ? 'STRING 蛋白互作' : 'STRING';
        if (host.includes('biogrid')) return 'BioGRID';
        // Pathways & ontologies
        if (host.includes('kegg')) return zh ? 'KEGG 通路库' : 'KEGG';
        if (host.includes('reactome')) return zh ? 'Reactome 通路库' : 'Reactome';
        if (host.includes('geneontology') || host.includes('amigo.geneontology')) return zh ? 'Gene Ontology (GO)' : 'Gene Ontology';
        if (host.includes('msigdb')) return zh ? 'MSigDB 基因集' : 'MSigDB';
        if (host.includes('enrichr')) return 'Enrichr';
        // Single-cell / expression
        if (host.includes('humancellatlas') || host.includes('data.humancellatlas')) return zh ? 'Human Cell Atlas' : 'Human Cell Atlas';
        if (host.includes('gtex')) return zh ? 'GTEx 表达图谱' : 'GTEx';
        if (host.includes('tcga') || host.includes('gdc.cancer.gov')) return zh ? 'TCGA 癌症基因组' : 'TCGA';
        if (host.includes('cellxgene')) return 'CELLxGENE';
        // Drugs / chemistry
        if (host.includes('drugbank')) return 'DrugBank';
        if (host.includes('chembl')) return 'ChEMBL';
        if (host.includes('pubchem')) return 'PubChem';
        // Tools / orgs
        if (host.includes('addgene')) return 'Addgene';
        if (host.includes('jax.org')) return zh ? 'JAX 小鼠数据库' : 'JAX';
        if (host.includes('mgi.jax')) return zh ? 'MGI 小鼠基因库' : 'MGI';
        if (host.includes('flybase')) return 'FlyBase';
        if (host.includes('wormbase')) return 'WormBase';
        if (host.includes('zfin')) return 'ZFIN';
        if (host.includes('sgd') && host.includes('stanford')) return 'SGD';
        if (host.includes('arabidopsis') || host.includes('tair')) return 'TAIR';
        // Generic
        if (host.includes('github.com') || host.includes('githubusercontent')) return 'GitHub';
        if (host.includes('huggingface')) return zh ? 'Hugging Face 模型库' : 'Hugging Face';
        if (host.includes('wikipedia')) return zh ? '维基百科' : 'Wikipedia';
        return host;
      }
      // Friendly description from filename extension
      function fileKind(name) {
        name = String(name || '').toLowerCase();
        if (/\.(fasta|fa|fna|faa|ffn|frn|mfa)$/.test(name)) return zh ? '序列文件' : 'sequence file';
        if (/\.(fastq|fq)(\.gz)?$/.test(name)) return zh ? '测序数据' : 'sequencing reads';
        if (/\.(sam|bam|cram)$/.test(name)) return zh ? '比对文件' : 'alignment file';
        if (/\.(vcf|bcf)(\.gz)?$/.test(name)) return zh ? '变异文件' : 'variant file';
        if (/\.(gff3?|gtf|bed)$/.test(name)) return zh ? '基因组注释' : 'genomic annotation';
        if (/\.(h5ad|loom)$/.test(name)) return zh ? '单细胞数据' : 'single-cell dataset';
        if (/\.(h5|hdf5)$/.test(name)) return zh ? 'HDF5 数据' : 'HDF5 data';
        if (/\.(mtx|mtx\.gz)$/.test(name)) return zh ? '矩阵数据' : 'matrix data';
        if (/\.(nwk|tree|newick)$/.test(name)) return zh ? '系统发育树' : 'phylogenetic tree';
        if (/\.(pdb|cif|mmcif|mol2)$/.test(name)) return zh ? '蛋白结构文件' : 'structure file';
        if (/\.(sdf|mol)$/.test(name)) return zh ? '化合物结构' : 'chemical structure';
        if (/\.(csv|tsv)$/.test(name)) return zh ? '数据表' : 'data table';
        if (/\.(xlsx?|xls)$/.test(name)) return zh ? 'Excel 表格' : 'Excel spreadsheet';
        if (/\.(parquet|feather|arrow)$/.test(name)) return zh ? '列式数据' : 'columnar data';
        if (/\.(npy|npz)$/.test(name)) return zh ? 'NumPy 数组' : 'NumPy array';
        if (/\.(pkl|pickle)$/.test(name)) return zh ? 'Python 数据对象' : 'Python data';
        if (/\.(png|jpe?g|svg|webp|gif|tiff?)$/.test(name)) return zh ? '图片' : 'image';
        if (/\.pdf$/.test(name)) return zh ? 'PDF 文献/文档' : 'PDF document';
        if (/\.docx?$/.test(name)) return zh ? 'Word 文档' : 'Word document';
        if (/\.(py|ipynb)$/.test(name)) return zh ? '分析脚本' : 'analysis script';
        if (/\.(r|rmd)$/.test(name)) return zh ? 'R 脚本' : 'R script';
        if (/\.(sh|bash)$/.test(name)) return zh ? 'Shell 脚本' : 'shell script';
        if (/\.(md|markdown)$/.test(name)) return zh ? 'Markdown 文档' : 'Markdown document';
        if (/\.(yaml|yml|toml|ini|cfg)$/.test(name)) return zh ? '配置文件' : 'config file';
        if (/\.json$/.test(name)) return zh ? 'JSON 数据' : 'JSON data';
        if (/\.(xml|html?)$/.test(name)) return zh ? 'XML/HTML 文件' : 'XML/HTML file';
        if (/\.(txt|log)$/.test(name)) return zh ? '说明文档' : 'document';
        if (/\.(zip|tar|tar\.gz|tgz|gz|bz2|xz|7z|rar)$/.test(name)) return zh ? '压缩包' : 'archive';
        return zh ? '文件' : 'file';
      }

      // ── Thinking → just a plain label, no content ──
      if (kind === 'thinking') {
        return zh ? '思考中…' : 'Thinking…';
      }

      // ── Tool calls → biology-friendly description ──
      if (kind === 'tool') {
        var input = parseInput(rawInput) || {};
        var name = String(toolName || '').trim();
        // Normalize OpenAI-compatible snake_case tool names → Claude PascalCase equivalents
        // so we don't have to repeat every case.
        var nameAliases = {
          'bash': 'Bash',
          'write_file': 'Write',
          'read_file': 'Read',
          'edit_file': 'Edit',
          'list_files': 'Glob',
          'send_message': 'SendMessage',
          'send_image': 'SendImage',
          'schedule_task': 'ScheduleTask',
        };
        if (nameAliases[name]) name = nameAliases[name];
        switch (name) {
          case 'Bash': {
            var cmd = String(input.command || '').trim();
            var head = cmd.split(/\s+/)[0] || '';
            // BLAST family
            if (/^blastn$/.test(head))   return zh ? '比对核酸序列相似性 (BLAST)' : 'Comparing DNA sequence similarity (BLAST)';
            if (/^blastp$/.test(head))   return zh ? '比对蛋白序列相似性 (BLAST)' : 'Comparing protein sequence similarity (BLAST)';
            if (/^blastx$/.test(head))   return zh ? '将核酸翻译后比对蛋白库 (BLASTX)' : 'Translating DNA and BLASTing against proteins';
            if (/^tblastn$/.test(head))  return zh ? '用蛋白搜索翻译后的基因组' : 'Searching translated genomes with a protein';
            if (/^tblastx$/.test(head))  return zh ? '六框翻译比对 (TBLASTX)' : 'Six-frame translated BLAST';
            if (/^psiblast$/.test(head)) return zh ? 'PSI-BLAST 迭代搜索' : 'Iterative PSI-BLAST search';
            if (/^makeblastdb$/.test(head)) return zh ? '建立 BLAST 数据库' : 'Building BLAST database';
            // Alignment & mapping
            if (head === 'samtools') {
              var subN = (cmd.match(/samtools\s+(\w+)/) || [])[1] || '';
              if (subN === 'view')      return zh ? '查看比对文件' : 'Inspecting alignment file';
              if (subN === 'sort')      return zh ? '整理比对文件' : 'Sorting alignment file';
              if (subN === 'index')     return zh ? '为比对文件建索引' : 'Indexing alignment file';
              if (subN === 'flagstat')  return zh ? '统计比对结果' : 'Summarizing alignment stats';
              if (subN === 'depth')     return zh ? '计算覆盖深度' : 'Computing coverage depth';
              if (subN === 'mpileup')   return zh ? '生成位点级覆盖' : 'Generating per-site pileup';
              if (subN === 'merge')     return zh ? '合并比对文件' : 'Merging alignment files';
              if (subN === 'faidx')     return zh ? '为参考序列建索引' : 'Indexing reference FASTA';
              return zh ? '处理测序比对数据' : 'Working with alignment data';
            }
            if (head === 'bcftools') {
              var bcfSub = (cmd.match(/bcftools\s+(\w+)/) || [])[1] || '';
              if (bcfSub === 'view')   return zh ? '查看变异文件' : 'Inspecting variant file';
              if (bcfSub === 'call')   return zh ? '调用变异位点' : 'Calling variants';
              if (bcfSub === 'filter') return zh ? '过滤变异' : 'Filtering variants';
              if (bcfSub === 'merge')  return zh ? '合并变异文件' : 'Merging variant files';
              if (bcfSub === 'norm')   return zh ? '规范化变异' : 'Normalizing variants';
              if (bcfSub === 'stats')  return zh ? '统计变异信息' : 'Computing variant stats';
              return zh ? '处理变异数据' : 'Working with variant data';
            }
            if (head === 'vcftools')  return zh ? '处理 VCF 变异文件' : 'Working with VCF variants';
            if (head === 'bedtools')  return zh ? '处理基因组区间' : 'Working with genomic intervals';
            if (head === 'tabix')     return zh ? '为压缩文件建索引' : 'Indexing compressed file';
            if (head === 'bgzip')     return zh ? '压缩生物文件' : 'Compressing bio file';
            if (head === 'fastqc')    return zh ? '检查测序质量' : 'Checking sequencing quality';
            if (head === 'multiqc')   return zh ? '汇总质量报告' : 'Aggregating QC reports';
            if (head === 'trimmomatic' || head === 'fastp' || head === 'cutadapt') return zh ? '清洗测序数据' : 'Trimming sequencing reads';
            if (head === 'minimap2')  return zh ? '比对长读长测序数据' : 'Aligning long-read sequencing data';
            if (head === 'bwa')       return zh ? '比对短读长测序数据' : 'Aligning short-read sequencing data';
            if (head === 'bowtie2' || head === 'bowtie') return zh ? '比对短读长测序数据' : 'Aligning short reads';
            if (head === 'star' || head === 'STAR') return zh ? '比对 RNA-seq 数据' : 'Aligning RNA-seq reads';
            if (head === 'hisat2')    return zh ? '比对 RNA-seq 数据' : 'Aligning RNA-seq reads';
            if (head === 'tophat' || head === 'tophat2') return zh ? '比对 RNA-seq 数据' : 'Aligning RNA-seq reads';
            if (head === 'salmon')    return zh ? '定量转录本表达' : 'Quantifying transcripts';
            if (head === 'kallisto')  return zh ? '伪比对定量表达' : 'Pseudoaligning for expression';
            if (head === 'featureCounts' || head === 'htseq-count') return zh ? '统计基因表达计数' : 'Counting gene reads';
            if (head === 'stringtie') return zh ? '组装转录本' : 'Assembling transcripts';
            if (head === 'cufflinks') return zh ? '组装转录本 (Cufflinks)' : 'Assembling transcripts (Cufflinks)';
            // Sequence tools
            if (head === 'seqtk')     return zh ? '处理序列文件' : 'Working with sequence files';
            if (head === 'seqkit')    return zh ? '处理序列文件 (seqkit)' : 'Working with sequences (seqkit)';
            if (head === 'gffread')   return zh ? '处理基因组注释' : 'Processing GFF/GTF annotations';
            // Multiple alignment & phylogenetics
            if (head === 'mafft')     return zh ? '多序列比对 (MAFFT)' : 'Multiple sequence alignment (MAFFT)';
            if (head === 'muscle')    return zh ? '多序列比对 (MUSCLE)' : 'Multiple sequence alignment (MUSCLE)';
            if (head === 'clustalo' || head === 'clustalw') return zh ? '多序列比对 (Clustal)' : 'Multiple sequence alignment (Clustal)';
            if (head === 'tcoffee' || head === 't_coffee') return zh ? '多序列比对 (T-Coffee)' : 'Multiple sequence alignment';
            if (head === 'iqtree' || head === 'iqtree2') return zh ? '构建系统发育树 (IQ-TREE)' : 'Building phylogenetic tree';
            if (head === 'raxml' || head === 'raxml-ng') return zh ? '构建系统发育树 (RAxML)' : 'Building phylogenetic tree';
            if (head === 'fasttree')  return zh ? '快速建树' : 'Building approximate tree';
            // Profile / domain search
            if (head === 'hmmscan' || head === 'hmmsearch') return zh ? '蛋白结构域搜索 (HMMER)' : 'Protein domain search (HMMER)';
            if (head === 'hmmbuild') return zh ? '构建 HMM 模型' : 'Building HMM profile';
            if (head === 'interproscan' || head === 'interproscan.sh') return zh ? '蛋白功能注释 (InterProScan)' : 'Protein domain annotation';
            // Assembly & annotation
            if (head === 'spades' || head === 'spades.py') return zh ? '基因组组装 (SPAdes)' : 'Genome assembly (SPAdes)';
            if (head === 'flye')      return zh ? '长读长基因组组装 (Flye)' : 'Long-read genome assembly';
            if (head === 'canu')      return zh ? '基因组组装 (Canu)' : 'Genome assembly (Canu)';
            if (head === 'trinity' || head === 'Trinity') return zh ? '转录组组装' : 'Transcriptome assembly';
            if (head === 'prokka')    return zh ? '细菌基因组注释' : 'Prokaryote annotation';
            if (head === 'busco')     return zh ? '评估基因组完整性 (BUSCO)' : 'Genome completeness assessment';
            // R / Rscript
            if (head === 'Rscript' || head === 'R') {
              if (/deseq/i.test(cmd))  return zh ? '差异表达分析 (DESeq2)' : 'Differential expression (DESeq2)';
              if (/edger/i.test(cmd))  return zh ? '差异表达分析 (edgeR)' : 'Differential expression (edgeR)';
              if (/seurat/i.test(cmd)) return zh ? '单细胞分析 (Seurat)' : 'Single-cell analysis (Seurat)';
              if (/limma/i.test(cmd))  return zh ? '差异表达分析 (limma)' : 'Differential expression (limma)';
              return zh ? '运行 R 统计分析' : 'Running R analysis';
            }
            // Workflows
            if (head === 'nextflow') return zh ? '运行 Nextflow 流程' : 'Running Nextflow workflow';
            if (head === 'snakemake') return zh ? '运行 Snakemake 流程' : 'Running Snakemake workflow';
            if (head === 'cwltool')   return zh ? '运行 CWL 流程' : 'Running CWL workflow';
            if (head === 'make')      return zh ? '编译 / 运行 Makefile' : 'Running Makefile';
            // Network
            if (head === 'curl' || head === 'wget') {
              var urlMatch = cmd.match(/https?:\/\/[^\s'"]+/);
              return urlMatch ? (zh ? '从 ' : 'Downloading from ') + siteToFriendly(hostname(urlMatch[0])) + (zh ? ' 下载数据' : '') : (zh ? '下载数据' : 'Downloading data');
            }
            if (head === 'rsync' || head === 'scp') return zh ? '同步/传输文件' : 'Transferring files';
            if (head === 'git') {
              var gitSub = (cmd.match(/git\s+(\w+)/) || [])[1] || '';
              if (gitSub === 'clone')  return zh ? '克隆代码仓库' : 'Cloning repository';
              if (gitSub === 'pull')   return zh ? '拉取最新代码' : 'Pulling latest code';
              if (gitSub === 'commit') return zh ? '提交修改' : 'Committing changes';
              return zh ? '使用 Git' : 'Running Git';
            }
            // Python / Python libs heuristics
            if (head === 'python3' || head === 'python') {
              if (/seaborn|matplotlib|sns\.|plt\.|heatmap|barplot|histplot|lineplot|scatter/.test(cmd)) return zh ? '绘制图表' : 'Drawing a chart';
              if (/pandas|pd\./.test(cmd)) return zh ? '分析表格数据' : 'Analyzing tabular data';
              if (/biopython|from Bio\b/.test(cmd)) return zh ? '处理生物序列' : 'Processing biological sequences';
              if (/scanpy|\bsc\./.test(cmd)) return zh ? '分析单细胞数据' : 'Analyzing single-cell data';
              if (/anndata|\bad\./.test(cmd)) return zh ? '处理 AnnData 数据' : 'Working with AnnData';
              if (/pydeseq|deseq/i.test(cmd)) return zh ? '差异表达分析 (PyDESeq2)' : 'Differential expression analysis';
              if (/sklearn|scikit-learn/.test(cmd)) return zh ? '机器学习分析' : 'Machine learning analysis';
              if (/scipy/.test(cmd)) return zh ? '科学计算 (SciPy)' : 'Scientific computing (SciPy)';
              if (/statsmodels/.test(cmd)) return zh ? '统计建模' : 'Statistical modeling';
              if (/rdkit/.test(cmd)) return zh ? '化学结构分析 (RDKit)' : 'Cheminformatics (RDKit)';
              if (/numpy|\bnp\./.test(cmd)) return zh ? '数值计算 (NumPy)' : 'Numerical computing (NumPy)';
              if (/requests|urllib|httpx/.test(cmd)) return zh ? '网络请求' : 'HTTP request';
              if (/beautifulsoup|bs4|lxml/.test(cmd)) return zh ? '解析网页' : 'Parsing web content';
              if (/pysam/.test(cmd)) return zh ? '读取 BAM/SAM 数据' : 'Reading BAM/SAM data';
              var scriptMatch = cmd.match(/python3?\s+([^\s]+\.py)/);
              if (scriptMatch) return (zh ? '运行分析脚本 ' : 'Running analysis script ') + basename(scriptMatch[1]);
              return zh ? '用 Python 计算' : 'Running Python analysis';
            }
            if (head === 'jupyter')   return zh ? '启动 Jupyter 笔记本' : 'Launching Jupyter notebook';
            if (head === 'pip3' || head === 'pip') return zh ? '准备分析工具' : 'Installing Python packages';
            if (head === 'conda' || head === 'mamba') return zh ? '管理 Conda 环境' : 'Managing Conda env';
            if (head === 'apt-get' || head === 'apt') return zh ? '安装系统组件' : 'Installing system packages';
            // File system
            if (head === 'ls')         return zh ? '查看当前文件' : 'Listing files';
            if (head === 'tree')       return zh ? '查看目录结构' : 'Showing directory tree';
            if (head === 'find')       return zh ? '查找文件' : 'Finding files';
            if (head === 'cat' || head === 'less' || head === 'more') return (zh ? '查看文件 ' : 'Reading ') + basename(cmd.split(/\s+/)[1] || '');
            if (head === 'head')       return (zh ? '查看文件开头 ' : 'Showing head of ') + basename(cmd.split(/\s+/)[1] || '');
            if (head === 'tail')       return (zh ? '查看文件末尾 ' : 'Showing tail of ') + basename(cmd.split(/\s+/)[1] || '');
            if (head === 'wc')         return zh ? '统计文件行数/大小' : 'Counting lines/size';
            if (head === 'mkdir')      return zh ? '创建文件夹' : 'Creating a folder';
            if (head === 'rm' || head === 'rmdir') return zh ? '删除文件' : 'Removing files';
            if (head === 'cp')         return zh ? '复制文件' : 'Copying files';
            if (head === 'mv')         return zh ? '移动/重命名文件' : 'Moving / renaming files';
            if (head === 'ln')         return zh ? '创建软链接' : 'Creating symlink';
            if (head === 'chmod' || head === 'chown') return zh ? '修改文件权限' : 'Changing file permissions';
            if (head === 'df' || head === 'du') return zh ? '查看磁盘占用' : 'Checking disk usage';
            if (head === 'tar' || head === 'gzip' || head === 'gunzip' || head === 'unzip' || head === 'zip' || head === 'bzip2' || head === '7z' || head === 'xz') {
              return zh ? '压缩 / 解压文件' : 'Compressing / extracting files';
            }
            if (head === 'echo')       return zh ? '写入文本' : 'Writing text';
            if (head === 'which' || head === 'command' || head === 'whereis') return (zh ? '检查工具 ' : 'Checking for ') + (cmd.split(/\s+/)[1] || '');
            if (head === 'env' || head === 'export' || head === 'printenv') return zh ? '检查环境变量' : 'Inspecting environment';
            // Text manipulation
            if (head === 'awk' || head === 'sed' || head === 'grep' || head === 'cut' || head === 'sort' || head === 'uniq' || head === 'tr' || head === 'paste' || head === 'join' || head === 'comm') {
              return zh ? '处理文本数据' : 'Processing text data';
            }
            if (head === 'jq')   return zh ? '处理 JSON 数据' : 'Processing JSON data';
            if (head === 'yq')   return zh ? '处理 YAML 数据' : 'Processing YAML data';
            if (head === 'xargs') return zh ? '批量执行命令' : 'Running commands in batch';
            // ── Generic fallback: extract URL or file argument ──
            // For unknown commands, try to describe by destination URL or by file kind
            // before falling back to the raw command string.
            var urlInCmd = (cmd.match(/https?:\/\/[^\s'"]+/) || [])[0];
            if (urlInCmd) {
              return (zh ? '访问 ' : 'Visiting ') + siteToFriendly(hostname(urlInCmd));
            }
            var fileInCmd = (cmd.match(/[\w./-]+\.(fasta|fa|fna|faa|fastq|fq|sam|bam|cram|vcf|bcf|gff3?|gtf|bed|h5ad|loom|h5|hdf5|mtx|nwk|tree|pdb|cif|csv|tsv|xlsx?|parquet|npy|npz|pkl|pickle|png|jpe?g|svg|pdf|docx?|py|ipynb|r|rmd|sh|md|json|yaml|yml)(\.gz|\.bz2|\.xz)?\b/i) || [])[0];
            if (fileInCmd) {
              return (zh ? '处理' : 'Working with ') + fileKind(fileInCmd) + ' ' + basename(fileInCmd);
            }
            return (zh ? '运行命令: ' : 'Running: ') + clip(cmd, 50);
          }
          case 'WebSearch':
            return (zh ? '在网上查找资料: ' : 'Searching the web for: ') + '"' + clip(input.query || '', 70) + '"';
          case 'WebFetch':
            return (zh ? '查阅 ' : 'Looking up ') + siteToFriendly(hostname(input.url || ''));
          case 'Read':
            return (zh ? '查看' : 'Reading ') + fileKind(input.file_path || input.path || '') + ' ' + basename(input.file_path || input.path || '');
          case 'Write':
            return (zh ? '生成' : 'Creating ') + fileKind(input.file_path || input.path || '') + ' ' + basename(input.file_path || input.path || '');
          case 'Edit':
            return (zh ? '修改' : 'Editing ') + fileKind(input.file_path || input.path || '') + ' ' + basename(input.file_path || input.path || '');
          case 'NotebookEdit':
            return zh ? '更新分析笔记本' : 'Updating analysis notebook';
          case 'Glob':
            return (zh ? '查找相关文件: ' : 'Looking for files: ') + '"' + clip(input.pattern || '', 50) + '"';
          case 'Grep':
            return (zh ? '在文件中搜索: ' : 'Searching files for: ') + '"' + clip(input.pattern || '', 50) + '"';
          case 'Task':
            return clip(input.description || input.prompt || (zh ? '执行子任务' : 'Running a subtask'), 110);
          case 'TodoWrite':
            return zh ? '更新任务清单' : 'Updating to-do list';
          case 'ToolSearch':
            return (zh ? '查找可用工具: ' : 'Looking up tools: ') + '"' + clip(input.query || '', 50) + '"';
          case 'Skill':
            return (zh ? '使用技能 ' : 'Using skill ') + clip(input.skill || input.name || '', 60);
          case 'SendMessage':
            return zh ? '向用户发送消息' : 'Sending a message to chat';
          case 'SendImage':
            return (zh ? '发送图片 ' : 'Sending image ') + basename(input.file_path || '');
          case 'ScheduleTask':
            return zh ? '安排定时任务' : 'Scheduling a task';
          default: {
            if (name.indexOf('mcp__') === 0) {
              return (zh ? '调用工具 ' : 'Using tool ') + name.replace(/^mcp__/, '').replace(/__/g, '/');
            }
            var firstVal = '';
            for (var k in input) {
              if (input.hasOwnProperty(k) && typeof input[k] === 'string' && input[k]) { firstVal = input[k]; break; }
            }
            return (zh ? '执行 ' : 'Doing ') + name + (firstVal ? ': ' + clip(firstVal, 60) : '');
          }
        }
      }
      return null;
    }

    function traceTypeTitle(type, t) {
      switch (type) {
        case 'run_start': return t.evtRunStart;
        case 'agent_query_start': return t.evtRunStart;
        case 'run_end': return t.evtRunEnd;
        case 'run_error': return t.evtRunError;
        case 'stream_output': return t.evtStream;
        case 'container_spawn': return t.evtContainer;
        case 'ipc_send': return t.evtIpc;
        case 'agent_thinking': return t.evtThinking;
        case 'agent_tool_use': return t.evtToolUse;
        default: return t.evtUnknown + ' · ' + type;
      }
    }
    function traceParsedPayload(payloadStr) {
      try { return JSON.parse(payloadStr); } catch (e) { return null; }
    }
    function traceRawPretty(payloadStr) {
      try { return JSON.stringify(JSON.parse(payloadStr), null, 2); } catch (e) { return String(payloadStr); }
    }
    function traceExtraEvtClass(r, parsed) {
      if (r.type === 'run_end' && parsed && parsed.status === 'error') return ' evt-trace-run_end_err';
      if (r.type === 'run_end') return ' evt-trace-run_end_ok';
      return '';
    }
    /* ── Process step icon class ── */
    function pstepIconClass(type) {
      switch (type) {
        case 'agent_thinking': return 'think';
        case 'agent_tool_use': return 'tool';
        case 'ipc_send': return 'ipc';
        case 'run_error': return 'err';
        case 'container_spawn': return 'spawn';
        default: return 'spawn';
      }
    }
    function pstepIconLabel(type) {
      switch (type) {
        case 'agent_thinking': return 'T';
        case 'agent_tool_use': return '⚙';
        case 'ipc_send': return '↗';
        case 'container_spawn': return '▶';
        case 'run_error': return '!';
        default: return '·';
      }
    }

    /**
     * Extract file paths from a parsed trace event payload.
     * Returns array of { name, url } objects, or [] if no previewable files.
     * Container paths /workspace/group/<rel> map to /files/chat/<jid>/<rel>.
     */
    function extractTraceFiles(eventType, parsed) {
      if (!parsed) return [];
      var files = [];
      var seen = {};
      function addPath(p) {
        if (!p || typeof p !== 'string') return;
        // Map container path to web URL
        var rel = null;
        var m = p.match(/^\/workspace\/group\/(.+)$/);
        if (m) rel = m[1];
        else if (p.indexOf('/files/') === 0) {
          // Already a web URL
          var name = decodeURIComponent(p.split('/').pop() || 'file').replace(/^\d{10,}-/, '');
          if (!seen[p]) { seen[p] = 1; files.push({ name: name, url: p }); }
          return;
        }
        if (!rel) return;
        var url = '/files/chat/' + encodeURIComponent(chatJid) + '/' + rel.split('/').map(encodeURIComponent).join('/');
        var fname = rel.split('/').pop() || 'file';
        if (!seen[url]) { seen[url] = 1; files.push({ name: fname, url: url }); }
      }
      // tool_use: parse toolInput JSON for file_path / path / output keys
      if (eventType === 'agent_tool_use') {
        var raw = parsed.toolInputFull || parsed.toolInput;
        if (raw) {
          try {
            var input = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (input && typeof input === 'object') {
              ['file_path', 'path', 'output', 'output_path'].forEach(function (k) { if (input[k]) addPath(input[k]); });
              // For Bash commands, scrape any /workspace/group/... reference
              if (typeof input.command === 'string') {
                var matches = input.command.match(/\/workspace\/group\/[\w./%-]+/g);
                if (matches) matches.forEach(addPath);
              }
            }
          } catch (_) {}
        }
      }
      // ipc_send: filePath directly
      if (eventType === 'ipc_send') {
        if (parsed.filePath) addPath(parsed.filePath);
      }
      return files;
    }

    function fileButtonsHtml(files) {
      if (!files || !files.length) return '';
      return '<div class="pstep-files">' + files.map(function (f) {
        return '<button type="button" class="pstep-file-btn" data-preview-url="' + escAttr(f.url) + '" data-preview-name="' + escAttr(f.name) + '">📄 ' + esc(f.name) + '</button>';
      }).join('') + '</div>';
    }

    /**
     * Pair raw trace events: drop a thinking event when the next event is a
     * tool_use, and stash the thinking text on the tool_use event as
     * `_thinkingPreview` so renderProcessStep can use it as the description.
     */
    function pairThinkingWithToolEvents(events) {
      var out = [];
      var pendingThinkingText = null;
      for (var i = 0; i < events.length; i++) {
        var e = events[i];
        if (e.type === 'agent_thinking') {
          var p = traceParsedPayload(e.payload);
          if (p && p.text) pendingThinkingText = p.text;
          // In compact mode the thinking will be hidden anyway, but always drop
          // it from the rendered list when paired — it lives on the next tool now.
          // If it ends up not being paired, push it back at flush time.
          continue;
        }
        if (e.type === 'agent_tool_use' && pendingThinkingText) {
          // Shallow clone so we don't mutate the cached event row
          var cloned = {};
          for (var k in e) if (e.hasOwnProperty(k)) cloned[k] = e[k];
          cloned._thinkingPreview = pendingThinkingText;
          pendingThinkingText = null;
          out.push(cloned);
          continue;
        }
        // Not a tool — flush any pending thinking back into the stream
        if (pendingThinkingText) {
          // Synthesize a thinking event so it still renders
          out.push({ type: 'agent_thinking', payload: JSON.stringify({ text: pendingThinkingText }) });
          pendingThinkingText = null;
        }
        out.push(e);
      }
      if (pendingThinkingText) {
        out.push({ type: 'agent_thinking', payload: JSON.stringify({ text: pendingThinkingText }) });
      }
      return out;
    }

    function renderProcessStep(r, t) {
      var parsed = traceParsedPayload(r.payload);
      var cls = pstepIconClass(r.type);
      var icon = pstepIconLabel(r.type);
      var label = '';
      var detail = '';
      var time = r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

      if (r.type === 'agent_thinking' && parsed) {
        // Show natural-language summary of the thinking; full text only in Full mode.
        var thinkSummary = humanizeStep('thinking', null, null, parsed.text || '');
        label = '<span class="pstep-natural">' + esc(thinkSummary || t.evtThinking) + '</span>';
        detail = parsed.text || '';
      } else if (r.type === 'agent_tool_use' && parsed) {
        var rawInput = parsed.toolInputFull || parsed.toolInput;
        // Use rule-based humanize only — the LLM's own thinking text is too often
        // pessimistic ("it seems X is not available") to make a good summary.
        var toolSummary = humanizeStep('tool', parsed.toolName, rawInput, null);
        label = '<span class="pstep-tool-name">' + esc(String(parsed.toolName || '')) + '</span>' +
                (toolSummary ? '<span class="pstep-natural"> · ' + esc(toolSummary) + '</span>' : '');
        detail = parsed.toolInput || '';
      } else if (r.type === 'container_spawn' && parsed) {
        label = t.evtContainer;
        detail = parsed.containerName || '';
      } else if (r.type === 'ipc_send' && parsed) {
        label = t.evtIpc;
        detail = parsed.preview || parsed.caption || parsed.filePath || '';
      } else if (r.type === 'run_error' && parsed) {
        label = t.evtRunError;
        detail = parsed.message || JSON.stringify(parsed);
      } else {
        label = traceTypeTitle(r.type, t);
        detail = r.payload ? traceRawPretty(r.payload) : '';
      }

      var detailHtml = '';
      // In compact mode, hide all the verbose detail content (thinking text, command bodies, etc).
      // Only step label + time + file buttons. Full mode keeps the detail visible.
      if (detail && traceShowStream) {
        var detailStr = String(detail);
        if (detailStr.length <= 80) {
          detailHtml = '<div class="pstep-detail short">' + esc(detailStr) + '</div>';
        } else {
          var summary = esc(detailStr.slice(0, 60).replace(/\n/g, ' ')) + '…';
          detailHtml = '<details class="pstep-collapse"><summary>' + summary + '</summary>' +
            '<div class="pstep-collapse-body">' + esc(detailStr) + '</div></details>';
        }
      }
      var filesHtml = fileButtonsHtml(extractTraceFiles(r.type, parsed));
      return '<div class="pstep">' +
        '<div class="pstep-icon ' + cls + '">' + icon + '</div>' +
        '<div class="pstep-body"><span class="pstep-label">' + label + '</span>' +
        (time ? '<span class="pstep-time">' + esc(time) + '</span>' : '') +
        detailHtml +
        filesHtml +
        '</div></div>';
    }

    /**
     * Build response bubbles from steps.
     * Each stream_output becomes a response bubble; preceding thinking/tool steps
     * are grouped as collapsible process steps INSIDE that bubble.
     * If there are trailing steps with no stream_output, they form a bubble with
     * just the process steps (in-progress state).
     */
    function buildResponseBubbles(steps, endEvent, t) {
      var bubbles = [];
      var pending = []; // accumulates non-output steps

      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (s.type === 'stream_output') {
          bubbles.push({ process: pending.slice(), output: s });
          pending = [];
        } else {
          pending.push(s);
        }
      }
      // Trailing steps without output yet (running or error)
      if (pending.length > 0 || bubbles.length === 0) {
        bubbles.push({ process: pending.slice(), output: null });
      }

      var html = '';
      for (var b = 0; b < bubbles.length; b++) {
        var bub = bubbles[b];
        var parsed = bub.output ? traceParsedPayload(bub.output.payload) : null;
        var outputText = parsed && parsed.preview ? String(parsed.preview) : '';
        var isError = parsed && parsed.status === 'error';
        var isLastBubble = (b === bubbles.length - 1);

        html += '<div class="response-bubble">';

        // Process steps (collapsible) — pair thinking with the next tool_use so
        // the agent's own reasoning becomes the natural-language description.
        if (bub.process.length > 0) {
          var processEvents = pairThinkingWithToolEvents(bub.process);
          var stepsHtml = '';
          for (var p = 0; p < processEvents.length; p++) {
            stepsHtml += renderProcessStep(processEvents[p], t);
          }
          var processLabel = bub.process.length + (bub.process.length === 1 ? ' step' : ' steps');
          html += '<details class="process-steps"' + (isLastBubble && !bub.output ? ' open' : '') + '>';
          html += '<summary>' + esc(processLabel) + '</summary>';
          html += '<div class="process-steps-list">' + stepsHtml + '</div>';
          html += '</details>';
        }

        // Message content
        if (bub.output && outputText) {
          html += '<div class="response-content">' + markdownToSafeHtml(outputText) + '</div>';
        } else if (bub.output && isError) {
          html += '<div class="response-error">✗ ' + esc(parsed && parsed.preview ? String(parsed.preview) : 'Error') + '</div>';
        }

        html += '</div>';
      }

      // run_end error (distinct from stream_output error)
      if (endEvent) {
        var endParsed = traceParsedPayload(endEvent.payload);
        if (endParsed && endParsed.error) {
          html += '<div class="response-bubble"><div class="response-error">✗ ' + esc(String(endParsed.error)) + '</div></div>';
        }
      }

      return html;
    }

    function stripXmlTags(s) {
      return String(s)
        .replace(/<\/?(messages|message|system)[^>]*>/gi, '')
        .replace(/\s*sender="[^"]*"/gi, '')
        .replace(/\s*time="[^"]*"/gi, '')
        .trim();
    }

    function renderList(rows) {
      var t = T();
      // API returns newest-first (ORDER BY id DESC); reverse to chronological
      rows = rows.slice().reverse();
      var tasks = [];
      var current = null;

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.type === 'run_start' || r.type === 'agent_query_start') {
          // agent_query_start = follow-up query within same container session
          // Treat it as a new task card so each user message is separate.
          current = { start: r, steps: [], end: null };
          tasks.push({ type: 'task', task: current });
        } else if (r.type === 'run_end' && current) {
          current.end = r;
          current = null;
        } else if (current) {
          current.steps.push(r);
        } else {
          tasks.push({ type: 'standalone', event: r });
        }
      }

      var html = '';
      for (var g = 0; g < tasks.length; g++) {
        var grp = tasks[g];
        if (grp.type === 'standalone') {
          var ev = grp.event;
          var evParsed = traceParsedPayload(ev.payload);
          var evTitle = traceTypeTitle(ev.type, t);
          var evTime = ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
          var evCls = pstepIconClass(ev.type);
          var evIcon = pstepIconLabel(ev.type);
          var evLabel = evTitle;
          var evDetail = '';
          if (ev.type === 'agent_thinking' && evParsed) {
            evDetail = evParsed.text || '';
          } else if (ev.type === 'agent_tool_use' && evParsed) {
            evLabel = evTitle + ': <span class="pstep-tool-name">' + esc(String(evParsed.toolName || '')) + '</span>';
            evDetail = typeof evParsed.toolInput === 'object' ? JSON.stringify(evParsed.toolInput, null, 2) : String(evParsed.toolInput || '');
          } else if (ev.type === 'stream_output' && evParsed) {
            evDetail = evParsed.result || evParsed.text || evParsed.preview || '';
          } else if (ev.type === 'container_spawn' && evParsed) {
            evDetail = evParsed.containerName || '';
          } else if (ev.type === 'ipc_send' && evParsed) {
            evDetail = evParsed.preview || evParsed.caption || evParsed.filePath || '';
          } else if (ev.type === 'run_error' && evParsed) {
            evDetail = evParsed.message || JSON.stringify(evParsed);
          } else if (evParsed) {
            evDetail = evParsed.preview || (ev.payload ? traceRawPretty(ev.payload) : '');
          }
          html += '<div class="evt-standalone">';
          html += '<div class="evt-s-header">';
          html += '<span class="evt-s-icon pstep-icon ' + evCls + '">' + evIcon + '</span>';
          html += '<span class="evt-s-title">' + evLabel + '</span>';
          if (evTime) html += '<span class="evt-s-time">' + esc(evTime) + '</span>';
          html += '</div>';
          if (evDetail && traceShowStream) {
            var evShort = evDetail.length <= 60;
            if (evShort) {
              html += '<div class="evt-s-detail">' + esc(evDetail) + '</div>';
            } else {
              var evSummaryText = esc(evDetail.slice(0, 60).replace(/\n/g, ' ')) + '…';
              html += '<details class="evt-s-collapse"><summary>' + evSummaryText + '</summary>';
              html += '<div class="evt-s-collapse-body">' + esc(evDetail) + '</div>';
              html += '</details>';
            }
          }
          html += '</div>';
        } else {
          var task = grp.task;
          var parsed = traceParsedPayload(task.start.payload);
          // run_start uses "preview", agent_query_start uses "text"
          var rawPreview = parsed ? (parsed.preview || parsed.text || '') : '';
          var preview = rawPreview ? stripXmlTags(String(rawPreview)).slice(0, 200) : '';
          var statusClass = task.end ? (traceParsedPayload(task.end.payload)?.status === 'error' ? 'err' : 'ok') : '';
          var statusLabel = task.end ? (statusClass === 'err' ? '✗ ' + t.evtRunError : '✓ ' + t.evtRunEnd) : '';
          var time = task.start.created_at ? new Date(task.start.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
          var folder = task.start.group_folder || '';
          var isLast = (g === tasks.length - 1);
          var cardClass = 'task-card' + (statusClass === 'err' ? ' is-error' : '');

          var runTs = task.start.created_at || '';
          html += '<details class="' + cardClass + '" data-run-ts="' + escAttr(runTs) + '" ' + (isLast ? 'open' : '') + '>';
          html += '<summary class="task-header">';
          html += '<div class="task-status ' + statusClass + '"></div>';
          html += '<div class="task-info">';
          html += '<div class="task-prompt">' + (preview ? esc(preview) : t.evtRunStart) + '</div>';
          html += '<div class="task-meta">';
          html += '<span>' + esc(time) + '</span>';
          html += '<span>' + esc(folder) + '</span>';
          html += '<span>' + statusLabel + '</span>';
          html += '</div></div>';
          html += '<svg class="task-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
          html += '</summary>';
          html += '<div class="task-body">';
          html += buildResponseBubbles(task.steps, task.end, t);
          html += '</div></details>';
        }
      }

      timeline.innerHTML = html;
      timeline.scrollTop = timeline.scrollHeight;
    }

    async function loadGroups() {
      var res = await fetch('/api/workspace/groups', { headers: authHeaders() });
      if (!res.ok) return;
      var data = await res.json();
      var prev = groupSel.value;
      while (groupSel.options.length > 1) groupSel.remove(1);
      (data.folders || []).forEach(function (f) {
        var o = document.createElement('option');
        o.value = f; o.textContent = f;
        groupSel.appendChild(o);
      });
      if (prev && Array.prototype.some.call(groupSel.options, function (o) { return o.value === prev; })) groupSel.value = prev;
    }

    function traceListQuery() {
      // Default to the current chat's workspace folder when groupSel hasn't been
      // populated yet (page load). Otherwise loadTrace would fetch events from
      // ALL groups, showing leftover trace from previous conversations.
      var g = groupSel.value || workspaceFolderForChat(chatJid);
      var q = '/api/trace/list?limit=400' + (g ? '&group_folder=' + encodeURIComponent(g) : '');
      // Both modes hide the noisy stream_output chunks. Thinking + tool_use steps
      // are kept in BOTH modes so the user can see *what kind* of step happened.
      // The difference is detail visibility — in compact mode the renderer hides
      // the body content (thinking text, command bodies) and only shows step labels.
      q += '&compact=1';
      return q;
    }

    async function loadTrace() {
      var res = await fetch(traceListQuery(), { headers: authHeaders() });
      if (!res.ok) { timeline.textContent = T().loadFail; return; }
      var data = await res.json();
      renderList(data.events || []);
    }

    function wsFileBadge(name) {
      var ext = (name.split('.').pop() || '').toLowerCase();
      if (THREE_D_EXTS.indexOf(ext) >= 0) return '<span class="ws-badge ws-badge-3d">🧬 3D</span>';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].indexOf(ext) >= 0) return '<span class="ws-badge ws-badge-img">IMG</span>';
      if (ext === 'pdf') return '<span class="ws-badge ws-badge-pdf">PDF</span>';
      if (['fasta', 'fa', 'fna', 'faa', 'fastq', 'fq'].indexOf(ext) >= 0) return '<span class="ws-badge ws-badge-doc">SEQ</span>';
      if (['csv', 'tsv', 'xlsx', 'parquet'].indexOf(ext) >= 0) return '<span class="ws-badge ws-badge-doc">TBL</span>';
      return '';
    }

    async function loadTree() {
      var g = groupSel.value;
      if (!g) { treeEl.textContent = T().treePick; return; }
      var res = await fetch('/api/workspace/tree?group_folder=' + encodeURIComponent(g), { headers: authHeaders() });
      if (!res.ok) { treeEl.textContent = T().loadFail; return; }
      var data = await res.json();
      function nodeHtml(n, parentPath) {
        parentPath = parentPath || '';
        var fullPath = parentPath ? parentPath + '/' + n.name : n.name;
        if (n.type === 'dir') {
          var inner = (n.children || []).map(function (c) { return nodeHtml(c, fullPath); }).join('');
          return '<details open><summary>' + esc(n.name) + '/</summary><div>' + inner + '</div></details>';
        }
        var url = '/files/' + fullPath.split('/').map(encodeURIComponent).join('/');
        return '<button type="button" class="ws-file-btn" data-ws-url="' + escAttr(url) + '" data-ws-name="' + escAttr(n.name) + '">' +
          '<span class="ws-file-name">' + esc(n.name) + '</span>' + wsFileBadge(n.name) +
          '</button>';
      }
      treeEl.innerHTML = (data.tree || []).map(function (n) { return nodeHtml(n, ''); }).join('') || T().treeEmpty;
    }

    function ensureTrace() {
      if (traceBooted) { startTraceSse(); return; }
      traceBooted = true;
      loadGroups().then(function () {
        loadTrace();
        loadTree();
        startTraceSse();
      });
    }

    // Keep trace SSE alive at all times so chat panel can stream too
    function ensureTraceSseAlways() {
      if (!traceEs) startTraceSse();
    }

    function isWide() { return false; }
    function applyLayout() {
      // Chat is always the main area. Trace is an on-demand drawer.
      if (panelChat) panelChat.classList.remove('hidden-narrow');
      ensureTraceSseAlways();   // keep trace SSE alive for streaming
    }
    function setTab() { /* tabs removed — no-op kept for callers */ }

    /* Trace open/close + activity indicator wired up later in the file. */
    window.matchMedia('(min-width: 981px)').addEventListener('change', applyStoredPanelSizes);
    window.matchMedia('(min-width: 701px)').addEventListener('change', applyStoredPanelSizes);
    window.addEventListener('resize', applyStoredPanelSizes);

    (function bootTabFromUrl() {
      var p = new URLSearchParams(window.location.search);
      if (p.get('tab') === 'trace') currentTab = 'trace';
      applyLayout();
    })();

    document.getElementById('reloadTrace').onclick = function () { loadTrace(); loadTree(); };
    groupSel.onchange = function () { loadTrace(); loadTree(); };
    if (traceStreamCb) {
      traceStreamCb.checked = traceShowStream;
      traceStreamCb.addEventListener('change', function () {
        traceShowStream = !!traceStreamCb.checked;
        try { localStorage.setItem('bioclaw-trace-stream', traceShowStream ? '1' : '0'); } catch (e) {}
        loadTrace();
      });
    }
    // Trace verbosity segmented toggle (Compact / Full)
    var traceModeCompact = document.getElementById('traceModeCompact');
    var traceModeFull = document.getElementById('traceModeFull');
    function applyTraceMode(full) {
      traceShowStream = !!full;
      if (traceStreamCb) traceStreamCb.checked = traceShowStream;
      if (traceModeCompact) {
        traceModeCompact.classList.toggle('is-active', !full);
        traceModeCompact.setAttribute('aria-pressed', String(!full));
      }
      if (traceModeFull) {
        traceModeFull.classList.toggle('is-active', !!full);
        traceModeFull.setAttribute('aria-pressed', String(!!full));
      }
      try { localStorage.setItem('bioclaw-trace-stream', full ? '1' : '0'); } catch (_) {}
      loadTrace();
    }
    if (traceModeCompact) traceModeCompact.addEventListener('click', function () { applyTraceMode(false); });
    if (traceModeFull) traceModeFull.addEventListener('click', function () { applyTraceMode(true); });
    // Sync initial UI state from stored value
    (function () { applyTraceMode(traceShowStream); })();

    // New segmented language toggle (中 / EN). Highlights the current language.
    var langBtnZh = document.getElementById('langBtnZh');
    var langBtnEn = document.getElementById('langBtnEn');
    function syncLangToggle() {
      if (langBtnZh) {
        langBtnZh.classList.toggle('is-active', lang === 'zh');
        langBtnZh.setAttribute('aria-pressed', String(lang === 'zh'));
      }
      if (langBtnEn) {
        langBtnEn.classList.toggle('is-active', lang === 'en');
        langBtnEn.setAttribute('aria-pressed', String(lang === 'en'));
      }
    }
    function pickLang(target) {
      if (target === lang) return;
      applyLang(target);
      syncLangToggle();
      lastSignature = '';
      refreshMessages();
    }
    if (langBtnZh) langBtnZh.addEventListener('click', function () { pickLang('zh'); });
    if (langBtnEn) langBtnEn.addEventListener('click', function () { pickLang('en'); });
    syncLangToggle();
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        applyLang(lang === 'zh' ? 'en' : 'zh');
        syncLangToggle();
        lastSignature = '';
        refreshMessages();
      });
    }

    function currentTheme() {
      var tt = document.documentElement.getAttribute('data-theme') || 'default';
      return THEMES.indexOf(tt) >= 0 ? tt : 'default';
    }

    function syncThemeUi() {
      if (!themeGrid) return;
      var theme = currentTheme();
      themeGrid.querySelectorAll('.theme-swatch').forEach(function (sw) {
        sw.classList.toggle('is-active', sw.getAttribute('data-theme') === theme);
      });
    }

    function setTheme(theme, persist) {
      var t = THEMES.indexOf(theme) >= 0 ? theme : 'default';
      if (t === 'default') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
      if (persist) {
        try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
      }
      syncThemeUi();
    }

    function loadTheme() {
      var saved = null;
      try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
      // Migrate legacy values: 'light' → default, 'dark' → midnight
      if (saved === 'light') saved = 'default';
      if (saved === 'dark') saved = 'midnight';
      setTheme(saved || 'default', false);
    }
    loadTheme();

    if (themeGrid) {
      themeGrid.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('.theme-swatch') : null;
        if (!btn) return;
        setTheme(btn.getAttribute('data-theme') || 'default', true);
      });
    }

    /* ──────── Thread rail (col 1) ────────
       Wide (>=901px): rail is always an inline grid column; ☰ toggles its
         width between var(--rail-w) and 0 via body.rail-collapsed.
       Narrow (<=900px): rail is a fixed overlay drawer; ☰ slides it in/out. */
    var threadRailEl = document.getElementById('threadRail');
    var railBackdrop = document.getElementById('railBackdrop');
    var RAIL_COLLAPSED_KEY = 'bioclaw-rail-collapsed';

    function isNarrow() { return window.matchMedia('(max-width: 900px)').matches; }

    function openThreadRailNarrow() {
      if (threadRailEl) threadRailEl.classList.add('is-open');
      if (railBackdrop) { railBackdrop.classList.add('is-open'); railBackdrop.setAttribute('aria-hidden', 'false'); }
    }
    function closeThreadRailNarrow() {
      if (threadRailEl) threadRailEl.classList.remove('is-open');
      if (railBackdrop) { railBackdrop.classList.remove('is-open'); railBackdrop.setAttribute('aria-hidden', 'true'); }
    }
    function toggleThreadRail() {
      if (isNarrow()) {
        if (threadRailEl && threadRailEl.classList.contains('is-open')) closeThreadRailNarrow();
        else openThreadRailNarrow();
      } else {
        var collapsed = !document.body.classList.contains('rail-collapsed');
        document.body.classList.toggle('rail-collapsed', collapsed);
        try { localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) {}
      }
    }
    // Narrow-screen back-compat aliases used elsewhere
    function closeThreadRail() { closeThreadRailNarrow(); }

    (function loadRailState() {
      var collapsed = false;
      try { collapsed = localStorage.getItem(RAIL_COLLAPSED_KEY) === '1'; } catch (e) {}
      document.body.classList.toggle('rail-collapsed', collapsed);
    })();

    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleThreadRail);
    if (railBackdrop) railBackdrop.addEventListener('click', closeThreadRailNarrow);

    /* ──────── Trace panel (col 3) ────────
       Wide: toggleable inline column via body.trace-open.
       Narrow: slide-in overlay from the right. */
    var panelTraceEl = document.getElementById('panelTrace');
    var TRACE_OPEN_KEY = 'bioclaw-trace-open';

    function scrollTraceToRun(targetTs) {
      if (!timeline || !targetTs) return;
      // Find the task card whose run_ts is the latest one <= targetTs.
      var cards = timeline.querySelectorAll('.task-card[data-run-ts]');
      var match = null;
      for (var i = 0; i < cards.length; i++) {
        var ts = cards[i].getAttribute('data-run-ts') || '';
        if (ts <= targetTs && (!match || ts > (match.getAttribute('data-run-ts') || ''))) {
          match = cards[i];
        }
      }
      if (!match) match = cards[cards.length - 1];   // fallback to most recent
      if (!match) return;
      // Collapse all others, expand the match
      cards.forEach(function (c) { c.removeAttribute('open'); });
      match.setAttribute('open', '');
      // Scroll into view + flash
      match.scrollIntoView({ behavior: 'smooth', block: 'center' });
      match.classList.add('is-highlighted');
      setTimeout(function () { match.classList.remove('is-highlighted'); }, 1600);
    }

    function syncTraceGroupToCurrentChat() {
      // Auto-pick the current chat's workspace folder in the trace group dropdown
      if (!groupSel) return;
      var folder = workspaceFolderForChat(chatJid);
      var hasOption = Array.prototype.some.call(groupSel.options, function (o) { return o.value === folder; });
      if (hasOption && groupSel.value !== folder) {
        groupSel.value = folder;
      }
    }

    function openTracePanel() {
      document.body.classList.add('trace-open');
      if (openTraceBtn) openTraceBtn.classList.remove('has-activity');
      ensureTrace();
      loadGroups().then(function () {
        syncTraceGroupToCurrentChat();
        loadTrace();
        loadTree();
      });
      try { localStorage.setItem(TRACE_OPEN_KEY, '1'); } catch (e) {}
    }
    function closeTracePanel() {
      document.body.classList.remove('trace-open');
      try { localStorage.setItem(TRACE_OPEN_KEY, '0'); } catch (e) {}
    }
    function toggleTracePanel() {
      if (document.body.classList.contains('trace-open')) closeTracePanel();
      else openTracePanel();
    }
    (function loadTraceState() {
      var open = false;
      try { open = localStorage.getItem(TRACE_OPEN_KEY) === '1'; } catch (e) {}
      if (open) document.body.classList.add('trace-open');
    })();
    if (openTraceBtn) openTraceBtn.addEventListener('click', toggleTracePanel);
    if (closeTraceBtn) closeTraceBtn.addEventListener('click', closeTracePanel);

    /* ──────── Drawer file preview (triggered from chat bubble file links) ──────── */
    var drawerPaneTrace = document.getElementById('drawerPaneTrace');
    var drawerPaneFiles = document.getElementById('drawerPaneFiles');
    var filesPreviewEl = document.getElementById('filesPreview');
    var filesBackBtn = document.getElementById('filesBackBtn');
    var filesPaneTitle = document.getElementById('filesPaneTitle');

    function showDrawerTrace() {
      if (drawerPaneTrace) drawerPaneTrace.hidden = false;
      var wsPane = document.getElementById('drawerPaneWorkspace');
      if (wsPane) wsPane.hidden = true;
      if (drawerPaneFiles) { drawerPaneFiles.hidden = true; if (filesPreviewEl) filesPreviewEl.innerHTML = ''; }
      activeProteinViewer = null;
      document.body.classList.remove('drawer-preview');
      document.body.classList.remove('drawer-workspace');
      var tabT = document.getElementById('drawerTabTrace');
      var tabW = document.getElementById('drawerTabWorkspace');
      if (tabT) { tabT.classList.add('is-active'); tabT.setAttribute('aria-selected', 'true'); }
      if (tabW) { tabW.classList.remove('is-active'); tabW.setAttribute('aria-selected', 'false'); }
      var titleEl = document.getElementById('traceDrawerTitle');
      if (titleEl) titleEl.textContent = T().traceTitle || 'Lab Trace';
    }
    function showDrawerPreview(name) {
      if (drawerPaneTrace) drawerPaneTrace.hidden = true;
      var wsPane2 = document.getElementById('drawerPaneWorkspace');
      if (wsPane2) wsPane2.hidden = true;
      document.body.classList.remove('drawer-workspace');
      if (drawerPaneFiles) drawerPaneFiles.hidden = false;
      document.body.classList.add('drawer-preview');
      if (filesPaneTitle) filesPaneTitle.textContent = name || 'Preview';
    }
    if (filesBackBtn) filesBackBtn.addEventListener('click', showDrawerTrace);

    /* ──────── Column resizers (rail | chat | trace) ──────── */
    (function setupColResizers() {
      var unifiedBody = document.getElementById('unifiedBody');
      var rootEl = document.documentElement;
      if (!unifiedBody) return;

      // Restore persisted widths
      try {
        var savedRail = localStorage.getItem('bioclaw-rail-w');
        var savedTrace = localStorage.getItem('bioclaw-trace-w');
        if (savedRail && /^\d+$/.test(savedRail)) rootEl.style.setProperty('--rail-w', savedRail + 'px');
        // Migration: drawer used to default to 560px (too narrow for V2 preview / workspace).
        // If user never dragged it wider than that, clear the saved value to pick up new default.
        if (savedTrace && /^\d+$/.test(savedTrace)) {
          if (parseInt(savedTrace, 10) < 700) {
            try { localStorage.removeItem('bioclaw-trace-w'); } catch (_) {}
          } else {
            rootEl.style.setProperty('--trace-w-user', savedTrace + 'px');
          }
        }
      } catch (_) {}

      function bind(handle, side) {
        if (!handle) return;
        handle.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          var startX = e.clientX;
          var rect = (side === 'rail' ? document.getElementById('threadRail') : document.getElementById('panelTrace')).getBoundingClientRect();
          var startW = rect.width;
          handle.setPointerCapture(e.pointerId);
          unifiedBody.classList.add('is-resizing');
          function onMove(ev) {
            var delta = ev.clientX - startX;
            // Trace handle is on the LEFT edge of the trace panel → invert delta
            var newW = side === 'rail' ? startW + delta : startW - delta;
            newW = Math.max(160, Math.min(window.innerWidth * 0.8, newW));
            if (side === 'rail') rootEl.style.setProperty('--rail-w', newW + 'px');
            else rootEl.style.setProperty('--trace-w-user', newW + 'px');
          }
          function onUp(ev) {
            unifiedBody.classList.remove('is-resizing');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            try {
              if (side === 'rail') localStorage.setItem('bioclaw-rail-w', parseInt(getComputedStyle(rootEl).getPropertyValue('--rail-w'), 10));
              else localStorage.setItem('bioclaw-trace-w', parseInt(getComputedStyle(rootEl).getPropertyValue('--trace-w-user'), 10));
            } catch (_) {}
          }
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
        // Double-click resets
        handle.addEventListener('dblclick', function () {
          if (side === 'rail') {
            rootEl.style.removeProperty('--rail-w');
            try { localStorage.removeItem('bioclaw-rail-w'); } catch (_) {}
          } else {
            rootEl.style.removeProperty('--trace-w-user');
            try { localStorage.removeItem('bioclaw-trace-w'); } catch (_) {}
          }
        });
      }
      bind(document.getElementById('resizerRail'), 'rail');
      bind(document.getElementById('resizerTrace'), 'trace');
    })();

    // Click handler for "preview file" buttons inside trace events
    var panelTraceEl2 = document.getElementById('panelTrace');
    if (panelTraceEl2) {
      panelTraceEl2.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('.pstep-file-btn[data-preview-url]') : null;
        if (!btn) return;
        event.preventDefault();
        var url = btn.getAttribute('data-preview-url');
        var name = btn.getAttribute('data-preview-name') || 'file';
        if (url && window.__bioclawOpenFileInDrawer) window.__bioclawOpenFileInDrawer(url, name);
      });
    }

    /**
     * Open a file in the right drawer's preview pane.
     * url: full URL like /files/chat/<jid>/<rel>
     * name: filename for display
     */
    var THREE_D_EXTS = ['pdb', 'cif', 'mmcif', 'mol2', 'sdf', 'xyz'];
    var THREE_D_FORMAT = { pdb: 'pdb', cif: 'cif', mmcif: 'cif', mol2: 'mol2', sdf: 'sdf', xyz: 'xyz' };

    // i18n strings for the 3D viewer toolbar — looked up at render time AND on language change.
    function viewerI18n() {
      return lang === 'zh' ? {
        loading: '加载结构…',
        loadFail: '加载失败：',
        notLoaded: '3Dmol 未加载，请检查网络',
        labelStyle: '风格',
        labelColor: '配色',
        styleCartoon: '卡通',
        styleStick: '棒状',
        styleSphere: '球状',
        styleLine: '线条',
        styleBallStick: '球棍',
        styleSurface: '表面',
        colorSpectrum: '彩虹',
        colorChain: '按链',
        colorBfactor: 'B 因子',
        colorResidue: '残基',
        colorSingle: '单色',
        btnSpin: '自旋',
        btnBg: '深色',
        btnReset: '重置',
        btnPng: '截图',
        info: function (chains, residues, atoms) {
          return chains + ' 链 · ' + residues + ' 残基 · ' + atoms + ' 原子';
        }
      } : {
        loading: 'Loading structure…',
        loadFail: 'Failed to load: ',
        notLoaded: '3Dmol failed to load — check network',
        labelStyle: 'Style',
        labelColor: 'Color',
        styleCartoon: 'Cartoon',
        styleStick: 'Stick',
        styleSphere: 'Sphere',
        styleLine: 'Line',
        styleBallStick: 'Ball+Stick',
        styleSurface: 'Surface',
        colorSpectrum: 'Spectrum',
        colorChain: 'By chain',
        colorBfactor: 'B-factor',
        colorResidue: 'By residue',
        colorSingle: 'Mono',
        btnSpin: 'Spin',
        btnBg: 'Dark',
        btnReset: 'Reset',
        btnPng: 'PNG',
        info: function (chains, residues, atoms) {
          return chains + ' chains · ' + residues + ' residues · ' + atoms + ' atoms';
        }
      };
    }

    // Active viewer context — used by applyLang() to refresh button labels on language switch.
    var activeProteinViewer = null;

    function applyViewerStyle(viewer, styleId, colorId) {
      if (!viewer || !window.$3Dmol) return;
      viewer.removeAllSurfaces();

      // Cartoon and non-cartoon styles use slightly different option keys.
      // Cartoon supports `color: 'spectrum'` for N→C rainbow, but uses `colorscheme`
      // for chain/residue/B-factor. Non-cartoon (stick/sphere/line) always uses `colorscheme`
      // or solid `color`.
      var cartoonOpts, atomOpts;
      if (colorId === 'bfactor') {
        var bScheme = { prop: 'b', gradient: 'rwb', min: 0, max: 80 };
        cartoonOpts = { colorscheme: bScheme };
        atomOpts = { colorscheme: bScheme };
      } else if (colorId === 'chain') {
        cartoonOpts = { colorscheme: 'chain' };
        atomOpts = { colorscheme: 'chain' };
      } else if (colorId === 'residue') {
        cartoonOpts = { colorscheme: 'amino' };
        atomOpts = { colorscheme: 'amino' };
      } else if (colorId === 'single') {
        cartoonOpts = { color: '#7c8aa3' };
        atomOpts = { color: '#7c8aa3' };
      } else {
        // spectrum
        cartoonOpts = { color: 'spectrum' };
        atomOpts = { colorscheme: 'cyanCarbon' };
      }

      switch (styleId) {
        case 'cartoon':
          viewer.setStyle({}, { cartoon: cartoonOpts });
          break;
        case 'stick':
          viewer.setStyle({}, { stick: Object.assign({ radius: 0.2 }, atomOpts) });
          break;
        case 'sphere':
          viewer.setStyle({}, { sphere: Object.assign({ scale: 0.32 }, atomOpts) });
          break;
        case 'line':
          viewer.setStyle({}, { line: Object.assign({ linewidth: 1.5 }, atomOpts) });
          break;
        case 'ballstick':
          viewer.setStyle({}, { stick: Object.assign({ radius: 0.13 }, atomOpts), sphere: Object.assign({ scale: 0.22 }, atomOpts) });
          break;
        case 'surface':
          viewer.setStyle({}, { cartoon: cartoonOpts });
          viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.65, color: 'white' });
          break;
        default:
          viewer.setStyle({}, { cartoon: cartoonOpts });
      }
    }

    function buildViewerToolbar(ctx) {
      var t = viewerI18n();
      var tb = ctx.toolbarEl;
      tb.innerHTML = '';

      // Row: Style selector
      var rowStyle = document.createElement('div');
      rowStyle.className = 'files-3d-toolbar-row';
      var labelStyle = document.createElement('span');
      labelStyle.className = 'files-3d-toolbar-label';
      labelStyle.dataset.i18n = 'labelStyle';
      labelStyle.textContent = t.labelStyle;
      var selStyle = document.createElement('select');
      selStyle.className = 'files-3d-select';
      [
        ['cartoon', t.styleCartoon],
        ['stick', t.styleStick],
        ['sphere', t.styleSphere],
        ['line', t.styleLine],
        ['ballstick', t.styleBallStick],
        ['surface', t.styleSurface],
      ].forEach(function (pair) {
        var opt = document.createElement('option');
        opt.value = pair[0];
        opt.textContent = pair[1];
        opt.dataset.i18n = 'style' + pair[0].charAt(0).toUpperCase() + pair[0].slice(1);
        if (pair[0] === ctx.styleId) opt.selected = true;
        selStyle.appendChild(opt);
      });
      selStyle.addEventListener('change', function () {
        ctx.styleId = selStyle.value;
        if (ctx.viewer) { applyViewerStyle(ctx.viewer, ctx.styleId, ctx.colorId); ctx.viewer.render(); }
      });
      rowStyle.appendChild(labelStyle);
      rowStyle.appendChild(selStyle);
      tb.appendChild(rowStyle);

      // Row: Color selector
      var rowColor = document.createElement('div');
      rowColor.className = 'files-3d-toolbar-row';
      var labelColor = document.createElement('span');
      labelColor.className = 'files-3d-toolbar-label';
      labelColor.dataset.i18n = 'labelColor';
      labelColor.textContent = t.labelColor;
      var selColor = document.createElement('select');
      selColor.className = 'files-3d-select';
      [
        ['spectrum', t.colorSpectrum],
        ['chain', t.colorChain],
        ['bfactor', t.colorBfactor],
        ['residue', t.colorResidue],
        ['single', t.colorSingle],
      ].forEach(function (pair) {
        var opt = document.createElement('option');
        opt.value = pair[0];
        opt.textContent = pair[1];
        opt.dataset.i18n = 'color' + pair[0].charAt(0).toUpperCase() + pair[0].slice(1);
        if (pair[0] === ctx.colorId) opt.selected = true;
        selColor.appendChild(opt);
      });
      selColor.addEventListener('change', function () {
        ctx.colorId = selColor.value;
        if (ctx.viewer) { applyViewerStyle(ctx.viewer, ctx.styleId, ctx.colorId); ctx.viewer.render(); }
      });
      rowColor.appendChild(labelColor);
      rowColor.appendChild(selColor);
      tb.appendChild(rowColor);

      // Row: action icon buttons (spin / dark bg / reset / png)
      var rowBtns = document.createElement('div');
      rowBtns.className = 'files-3d-icon-btns';

      function makeBtn(id, labelKey, label, onClick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'files-3d-icon-btn';
        b.dataset.i18n = labelKey;
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
      }

      var spinBtn = makeBtn('spin', 'btnSpin', t.btnSpin, function () {
        if (!ctx.viewer) return;
        ctx.spinning = !ctx.spinning;
        ctx.viewer.spin(ctx.spinning ? 'y' : false);
        spinBtn.classList.toggle('is-active', ctx.spinning);
      });
      if (ctx.spinning) spinBtn.classList.add('is-active');
      rowBtns.appendChild(spinBtn);

      var bgBtn = makeBtn('bg', 'btnBg', t.btnBg, function () {
        if (!ctx.viewer) return;
        ctx.darkBg = !ctx.darkBg;
        ctx.viewer.setBackgroundColor(ctx.darkBg ? 'black' : 'white');
        bgBtn.classList.toggle('is-active', ctx.darkBg);
        // Icon toolbar gets harder to read on dark bg; bump its background opacity
        tb.style.background = ctx.darkBg ? 'rgba(20,22,28,0.88)' : 'rgba(255,255,255,0.93)';
        tb.style.color = ctx.darkBg ? '#e5e7eb' : '';
      });
      if (ctx.darkBg) bgBtn.classList.add('is-active');
      rowBtns.appendChild(bgBtn);

      var resetBtn = makeBtn('reset', 'btnReset', t.btnReset, function () {
        if (!ctx.viewer) return;
        ctx.viewer.zoomTo();
        ctx.viewer.render();
      });
      rowBtns.appendChild(resetBtn);

      var pngBtn = makeBtn('png', 'btnPng', t.btnPng, function () {
        if (!ctx.viewer || typeof ctx.viewer.pngURI !== 'function') return;
        var dataUri = ctx.viewer.pngURI();
        var a = document.createElement('a');
        a.href = dataUri;
        a.download = (ctx.title || 'structure') + '.png';
        a.click();
      });
      rowBtns.appendChild(pngBtn);

      tb.appendChild(rowBtns);

      // Info chip (chain/residue/atom counts) — only after model loaded
      if (ctx.info) {
        var info = document.createElement('div');
        info.className = 'files-3d-info';
        info.dataset.i18n = 'info';
        info.textContent = t.info(ctx.info.chains, ctx.info.residues, ctx.info.atoms);
        tb.appendChild(info);
      }
    }

    /**
     * Render a 3D molecular structure into `host` (a `.files-preview` element with the actions bar
     * already appended). Loads structure from `url`, picks format from `ext`.
     */
    function renderProteinViewer(host, url, ext, title) {
      var body = document.createElement('div');
      body.className = 'files-preview-body files-preview-3d';
      host.appendChild(body);

      var loading = document.createElement('div');
      loading.className = 'files-3d-loading';
      loading.textContent = viewerI18n().loading;
      body.appendChild(loading);

      if (typeof window.$3Dmol === 'undefined') {
        loading.textContent = viewerI18n().notLoaded;
        return;
      }

      var viewerDiv = document.createElement('div');
      viewerDiv.className = 'files-3d-viewer';
      body.appendChild(viewerDiv);

      var toolbarEl = document.createElement('div');
      toolbarEl.className = 'files-3d-toolbar';
      body.appendChild(toolbarEl);

      var ctx = {
        viewer: null,
        viewerDiv: viewerDiv,
        toolbarEl: toolbarEl,
        styleId: 'cartoon',
        colorId: 'spectrum',
        spinning: false,
        darkBg: false,
        title: title || '',
        info: null,
      };
      activeProteinViewer = ctx;
      buildViewerToolbar(ctx);

      var format = THREE_D_FORMAT[ext] || 'pdb';
      // Try to derive a PDB ID from the filename (e.g. "1CRN.pdb" → "1CRN") so we can
      // auto-fall-back to RCSB when the local file is empty / fake.
      var derivedPdbId = (function () {
        var base = (title || '').replace(/\.[^.]+$/, '');
        return /^[A-Za-z0-9]{4}$/.test(base) ? base.toUpperCase() : null;
      })();

      function renderModel(text, source) {
        ctx.viewer = window.$3Dmol.createViewer(viewerDiv, { backgroundColor: 'white' });
        ctx.viewer.addModel(text, format);
        applyViewerStyle(ctx.viewer, ctx.styleId, ctx.colorId);
        ctx.viewer.zoomTo();
        ctx.viewer.render();
        try {
          var atoms = ctx.viewer.selectedAtoms({});
          var atomCount = atoms.length;
          var chainSet = {}, resSet = {};
          atoms.forEach(function (a) {
            if (a.chain) chainSet[a.chain] = 1;
            resSet[a.chain + ':' + a.resi] = 1;
          });
          ctx.info = { chains: Object.keys(chainSet).length, residues: Object.keys(resSet).length, atoms: atomCount, source: source };
          return atomCount;
        } catch (_) { return 0; }
      }

      function showFallback(reason) {
        // Display a banner-style overlay over the (possibly partial) viewer with an
        // optional "Load real X from RCSB" button. The overlay is dismissible so users
        // can still inspect the partial structure if they want.
        var msg;
        if (reason === 'empty') {
          msg = lang === 'zh'
            ? '本地文件没有原子坐标（agent 可能写了 PDB 摘要 stub，没真正下载）'
            : 'The local file has no atom coordinates (the agent likely wrote a PDB summary stub).';
        } else if (reason === 'no-ss') {
          msg = lang === 'zh'
            ? '本地文件缺少二级结构记录（HELIX/SHEET），cartoon 视图会画不出 ribbon。建议从 RCSB 拉真版本。'
            : 'The local file is missing secondary-structure records (HELIX/SHEET); cartoon ribbons cannot render. Try the real RCSB version.';
        } else if (reason === 'too-few-atoms') {
          msg = lang === 'zh'
            ? '本地文件只有少量原子坐标，可能是 agent 编造的不完整 PDB。建议从 RCSB 拉真版本。'
            : 'The local file has too few atoms — likely a fabricated/incomplete PDB. Try the real RCSB version.';
        } else {
          return;
        }
        var btnLabel = derivedPdbId
          ? (lang === 'zh' ? '从 RCSB 加载真实 ' + derivedPdbId + ' 结构' : 'Load real ' + derivedPdbId + ' from RCSB')
          : '';
        var dismissLabel = lang === 'zh' ? '忽略' : 'Dismiss';
        var html = '<div class="files-3d-empty"><p>' + esc(msg) + '</p><div class="files-3d-empty-actions">';
        if (derivedPdbId) {
          html += '<button type="button" class="files-3d-fetch-rcsb" data-pdb="' + escAttr(derivedPdbId) + '">' + esc(btnLabel) + '</button>';
        }
        html += '<button type="button" class="files-3d-dismiss">' + esc(dismissLabel) + '</button>';
        html += '</div></div>';
        body.insertAdjacentHTML('beforeend', html);
        var fetchBtn = body.querySelector('.files-3d-fetch-rcsb');
        if (fetchBtn) {
          fetchBtn.addEventListener('click', function () {
            if (window.__bioclawLoadPdbById) window.__bioclawLoadPdbById(derivedPdbId);
          });
        }
        var dismissBtn = body.querySelector('.files-3d-dismiss');
        if (dismissBtn) {
          dismissBtn.addEventListener('click', function () {
            var box = body.querySelector('.files-3d-empty');
            if (box) box.remove();
          });
        }
      }

      fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (text) {
          loading.remove();
          // Heuristics for PDB files: warn if the file looks fabricated/incomplete
          var ssCount = 0;
          if (format === 'pdb') {
            var lines = text.split('\n');
            for (var i = 0; i < lines.length; i++) {
              var l = lines[i];
              if (l.indexOf('HELIX') === 0 || l.indexOf('SHEET') === 0) ssCount++;
            }
          }
          var count = renderModel(text, 'local');
          buildViewerToolbar(ctx);
          if (count === 0) {
            showFallback('empty');
          } else if (format === 'pdb') {
            // Cartoon needs HELIX/SHEET records to draw ribbons. If missing, even
            // a real-looking PDB will render as just a thin trace (or nothing).
            if (ssCount === 0) showFallback('no-ss');
            else if (count < 50) showFallback('too-few-atoms');
          }
        })
        .catch(function (e) {
          loading.textContent = viewerI18n().loadFail + (e && e.message || e);
        });
    }

    // Refresh the active viewer's toolbar labels when language changes
    function refreshActiveProteinViewerLang() {
      if (activeProteinViewer && activeProteinViewer.toolbarEl) {
        buildViewerToolbar(activeProteinViewer);
      }
    }
    window.__bioclawRefreshProteinViewerLang = refreshActiveProteinViewerLang;

    /**
     * Load a structure directly from RCSB by PDB ID (e.g. "1CRN").
     * Opens the drawer's preview pane and renders 3D viewer.
     */
    function loadPdbById(rawId) {
      if (!rawId) return;
      var id = String(rawId).trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(id)) {
        alert(lang === 'zh' ? 'PDB ID 应为 4 位字母 / 数字（如 1CRN）' : 'PDB ID must be 4 alphanumeric characters (e.g. 1CRN)');
        return;
      }
      if (!filesPreviewEl) return;
      if (!document.body.classList.contains('trace-open')) openTracePanel();
      showDrawerPreview(id + '.pdb · RCSB');
      var url = 'https://files.rcsb.org/view/' + id + '.pdb';
      var rcsbUrl = 'https://www.rcsb.org/structure/' + id;
      var actions =
        '<div class="files-preview-actions-bar">' +
          '<span class="files-preview-path">PDB · ' + esc(id) + '</span>' +
          '<a class="file-button" href="' + escAttr(rcsbUrl) + '" target="_blank" rel="noreferrer">RCSB</a>' +
          '<a class="file-button" href="' + escAttr(url) + '" target="_blank" rel="noreferrer">' + esc(T().openFile || 'Open') + '</a>' +
          '<a class="file-button" href="' + escAttr(url) + '" download>' + esc(T().download || 'Download') + '</a>' +
        '</div>';
      filesPreviewEl.innerHTML = actions;
      renderProteinViewer(filesPreviewEl, url, 'pdb');
    }
    window.__bioclawLoadPdbById = loadPdbById;

    /* ──────── Drawer tabs: Trace / Workspace ──────── */
    var drawerPaneWorkspace = document.getElementById('drawerPaneWorkspace');
    var drawerTabTrace = document.getElementById('drawerTabTrace');
    var drawerTabWorkspace = document.getElementById('drawerTabWorkspace');

    function showDrawerWorkspace() {
      if (drawerPaneTrace) drawerPaneTrace.hidden = true;
      if (drawerPaneWorkspace) drawerPaneWorkspace.hidden = false;
      if (drawerPaneFiles) { drawerPaneFiles.hidden = true; if (filesPreviewEl) filesPreviewEl.innerHTML = ''; }
      activeProteinViewer = null;
      document.body.classList.remove('drawer-preview');
      document.body.classList.add('drawer-workspace');
      if (drawerTabTrace) { drawerTabTrace.classList.remove('is-active'); drawerTabTrace.setAttribute('aria-selected', 'false'); }
      if (drawerTabWorkspace) { drawerTabWorkspace.classList.add('is-active'); drawerTabWorkspace.setAttribute('aria-selected', 'true'); }
    }
    if (drawerTabTrace) drawerTabTrace.addEventListener('click', showDrawerTrace);
    if (drawerTabWorkspace) drawerTabWorkspace.addEventListener('click', showDrawerWorkspace);

    /* ──────── Workspace tree click: open files in preview drawer ──────── */
    if (drawerPaneWorkspace) {
      drawerPaneWorkspace.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('.ws-file-btn') : null;
        if (!btn) return;
        event.preventDefault();
        var url = btn.getAttribute('data-ws-url');
        var name = btn.getAttribute('data-ws-name') || 'file';
        if (url && window.__bioclawOpenFileInDrawer) {
          window.__bioclawOpenFileInDrawer(url, name);
        }
      });
    }

    /* ──────── Workspace 3D loader: PDB ID input + chip shortcuts ──────── */
    var ws3dForm = document.getElementById('ws3dLoaderForm');
    var ws3dInput = document.getElementById('ws3dInput');
    if (ws3dForm) {
      ws3dForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (ws3dInput && ws3dInput.value) loadPdbById(ws3dInput.value);
      });
    }
    if (drawerPaneWorkspace) {
      drawerPaneWorkspace.addEventListener('click', function (event) {
        var chip = event.target && event.target.closest ? event.target.closest('.workspace-3d-chip') : null;
        if (!chip) return;
        event.preventDefault();
        var pdbId = chip.getAttribute('data-pdb');
        if (pdbId) {
          if (ws3dInput) ws3dInput.value = pdbId;
          loadPdbById(pdbId);
        }
      });
    }

    async function openFileInDrawer(url, name) {
      if (!filesPreviewEl) return;
      // Open the right drawer if not already open
      if (!document.body.classList.contains('trace-open')) openTracePanel();
      showDrawerPreview(name);
      var ext = (name.split('.').pop() || '').toLowerCase();
      var is3D = THREE_D_EXTS.indexOf(ext) >= 0;
      var isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].indexOf(ext) >= 0;
      var isPdf = ext === 'pdf';
      var isText = ['py', 'js', 'ts', 'sh', 'json', 'yaml', 'yml', 'css', 'html', 'md', 'txt', 'log', 'csv', 'tsv', 'fasta', 'fa', 'fastq', 'fq', 'gff', 'gtf', 'bed', 'vcf'].indexOf(ext) >= 0;
      var actions =
        '<div class="files-preview-actions-bar">' +
          '<span class="files-preview-path" title="' + escAttr(name) + '">' + esc(name) + '</span>' +
          '<a class="file-button" href="' + escAttr(url) + '" target="_blank" rel="noreferrer">' + esc(T().openFile || 'Open') + '</a>' +
          '<a class="file-button" href="' + escAttr(url) + '" download>' + esc(T().download || 'Download') + '</a>' +
        '</div>';
      if (is3D) {
        filesPreviewEl.innerHTML = actions;
        renderProteinViewer(filesPreviewEl, url, ext);
        return;
      }
      if (isImage) {
        filesPreviewEl.innerHTML = actions + '<div class="files-preview-body files-preview-image"><img src="' + escAttr(url) + '" alt="' + escAttr(name) + '"></div>';
        return;
      }
      if (isPdf) {
        filesPreviewEl.innerHTML = actions + '<div class="files-preview-body"><iframe src="' + escAttr(url) + '"></iframe></div>';
        return;
      }
      if (isText) {
        filesPreviewEl.innerHTML = actions + '<div class="files-preview-body"><pre class="files-preview-code">Loading…</pre></div>';
        try {
          var res = await fetch(url);
          if (!res.ok) {
            filesPreviewEl.querySelector('.files-preview-code').textContent = 'Failed to load (' + res.status + ')';
            return;
          }
          var text = await res.text();
          if (text.length > 500000) text = text.slice(0, 500000) + '\n\n… (truncated)';
          var pre = filesPreviewEl.querySelector('.files-preview-code');
          if (pre) pre.textContent = text;
        } catch (e) {
          var pre2 = filesPreviewEl.querySelector('.files-preview-code');
          if (pre2) pre2.textContent = 'Error: ' + (e && e.message || e);
        }
        return;
      }
      filesPreviewEl.innerHTML = actions + '<div class="files-preview-body"><div class="files-preview-empty">Binary file — use Open or Download above.</div></div>';
    }
    // Expose globally so other handlers can trigger it
    window.__bioclawOpenFileInDrawer = openFileInDrawer;

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (isNarrow() && threadRailEl && threadRailEl.classList.contains('is-open')) closeThreadRailNarrow();
      else if (isNarrow() && document.body.classList.contains('trace-open')) closeTracePanel();
    });

    /* ──────── Streaming bubble + work-status strip ──────── */

    var streamingBubble = null;
    var workStartTime = null;
    var workTimerHandle = null;
    var lastTraceTickAt = 0;
    var traceTickPending = false;
    // Once the final assistant message has rendered we lock the streaming
    // bubble out until the user sends another message, so late-arriving
    // trace events can't spawn a duplicate bubble.
    var streamingLocked = false;

    function scrollChatToBottom() {
      if (messagesEl) {
        // Use rAF so we scroll after layout settles
        requestAnimationFrame(function () { messagesEl.scrollTop = messagesEl.scrollHeight; });
      }
    }

    function ensureStreamingBubble() {
      if (streamingLocked) return null;
      if (streamingBubble && streamingBubble.parentNode) return streamingBubble;
      var t = T();
      var el = document.createElement('article');
      el.className = 'bubble-row bot streaming-pending';
      el.setAttribute('data-streaming', '1');
      el.innerHTML =
        '<div class="bubble-avatar" aria-hidden="true">B</div>' +
        '<div class="bubble bot is-streaming">' +
          '<div class="meta">' +
            '<span class="badge">' + esc(t.roleAssistant) + '</span>' +
            esc(assistantName) +
            '<span class="thinking-pill" data-thinking-pill="1">' +
              '<span class="thinking-pill-spinner"></span>' +
              '<span class="thinking-pill-label">' + esc(t.workThinking) + '</span>' +
            '</span>' +
            '<button type="button" class="trace-jump-btn" data-trace-jump="1">' + esc(t.viewTrace || '查看追踪 →') + '</button>' +
          '</div>' +
          '<div class="content"></div>' +
        '</div>';
      messagesEl.appendChild(el);
      streamingBubble = el;
      scrollChatToBottom();
      return el;
    }

    function clearStreamingBubble() {
      // Belt-and-braces: remove any DOM node marked as streaming, not just our variable
      var all = messagesEl ? messagesEl.querySelectorAll('[data-streaming="1"]') : [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].parentNode) all[i].parentNode.removeChild(all[i]);
      }
      streamingBubble = null;
      lastStepsSig = '';
      lastStreamText = '';
    }

    var lastStreamText = '';
    function updateStreamingBubble(text) {
      var el = ensureStreamingBubble();
      if (!el || !text) return;
      if (text === lastStreamText) return;   // dedupe (kills flicker)
      lastStreamText = text;
      var content = el.querySelector('.content');
      if (content) content.innerHTML = markdownToSafeHtml(text);
      scrollChatToBottom();
    }

    function truncateText(s, max) {
      s = String(s || '');
      return s.length > max ? s.slice(0, max) + '…' : s;
    }

    function stepCardHtml(step) {
      var kind = step.kind;       // 'thinking' | 'tool' | 'ipc' | 'spawn' | 'err'
      var icon = '·';
      if (kind === 'thinking') icon = '💭';
      else if (kind === 'tool') icon = '⚙';
      else if (kind === 'ipc') icon = '↗';
      else if (kind === 'spawn') icon = '▶';
      else if (kind === 'err') icon = '!';
      var label = esc(step.label || '');
      var detail = step.detail ? '<div class="inline-step-detail">' + esc(truncateText(step.detail, 280)) + '</div>' : '';
      return '<div class="inline-step inline-step-' + kind + '">' +
        '<span class="inline-step-icon" aria-hidden="true">' + icon + '</span>' +
        '<div class="inline-step-body"><div class="inline-step-label">' + label + '</div>' + detail + '</div>' +
      '</div>';
    }

    var lastStepsSig = '';
    function updateStreamingSteps(steps, labelOverride) {
      if (!steps || !steps.length) return;
      var el = ensureStreamingBubble();
      if (!el) return;
      var sig = String(steps.length) + '|' + steps.map(function (s) {
        return (s.kind || '') + ':' + (s.label || '') + ':' + (s.detail || '').length;
      }).join(';');
      var labelEl = el.querySelector('.inline-steps-label');
      if (labelEl && labelOverride && labelEl.textContent !== labelOverride) {
        labelEl.textContent = labelOverride;
      }
      if (sig === lastStepsSig) return;   // unchanged → skip DOM rebuild (kills flicker)
      lastStepsSig = sig;
      var list = el.querySelector('.inline-steps-list');
      var count = el.querySelector('.inline-steps-count');
      if (list) list.innerHTML = steps.map(stepCardHtml).join('');
      if (count) count.textContent = ' · ' + steps.length;
      scrollChatToBottom();
    }

    /*
     * Finalize the streaming bubble — turn it into the permanent final bubble.
     * Keeps inline steps (collapsed), removes streaming class, and tags the DOM
     * node with the bot message's timestamp so render() knows to skip that
     * message when re-building the list (avoids duplicates).
     */
    function finalizeStreamingBubble(msgTimestamp) {
      if (!streamingBubble) return;
      var bubble = streamingBubble.querySelector('.bubble');
      if (bubble) bubble.classList.remove('is-streaming');
      // Replace the thinking-pill (spinner + "thinking") with a quiet "view trace" pill
      var pill = streamingBubble.querySelector('[data-thinking-pill]');
      if (pill) {
        pill.classList.add('is-done');
        pill.innerHTML = '<span class="thinking-pill-label">' + esc(T().thoughtsDone) + '</span>';
      }
      streamingBubble.removeAttribute('data-streaming');  // no longer live
      if (msgTimestamp) {
        streamingBubble.setAttribute('data-msg-ts', msgTimestamp);
        streamingBubble.setAttribute('data-row-ts', msgTimestamp);
      }
      streamingBubble = null;
    }

    function startWorkStrip(label, detail) {
      if (!workStrip) return;
      workStrip.classList.remove('is-error');
      workStrip.classList.add('is-active');
      if (workStripLabel) workStripLabel.textContent = label || T().workThinking;
      if (workStripDetail) workStripDetail.textContent = detail || '';
      workStartTime = Date.now();
      if (workTimerHandle) clearInterval(workTimerHandle);
      workTimerHandle = setInterval(function () {
        if (workStripTime) {
          var s = Math.round((Date.now() - workStartTime) / 1000);
          workStripTime.textContent = s + 's';
        }
      }, 1000);
      if (workStripTime) workStripTime.textContent = '0s';
    }

    function updateWorkStrip(label, detail) {
      if (!workStrip || !workStrip.classList.contains('is-active')) return;
      if (label != null && workStripLabel) workStripLabel.textContent = label;
      if (detail != null && workStripDetail) workStripDetail.textContent = detail;
    }

    function stopWorkStrip(opts) {
      if (!workStrip) return;
      if (workTimerHandle) { clearInterval(workTimerHandle); workTimerHandle = null; }
      if (opts && opts.error) {
        workStrip.classList.add('is-error');
        if (workStripLabel) workStripLabel.textContent = T().workError;
        if (workStripDetail && opts.detail) workStripDetail.textContent = opts.detail;
        setTimeout(function () { workStrip.classList.remove('is-active', 'is-error'); }, 4500);
      } else {
        setTimeout(function () { workStrip.classList.remove('is-active'); }, 800);
      }
    }

    function workspaceFolderForChat(jid) {
      var t = threads.find(function (x) { return x.chatJid === jid; });
      if (t && t.workspaceFolder) return t.workspaceFolder;
      // Fallback: derive workspace folder from chatJid pattern (thread-XXX@local.web → thread-XXX)
      // This matters for fresh threads not yet in the threads list.
      if (typeof jid === 'string') {
        var atIdx = jid.indexOf('@');
        var prefix = atIdx > 0 ? jid.slice(0, atIdx) : jid;
        if (prefix && prefix !== 'local-web') return prefix;
      }
      return 'local-web';
    }

    async function processTraceTick() {
      // Throttle to avoid hammering the API on bursty stream_output events
      var now = Date.now();
      if (now - lastTraceTickAt < 120) {
        if (traceTickPending) return;
        traceTickPending = true;
        setTimeout(function () { traceTickPending = false; processTraceTick(); }, 130);
        return;
      }
      lastTraceTickAt = now;
      try {
        var url = '/api/trace/list?limit=80&group_folder=' + encodeURIComponent(workspaceFolderForChat(chatJid));
        var res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) return;
        var data = await res.json();
        var events = (data.events || []).slice();
        if (!events.length) {
          // Don't clear the streaming bubble on empty events — trace data may
          // simply not have arrived yet. Only stop work-strip after a grace period.
          return;
        }
        events.sort(function (a, b) { return (a.id || 0) - (b.id || 0); });

        // Walk forwards to find current run state.
        var inRun = false;
        var lastTool = null;
        var lastPreview = '';
        var hadError = false;
        var steps = [];    // accumulated inline steps for current run
        var lastEventKind = '';   // 'stream' | 'tool' | 'ipc' | 'thinking' | ''

        events.forEach(function (e) {
          var p = null;
          try { p = e.payload ? JSON.parse(e.payload) : null; } catch (_) { p = null; }
          if (e.type === 'run_start' || e.type === 'agent_query_start' || e.type === 'container_spawn') {
            inRun = true; lastTool = null; lastPreview = ''; hadError = false; steps = []; lastEventKind = '';
            if (e.type === 'container_spawn' && p) {
              steps.push({ kind: 'spawn', label: 'Container started', detail: p.containerName || '' });
            }
          } else if (e.type === 'agent_thinking' && p) {
            steps.push({ kind: 'thinking', label: 'Thinking', detail: p.text || '' });
            lastEventKind = 'thinking';
          } else if (e.type === 'agent_tool_use' && p) {
            lastTool = p.toolName || lastTool;
            var toolInput = p.toolInput;
            var detail = '';
            if (typeof toolInput === 'string') {
              detail = toolInput;
            } else if (toolInput && typeof toolInput === 'object') {
              try { detail = JSON.stringify(toolInput); } catch (_) {}
            }
            steps.push({ kind: 'tool', label: String(p.toolName || 'Tool'), detail: detail });
            lastPreview = '';   // tool kicks in → reset preview so we don't keep the old one stuck
            lastEventKind = 'tool';
          } else if (e.type === 'ipc_send' && p) {
            steps.push({ kind: 'ipc', label: 'IPC', detail: p.preview || p.caption || p.filePath || '' });
            lastEventKind = 'ipc';
          } else if (e.type === 'stream_output' && p) {
            if (p.preview) lastPreview = p.preview;
            lastEventKind = 'stream';
          } else if (e.type === 'run_end') {
            inRun = false;
          } else if (e.type === 'run_error') {
            inRun = false; hadError = true;
            if (p) steps.push({ kind: 'err', label: 'Error', detail: p.message || '' });
          }
        });

        if (inRun) {
          var labelText = lastTool ? (T().workRunning + ' · ' + lastTool) : T().workThinking;
          if (!workStrip.classList.contains('is-active')) {
            startWorkStrip(lastTool ? T().workRunning : T().workThinking, lastTool || '');
          } else if (lastTool) {
            updateWorkStrip(T().workRunning, lastTool);
          } else {
            updateWorkStrip(T().workThinking, '');
          }
          ensureStreamingBubble();
          // Update the thinking-pill with current activity (no inline step list)
          if (streamingBubble) {
            var pillLabel = streamingBubble.querySelector('.thinking-pill-label');
            if (pillLabel) pillLabel.textContent = labelText;
          }
          // Decide what to show in the bubble:
          //  - If a tool/thinking step just happened (steps exist but no fresh stream),
          //    show a compact step summary so the user knows what's happening.
          //  - If the agent is currently streaming text (lastEventKind === 'stream'),
          //    show the live partial response — that's the answer being typed out.
          if (streamingBubble) {
            var contentEl = streamingBubble.querySelector('.content');
            if (contentEl) {
              var html = '';
              // Process steps strip — render each step as a one-line natural-language task.
              // We PAIR a "thinking" step with the next "tool" step: the agent's own
              // reasoning is the most accurate human-friendly description of what's
              // about to happen ("Let me search PubMed for Stella-Blimp1" + WebFetch
              // call → just show the thinking sentence). This avoids a second LLM call.
              if (steps.length) {
                // Pair thinking with the next tool — but only to DROP the redundant
                // thinking step. The tool description itself comes from rule-based
                // humanizeStep (LLM thinking text is often too pessimistic).
                var paired = pairThinkingWithTool(steps);
                var stepCards = paired.slice(-6).map(function (s) {
                  if (s.kind === 'thinking') {
                    return '<div class="ss-step ss-think"><span class="ss-icon">💭</span><span class="ss-text">' + esc(lang === 'zh' ? '思考中…' : 'Thinking…') + '</span></div>';
                  }
                  if (s.kind === 'tool') {
                    var toolSummary = humanizeStep('tool', s.label, s.detail, null) || s.label;
                    return '<div class="ss-step ss-tool"><span class="ss-icon">⚙</span><span class="ss-text">' + esc(toolSummary) + '</span></div>';
                  }
                  if (s.kind === 'spawn') return '<div class="ss-step ss-spawn"><span class="ss-icon">▶</span><span class="ss-text">Container started</span></div>';
                  if (s.kind === 'ipc') return '<div class="ss-step ss-ipc"><span class="ss-icon">↗</span><span class="ss-text">Sent to chat</span></div>';
                  return '<div class="ss-step"><span class="ss-icon">·</span><span class="ss-text">' + esc(truncateText(s.detail || s.label, 100)) + '</span></div>';
                }).join('');
                html += '<details class="streaming-process" open>' +
                  '<summary><span class="streaming-process-label">Process</span><span class="streaming-process-count">' + steps.length + ' step' + (steps.length === 1 ? '' : 's') + '</span></summary>' +
                  '<div class="streaming-process-body">' + stepCards + '</div>' +
                '</details>';
              }
              // Answer area — what the user is here to read; clearly separated and styled like a real bubble
              if (lastEventKind === 'stream' && lastPreview) {
                html += '<div class="streaming-answer"><div class="streaming-answer-label">Answer</div><div class="streaming-answer-body">' + markdownToSafeHtml(lastPreview) + '</div></div>';
              }
              if (html && contentEl.innerHTML !== html) {
                contentEl.innerHTML = html;
                scrollChatToBottom();
              }
            }
          }
          // Hint that trace has fresh content if user hasn't opened it
          if (openTraceBtn && !document.body.classList.contains('trace-open')) {
            openTraceBtn.classList.add('has-activity');
          }
        } else {
          if (hadError) {
            stopWorkStrip({ error: true, detail: lastTool || '' });
          } else {
            stopWorkStrip();
          }
          // Run is over per the trace, but the final message may not be in the
          // DB yet (race between run_end recording and sendToChannel). Don't
          // touch the streaming bubble here — let the chat SSE trigger render()
          // when the message actually arrives, and render() will finalize the
          // bubble in-place (lines ~2005-2037). This avoids the "bubble
          // disappears, full answer pops in later" flicker.
          await refreshMessages();
          // Refresh the workspace tree so any new files the agent saved show up
          // (e.g. a downloaded .pdb appears in the Workspace tab without manual reload)
          try { if (typeof loadTree === 'function') loadTree(); } catch (_) {}
        }
      } catch (e) {}
    }

    /* ──────── Welcome hero (empty state) ──────── */

    var welcomeHeroEl = null;
    function renderWelcomeHero() {
      var t = T();
      welcomeHeroEl = document.createElement('div');
      welcomeHeroEl.className = 'welcome-hero';
      welcomeHeroEl.innerHTML =
        '<img class="welcome-mark welcome-mark-img" src="/favicon.jpg" alt="BioClaw" />' +
        '<h1 class="welcome-title">' + esc(t.welcomeTitle) + '</h1>' +
        '<p class="welcome-sub">' + esc(t.welcomeSub) + '</p>' +
        '<div class="welcome-suggestions">' +
          '<button type="button" class="welcome-suggestion" data-prompt="' + escAttr('用 BioPython 读取一个 FASTA 文件并计算 GC 含量') + '">' +
            '<div class="welcome-suggestion-title">' + esc(t.suggestFastaTitle) + '</div>' +
            '<div class="welcome-suggestion-desc">' + esc(t.suggestFastaDesc) + '</div>' +
          '</button>' +
          '<button type="button" class="welcome-suggestion" data-prompt="' + escAttr('帮我 BLAST 一段未知 DNA 序列：ATGCGATCGATCGATCG') + '">' +
            '<div class="welcome-suggestion-title">' + esc(t.suggestBlastTitle) + '</div>' +
            '<div class="welcome-suggestion-desc">' + esc(t.suggestBlastDesc) + '</div>' +
          '</button>' +
          '<button type="button" class="welcome-suggestion" data-prompt="' + escAttr('给我一个用 matplotlib 画 volcano plot 的 Python 脚本') + '">' +
            '<div class="welcome-suggestion-title">' + esc(t.suggestDataTitle) + '</div>' +
            '<div class="welcome-suggestion-desc">' + esc(t.suggestDataDesc) + '</div>' +
          '</button>' +
          '<button type="button" class="welcome-suggestion" data-prompt="' + escAttr('查 PubMed 找 2024 年以后 CRISPR off-target 相关的高引论文') + '">' +
            '<div class="welcome-suggestion-title">' + esc(t.suggestPubmedTitle) + '</div>' +
            '<div class="welcome-suggestion-desc">' + esc(t.suggestPubmedDesc) + '</div>' +
          '</button>' +
          '<button type="button" class="welcome-suggestion is-feature" data-prompt="' + escAttr('帮我下载 1CRN（crambin）的 PDB 文件到工作区，并简要介绍它的来源、功能和结构特点。下载后我点击文件可以直接看 3D 结构。') + '">' +
            '<div class="welcome-suggestion-title">' + esc(t.suggest3dTitle || '🧬 蛋白 3D 结构') + '</div>' +
            '<div class="welcome-suggestion-desc">' + esc(t.suggest3dDesc || '点击填入提示词；发出后 agent 会下载 PDB 文件，点击文件即可 3D 预览') + '</div>' +
          '</button>' +
        '</div>';
      welcomeHeroEl.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('.welcome-suggestion') : null;
        if (!btn) return;
        var p = btn.getAttribute('data-prompt');
        if (p && input) {
          input.value = p;
          input.focus();
        }
      });
      return welcomeHeroEl;
    }

    function showWelcomeIfEmpty() {
      if (!messagesEl) return;
      if (messagesEl.children.length === 0) {
        messagesEl.appendChild(renderWelcomeHero());
      }
    }
    function hideWelcome() {
      if (messagesEl) {
        var hero = messagesEl.querySelector('.welcome-hero');
        if (hero) hero.remove();
      }
    }

    function clampComposerHeight(value) {
      var viewportMax = Math.floor(window.innerHeight * 0.56);
      return Math.max(104, Math.min(viewportMax, Math.round(value || 0)));
    }

    function setComposerHeight(value, persist) {
      var height = clampComposerHeight(value);
      input.style.height = height + 'px';
      if (persist) {
        try { localStorage.setItem(COMPOSER_HEIGHT_KEY, String(height)); } catch (e) {}
      }
    }

    (function loadComposerHeight() {
      var stored = null;
      try { stored = localStorage.getItem(COMPOSER_HEIGHT_KEY); } catch (e) {}
      setComposerHeight(stored ? Number(stored) : 148, false);
    })();

    if (composerResizer) {
      var resizeState = null;

      function finishComposerResize(event) {
        if (!resizeState) return;
        if (event && resizeState.pointerId != null && event.pointerId != null && event.pointerId !== resizeState.pointerId) return;
        document.body.classList.remove('is-resizing-composer');
        setComposerHeight(input.getBoundingClientRect().height, true);
        resizeState = null;
      }

      composerResizer.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        resizeState = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startHeight: input.getBoundingClientRect().height,
        };
        composerResizer.setPointerCapture(event.pointerId);
        document.body.classList.add('is-resizing-composer');
      });

      composerResizer.addEventListener('pointermove', function (event) {
        if (!resizeState || event.pointerId !== resizeState.pointerId) return;
        setComposerHeight(resizeState.startHeight + (event.clientY - resizeState.startY), false);
      });

      composerResizer.addEventListener('pointerup', finishComposerResize);
      composerResizer.addEventListener('pointercancel', finishComposerResize);
      composerResizer.addEventListener('dblclick', function () {
        setComposerHeight(148, true);
      });
      composerResizer.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home') return;
        event.preventDefault();
        if (event.key === 'Home') {
          setComposerHeight(148, true);
          return;
        }
        var delta = event.key === 'ArrowDown' ? 18 : -18;
        setComposerHeight(input.getBoundingClientRect().height + delta, true);
      });
      window.addEventListener('pointerup', finishComposerResize);
    }

    function readStoredNumber(key) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return null;
        var value = Number(raw);
        return Number.isFinite(value) ? value : null;
      } catch (e) {
        return null;
      }
    }

    function writeStoredNumber(key, value) {
      try { localStorage.setItem(key, String(Math.round(value))); } catch (e) {}
    }

    function clearStoredNumber(key) {
      try { localStorage.removeItem(key); } catch (e) {}
    }

    function clampMainPanelWidth(value) {
      if (!unifiedLayout) return 0;
      var total = Math.max(0, unifiedLayout.getBoundingClientRect().width - 12);
      var min = 360;
      var max = Math.max(min, total - 360);
      return Math.max(min, Math.min(max, Math.round(value || min)));
    }

    function clampThreadRailWidth(value) {
      if (!chatShell) return 244;
      var total = Math.max(0, chatShell.getBoundingClientRect().width - 12);
      var min = 188;
      var max = Math.max(min, Math.min(420, total - 360));
      return Math.max(min, Math.min(max, Math.round(value || 244)));
    }

    function clampTraceSidebarWidth(value) {
      if (!traceMain) return 280;
      var total = Math.max(0, traceMain.getBoundingClientRect().width - 12);
      var min = 220;
      var max = Math.max(min, Math.min(460, total - 320));
      return Math.max(min, Math.min(max, Math.round(value || 280)));
    }

    function setMainPanelWidth(value, persist) {
      var width = clampMainPanelWidth(value);
      unifiedRoot.style.setProperty('--main-left-size', width + 'px');
      if (persist) writeStoredNumber(MAIN_SPLIT_KEY, width);
    }

    function resetMainPanelWidth() {
      unifiedRoot.style.removeProperty('--main-left-size');
      clearStoredNumber(MAIN_SPLIT_KEY);
    }

    function setThreadRailWidth(value, persist) {
      var width = clampThreadRailWidth(value);
      unifiedRoot.style.setProperty('--thread-rail-w', width + 'px');
      if (persist) writeStoredNumber(THREAD_SPLIT_KEY, width);
    }

    function resetThreadRailWidth() {
      unifiedRoot.style.removeProperty('--thread-rail-w');
      clearStoredNumber(THREAD_SPLIT_KEY);
    }

    function setTraceSidebarWidth(value, persist) {
      var width = clampTraceSidebarWidth(value);
      unifiedRoot.style.setProperty('--trace-sidebar-w', width + 'px');
      if (persist) writeStoredNumber(TRACE_SPLIT_KEY, width);
    }

    function resetTraceSidebarWidth() {
      unifiedRoot.style.removeProperty('--trace-sidebar-w');
      clearStoredNumber(TRACE_SPLIT_KEY);
    }

    function applyStoredPanelSizes() {
      var mainWidth = readStoredNumber(MAIN_SPLIT_KEY);
      if (mainWidth != null && isWide()) setMainPanelWidth(mainWidth, false);

      var railWidth = readStoredNumber(THREAD_SPLIT_KEY);
      if (railWidth != null && window.matchMedia('(min-width: 981px)').matches) setThreadRailWidth(railWidth, false);

      var traceWidth = readStoredNumber(TRACE_SPLIT_KEY);
      if (traceWidth != null && window.matchMedia('(min-width: 701px)').matches) setTraceSidebarWidth(traceWidth, false);
    }

    function installHorizontalResizer(handle, opts) {
      if (!handle) return;
      var state = null;

      function finishResize(event) {
        if (!state) return;
        if (event && state.pointerId != null && event.pointerId != null && event.pointerId !== state.pointerId) return;
        document.body.classList.remove('is-resizing-layout');
        opts.persist(opts.current());
        state = null;
      }

      handle.addEventListener('pointerdown', function (event) {
        if (!opts.enabled()) return;
        event.preventDefault();
        state = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startValue: opts.current(),
        };
        handle.setPointerCapture(event.pointerId);
        document.body.classList.add('is-resizing-layout');
      });

      handle.addEventListener('pointermove', function (event) {
        if (!state || event.pointerId !== state.pointerId) return;
        opts.setFromDrag(state.startValue, event.clientX - state.startX);
      });

      handle.addEventListener('pointerup', finishResize);
      handle.addEventListener('pointercancel', finishResize);
      handle.addEventListener('dblclick', function () {
        if (!opts.enabled()) return;
        opts.reset();
      });
      handle.addEventListener('keydown', function (event) {
        if (!opts.enabled()) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home') return;
        event.preventDefault();
        if (event.key === 'Home') {
          opts.reset();
          return;
        }
        var delta = event.key === 'ArrowRight' ? 24 : -24;
        opts.setFromKeyboard(delta);
      });
      window.addEventListener('pointerup', finishResize);
    }

    installHorizontalResizer(mainPanelResizer, {
      enabled: function () { return isWide(); },
      current: function () { return panelTrace.getBoundingClientRect().width; },
      setFromDrag: function (startValue, delta) { setMainPanelWidth(startValue + delta, false); },
      setFromKeyboard: function (delta) { setMainPanelWidth(panelTrace.getBoundingClientRect().width + delta, true); },
      persist: function (value) { setMainPanelWidth(value, true); },
      reset: resetMainPanelWidth,
    });

    installHorizontalResizer(threadRailResizer, {
      enabled: function () { return window.matchMedia('(min-width: 981px)').matches; },
      current: function () { return threadRail.getBoundingClientRect().width; },
      setFromDrag: function (startValue, delta) { setThreadRailWidth(startValue + delta, false); },
      setFromKeyboard: function (delta) { setThreadRailWidth(threadRail.getBoundingClientRect().width + delta, true); },
      persist: function (value) { setThreadRailWidth(value, true); },
      reset: resetThreadRailWidth,
    });

    installHorizontalResizer(traceSidebarResizer, {
      enabled: function () { return window.matchMedia('(min-width: 701px)').matches; },
      current: function () { return traceSidebar.getBoundingClientRect().width; },
      setFromDrag: function (startValue, delta) { setTraceSidebarWidth(startValue - delta, false); },
      setFromKeyboard: function (delta) { setTraceSidebarWidth(traceSidebar.getBoundingClientRect().width - delta, true); },
      persist: function (value) { setTraceSidebarWidth(value, true); },
      reset: resetTraceSidebarWidth,
    });

    function setSettingsOpen(open) {
      settingsBackdrop.classList.toggle('is-open', open);
      settingsDrawer.classList.toggle('is-open', open);
      settingsBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
      settingsDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    openSettingsBtn.addEventListener('click', function () {
      setSettingsOpen(true);
      refreshManagementPanels();
    });
    closeSettingsBtn.addEventListener('click', function () { setSettingsOpen(false); });
    settingsBackdrop.addEventListener('click', function () { setSettingsOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && settingsDrawer.classList.contains('is-open')) setSettingsOpen(false);
    });

    function formatThreadTime(value) {
      if (!value) return '';
      try {
        return new Date(value).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (e) {
        return String(value);
      }
    }

    function stopChatSse() {
      if (chatEs) {
        chatEs.close();
        chatEs = null;
      }
    }

    function renderThreads() {
      if (!threadListEl) return;
      var t = T();
      if (!threads.length) {
        threadListEl.innerHTML = '<div class="thread-empty">' + esc(t.threadEmpty) + '</div>';
        return;
      }
      threadListEl.innerHTML = threads.map(function (thread) {
        var active = thread.chatJid === chatJid ? ' is-active' : '';
        var title = thread.title || t.threadUntitled;
        var metaTime = formatThreadTime(thread.lastActivity || thread.addedAt);
        return '<div class="thread-item' + active + '" data-chat-jid="' + esc(thread.chatJid) + '" role="button" tabindex="0">' +
          '<div class="thread-item-row">' +
          '<div class="thread-item-main">' +
          '<div class="thread-item-title">' + esc(title) + '</div>' +
          '<div class="thread-item-meta"><span>' + esc(thread.workspaceFolder || '') + '</span><span>' + esc(metaTime) + '</span></div>' +
          '</div>' +
          '<div class="thread-item-actions">' +
          '<button type="button" class="thread-action" data-thread-action="rename" data-chat-jid="' + esc(thread.chatJid) + '" title="' + esc(t.threadRenameAction) + '">✎</button>' +
          '<button type="button" class="thread-action" data-thread-action="archive" data-chat-jid="' + esc(thread.chatJid) + '" title="' + esc(t.threadArchiveAction) + '">×</button>' +
          '</div>' +
          '</div>' +
          '</div>';
      }).join('');
    }

    async function refreshThreads() {
      try {
        var res = await fetch('/api/threads', { headers: authHeaders() });
        if (!res.ok) return;
        var data = await res.json();
        threads = Array.isArray(data.threads) ? data.threads : [];
        if (!threads.some(function (thread) { return thread.chatJid === chatJid; }) && threads[0]) {
          chatJid = threads[0].chatJid;
        }
        if (jidEl) jidEl.textContent = chatJid;
        renderThreads();
      } catch (e) {}
    }

    async function setActiveThread(nextChatJid) {
      if (!nextChatJid || nextChatJid === chatJid) { closeThreadRail(); return; }
      chatJid = nextChatJid;
      lastSignature = '';
      messagesEl.innerHTML = '';
      if (jidEl) jidEl.textContent = chatJid;
      try { localStorage.setItem(THREAD_KEY, chatJid); } catch (e) {}
      renderThreads();
      stopPolling();
      stopChatSse();
      closeThreadRail();
      await refreshMessages();
      await refreshManagementPanels();
      connectChatSse();
      // Re-aim the trace panel at the newly-selected thread
      syncTraceGroupToCurrentChat();
      if (document.body.classList.contains('trace-open')) {
        loadTrace();
        loadTree();
      }
    }

    async function renameThread(threadChatJid) {
      var current = threads.find(function (thread) { return thread.chatJid === threadChatJid; });
      var nextTitle = window.prompt(T().threadRenamePrompt, current && current.title ? current.title : '');
      if (nextTitle === null) return;
      nextTitle = nextTitle.trim();
      if (!nextTitle) return;
      try {
        var res = await fetch('/api/threads/' + encodeURIComponent(threadChatJid), {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ title: nextTitle }),
        });
        if (!res.ok) throw new Error(T().threadRenameFail);
        await refreshThreads();
      } catch (e) {
        setStatus(e && e.message ? e.message : T().threadRenameFail);
      }
    }

    async function archiveThread(threadChatJid) {
      if (!window.confirm(T().threadArchiveConfirm)) return;
      try {
        var wasActive = chatJid === threadChatJid;
        var res = await fetch('/api/threads/' + encodeURIComponent(threadChatJid), {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(T().threadArchiveFail);
        var data = await res.json();
        await refreshThreads();
        if (data.nextChatJid && wasActive) {
          chatJid = '';
          await setActiveThread(data.nextChatJid);
        } else if (wasActive && threads[0]) {
          chatJid = '';
          await setActiveThread(threads[0].chatJid);
        }
      } catch (e) {
        setStatus(e && e.message ? e.message : T().threadArchiveFail);
      }
    }

    function render(messages) {
      var signature = JSON.stringify(messages.map(function (m) { return [m.id, m.timestamp, m.content]; }));
      if (signature === lastSignature) return;
      lastSignature = signature;
      var t = T();
      // Detach any "finalized" bubbles already in DOM (these own a bot message
      // by timestamp — we'll skip rendering that message and re-attach the bubble).
      var finalizedNodes = {};
      if (messagesEl) {
        messagesEl.querySelectorAll('[data-msg-ts]').forEach(function (el) {
          var ts = el.getAttribute('data-msg-ts');
          if (ts) {
            finalizedNodes[ts] = el;
            if (el.parentNode) el.parentNode.removeChild(el);
          }
        });
      }
      var latestIsAssistant = messages.length && messages[messages.length - 1].is_from_me;
      var lastTs = latestIsAssistant ? messages[messages.length - 1].timestamp : null;
      // If the latest assistant message just arrived and we have an active
      // streaming bubble, FINALIZE it (preserve content + steps) instead of
      // clearing — otherwise the thinking history is lost.
      if (latestIsAssistant && !finalizedNodes[lastTs] && streamingBubble) {
        // Replace the (possibly truncated) streaming preview with the full final content,
        // BUT preserve the Process strip (the "thinking history") so the user can still
        // see what the agent did. Collapse it by default — answer is what they want first.
        var finalContent = messages[messages.length - 1].content;
        var contentEl = streamingBubble.querySelector('.content');
        if (contentEl) {
          var existingProcess = contentEl.querySelector('.streaming-process');
          var preservedProcessHtml = '';
          if (existingProcess) {
            // Force-collapse the preserved process strip so the final answer is the focus.
            existingProcess.removeAttribute('open');
            preservedProcessHtml = existingProcess.outerHTML;
          }
          contentEl.innerHTML = preservedProcessHtml + renderBody(finalContent);
        }
        var bubbleEl = streamingBubble.querySelector('.bubble');
        if (bubbleEl && !bubbleEl.querySelector('.bubble-actions')) {
          var encoded = escAttr(encodeURIComponent(String(finalContent)));
          var footer = document.createElement('div');
          footer.className = 'bubble-actions';
          footer.innerHTML = '<button type="button" class="bubble-action-btn" data-copy="' + encoded + '">' +
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '<span class="bubble-action-label">' + esc(t.copy) + '</span>' +
          '</button>';
          bubbleEl.appendChild(footer);
        }
        finalizeStreamingBubble(lastTs);
        // Re-collect finalizedNodes since we just minted one
        if (messagesEl) {
          messagesEl.querySelectorAll('[data-msg-ts]').forEach(function (el) {
            var ts = el.getAttribute('data-msg-ts');
            if (ts && !finalizedNodes[ts]) {
              finalizedNodes[ts] = el;
              if (el.parentNode) el.parentNode.removeChild(el);
            }
          });
        }
        stopWorkStrip();
        streamingLocked = true;
      } else if (latestIsAssistant && !finalizedNodes[lastTs]) {
        // No streaming bubble (run ended without one) → just stop work-strip
        stopWorkStrip();
        streamingLocked = true;
      }
      // Preserve any *active* streaming bubble across the rebuild.
      // Keep it even when the latest message is from the assistant — the run
      // may still be in progress (multi-turn tool loop) and we don't want to
      // discard the bubble mid-conversation.
      var preservedStreamingBubble = (streamingBubble && streamingBubble.hasAttribute('data-streaming')) ? streamingBubble : null;
      if (preservedStreamingBubble && preservedStreamingBubble.parentNode) {
        preservedStreamingBubble.parentNode.removeChild(preservedStreamingBubble);
      }
      // Filter out messages whose timestamp is already owned by a finalized bubble.
      // Don't filter ALL messages out. If filtering would empty the chat,
      // skip the filter (prevents the screen from going blank when the only
      // bot message is owned by the finalized bubble while there are no other messages yet).
      var renderableMessages = messages.filter(function (m) { return !finalizedNodes[m.timestamp]; });
      var hasFinalized = Object.keys(finalizedNodes).length > 0;
      messages = renderableMessages;
      if (!messages.length && !hasFinalized) {
        messagesEl.innerHTML = '';
        showWelcomeIfEmpty();
        if (preservedStreamingBubble) messagesEl.appendChild(preservedStreamingBubble);
        return;
      }
      hideWelcome();
      messagesEl.innerHTML = '';   // clean slate; we'll append everything below
      messagesEl.insertAdjacentHTML('beforeend', messages.map(function (msg) {
        var kind = msg.is_from_me ? 'bot' : 'user';
        var name = msg.is_from_me ? assistantName : (msg.sender_name || t.userFallback);
        var role = msg.is_from_me ? t.roleAssistant : t.roleYou;
        var avatarChar = msg.is_from_me ? 'B' : ((name || 'U').charAt(0).toUpperCase());
        var encoded = escAttr(encodeURIComponent(String(msg.content)));
        var footerActions = msg.is_from_me
          ? '<div class="bubble-actions">' +
              '<button type="button" class="bubble-action-btn" data-copy="' + encoded + '">' +
                '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
                '<span class="bubble-action-label">' + esc(t.copy) + '</span>' +
              '</button>' +
              '<button type="button" class="bubble-action-btn" data-trace-jump="1">' +
                '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v7.527a3 3 0 0 1-.46 1.597L3.42 17.596A2 2 0 0 0 5.1 20.69h13.8a2 2 0 0 0 1.68-3.095l-4.12-6.47A3 3 0 0 1 16 9.527V2"/></svg>' +
                '<span class="bubble-action-label">' + esc(t.thoughtsDone) + '</span>' +
              '</button>' +
            '</div>'
          : '';
        return '<div class="bubble-row ' + kind + '" data-row-ts="' + escAttr(msg.timestamp) + '">' +
          '<div class="bubble-avatar" aria-hidden="true">' + esc(avatarChar) + '</div>' +
          '<article class="bubble ' + kind + '">' +
            '<div class="meta"><span class="badge">' + esc(role) + '</span>' +
              esc(name) + ' · ' + esc(msg.timestamp) +
            '</div>' +
            '<div class="content">' + renderBody(msg.content) + '</div>' +
            footerActions +
          '</article>' +
        '</div>';
      }).join(''));
      // Insert finalized bubbles in chronological order based on data-row-ts.
      Object.keys(finalizedNodes).sort().forEach(function (ts) {
        var node = finalizedNodes[ts];
        // Find the last child whose data-msg-ts (or the rendered message timestamp
        // we keep below in data-row-ts) is less than ts.
        var children = messagesEl.querySelectorAll('.bubble-row');
        var inserted = false;
        for (var i = 0; i < children.length; i++) {
          var childTs = children[i].getAttribute('data-row-ts') || '';
          if (childTs && childTs > ts) {
            messagesEl.insertBefore(node, children[i]);
            inserted = true;
            break;
          }
        }
        if (!inserted) messagesEl.appendChild(node);
      });
      if (preservedStreamingBubble) messagesEl.appendChild(preservedStreamingBubble);
      // Decorate every <pre> code block with a copy button
      messagesEl.querySelectorAll('.bubble .content').forEach(function (c) { enhanceCodeBlocks(c); });
      scrollChatToBottom();
    }

    function renderBody(text) {
      var upload = parseUploadMessage(text);
      if (upload) return renderUploadCard(upload);
      var html = markdownToSafeHtml(String(text));
      var files = extractFileLinks(text).concat(extractWorkspaceFileLinks(text));
      // dedupe
      var seen = {};
      var dedup = files.filter(function (p) { if (seen[p]) return false; seen[p] = true; return true; });
      return html + renderFileActions(dedup);
    }

    /* Detect /workspace/group/... paths the agent creates and map them to
       the backend's chat-scoped file route: /files/chat/<chatJid>/<rel> */
    function extractWorkspaceFileLinks(text) {
      var out = [];
      var seen = {};
      var re = /\/workspace\/group\/([\w./%-]+)/g;
      var m;
      var jidEnc = encodeURIComponent(chatJid);
      while ((m = re.exec(String(text))) !== null) {
        var rel = m[1];
        var webPath = '/files/chat/' + jidEnc + '/' + rel;
        if (!seen[webPath]) { seen[webPath] = true; out.push(webPath); }
      }
      return out;
    }

    /* Add a copy button + language pill on every code block after render. */
    function enhanceCodeBlocks(rootEl) {
      if (!rootEl) return;
      var pres = rootEl.querySelectorAll('pre');
      pres.forEach(function (pre) {
        if (pre.dataset.enhanced === '1') return;
        pre.dataset.enhanced = '1';
        var wrap = document.createElement('div');
        wrap.className = 'codeblock';
        pre.parentNode.insertBefore(wrap, pre);
        wrap.appendChild(pre);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'codeblock-copy';
        btn.textContent = T().copy || 'Copy';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var raw = pre.innerText || pre.textContent || '';
          navigator.clipboard.writeText(raw).then(function () {
            btn.textContent = T().copied || 'Copied';
            setTimeout(function () { btn.textContent = T().copy || 'Copy'; }, 1200);
          }).catch(function () {
            btn.textContent = T().copyFail || 'Failed';
            setTimeout(function () { btn.textContent = T().copy || 'Copy'; }, 1200);
          });
        });
        wrap.appendChild(btn);
      });
    }

    function parseUploadMessage(text) {
      var lines = String(text).split('\n');
      var fileLine = lines.find(function (line) { return line.startsWith('Uploaded file: '); });
      var workspaceLine = lines.find(function (line) { return line.startsWith('Workspace path: '); });
      var previewLine = lines.find(function (line) { return line.startsWith('Preview URL: '); });
      if (!fileLine || !workspaceLine || !previewLine) return null;
      return {
        filename: fileLine.slice('Uploaded file: '.length),
        workspacePath: workspaceLine.slice('Workspace path: '.length),
        previewUrl: previewLine.slice('Preview URL: '.length),
      };
    }

    function renderUploadCard(file) {
      var t = T();
      var escapedName = esc(file.filename);
      var escapedPath = esc(file.workspacePath);
      var escapedPreview = esc(file.previewUrl);
      var isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(file.filename);
      var preview = isImage ? '<img class="preview" src="' + escapedPreview + '" alt="' + escapedName + '">' : '';
      return '<section class="file-card"><div class="file-title">' + esc(t.uploadedPrefix) + escapedName + '</div><div class="file-path">' + escapedPath + '</div>' + preview +
        '<div class="file-actions"><a class="file-button" href="' + escapedPreview + '" target="_blank" rel="noreferrer">' + esc(t.openFile) + '</a>' +
        '<a class="file-button" href="' + escapedPreview + '" download>' + esc(t.download) + '</a></div></section>';
    }

    async function refreshMessages() {
      try {
        var res = await fetch('/api/messages?scope=chat&chatJid=' + encodeURIComponent(chatJid));
        if (!res.ok) return;
        var data = await res.json();
        render(data.messages || []);
      } catch (e) {}
    }

    if (messagesEl) {
      messagesEl.addEventListener('click', async function (event) {
        var traceJumpBtn = event.target && event.target.closest
          ? event.target.closest('[data-trace-jump]')
          : null;
        if (traceJumpBtn) {
          event.preventDefault();
          // Find the bubble's timestamp so we can scroll to the matching run
          var ownerRow = traceJumpBtn.closest('.bubble-row');
          var rowTs = ownerRow ? ownerRow.getAttribute('data-row-ts') : '';
          showDrawerTrace();
          openTracePanel();
          // After trace renders, jump to the matching task card
          setTimeout(function () { scrollTraceToRun(rowTs); }, 200);
          return;
        }
        // Intercept clicks on file links / inline images / "Open" buttons —
        // open them in the right-drawer preview pane instead of a new tab.
        var fileTarget = event.target && event.target.closest
          ? event.target.closest('a[href^="/files/"], img[src^="/files/"]')
          : null;
        if (fileTarget && !event.target.closest('[download]')) {
          var url = fileTarget.tagName === 'IMG' ? fileTarget.getAttribute('src') : fileTarget.getAttribute('href');
          if (url && url.indexOf('/files/') === 0) {
            event.preventDefault();
            var name = decodeURIComponent(url.split('/').pop() || 'file');
            // Strip timestamp prefix if present (e.g., "1234567890-plot.png" → "plot.png")
            var stripped = name.replace(/^\d{10,}-/, '');
            if (window.__bioclawOpenFileInDrawer) {
              window.__bioclawOpenFileInDrawer(url, stripped);
            }
            return;
          }
        }
        var btn = event.target && event.target.closest
          ? event.target.closest('.copy-btn, .bubble-action-btn[data-copy]')
          : null;
        if (!btn) return;
        event.preventDefault();
        var payload = btn.getAttribute('data-copy') || '';
        var raw = '';
        try { raw = decodeURIComponent(payload); } catch (e) { raw = payload; }
        var t = T();
        var labelEl = btn.querySelector('.bubble-action-label') || btn;
        var orig = labelEl.textContent;
        try {
          await navigator.clipboard.writeText(raw);
          labelEl.textContent = t.copied;
          setTimeout(function () { labelEl.textContent = orig || t.copy; }, 1200);
        } catch (e2) {
          labelEl.textContent = t.copyFail;
          setTimeout(function () { labelEl.textContent = orig || t.copy; }, 1200);
        }
      });
    }

    function startPolling() {
      if (pollTimer) return;
      setChatConn('poll');
      pollTimer = setInterval(refreshMessages, 2000);
    }
    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function connectChatSse() {
      try {
        chatEs = new EventSource('/api/events?chatJid=' + encodeURIComponent(chatJid));
        chatEs.onopen = function () { setChatConn('sse'); stopPolling(); };
        chatEs.onmessage = function () { refreshMessages(); };
        chatEs.onerror = function () {
          if (chatEs) { chatEs.close(); chatEs = null; }
          setChatConn('poll');
          startPolling();
        };
      } catch (e) { startPolling(); }
    }

    if (threadListEl) {
      threadListEl.addEventListener('click', async function (event) {
        var actionButton = event.target && event.target.closest ? event.target.closest('[data-thread-action]') : null;
        if (actionButton) {
          event.preventDefault();
          event.stopPropagation();
          var action = actionButton.getAttribute('data-thread-action');
          var actionChatJid = actionButton.getAttribute('data-chat-jid');
          if (!action || !actionChatJid) return;
          if (action === 'rename') {
            await renameThread(actionChatJid);
          } else if (action === 'archive') {
            await archiveThread(actionChatJid);
          }
          return;
        }
        var button = event.target && event.target.closest ? event.target.closest('.thread-item') : null;
        if (!button) return;
        var nextChatJid = button.getAttribute('data-chat-jid');
        if (nextChatJid) await setActiveThread(nextChatJid);
      });
      threadListEl.addEventListener('keydown', async function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var item = event.target && event.target.closest ? event.target.closest('.thread-item') : null;
        if (!item) return;
        event.preventDefault();
        var nextChatJid = item.getAttribute('data-chat-jid');
        if (nextChatJid) await setActiveThread(nextChatJid);
      });
    }

    if (newThreadBtn) {
      newThreadBtn.addEventListener('click', async function () {
        // No prompt — just create an empty chat. Title auto-fills from first message.
        newThreadBtn.disabled = true;
        try {
          var res = await fetch('/api/threads', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ title: '' }),
          });
          if (!res.ok) throw new Error('THREAD_CREATE_FAIL');
          var data = await res.json();
          await refreshThreads();
          if (data.thread && data.thread.chatJid) {
            await setActiveThread(data.thread.chatJid);
          }
        } catch (e) {
          setStatus(T().threadCreateFail);
        } finally {
          newThreadBtn.disabled = false;
        }
      });
    }

    if (manageRefreshBtn) {
      manageRefreshBtn.addEventListener('click', function () {
        refreshManagementPanels();
      });
    }

    if (manageCommandBtn) {
      manageCommandBtn.addEventListener('click', function () {
        runManageCommand((manageCommandInput && manageCommandInput.value || '').trim());
      });
    }

    if (manageCommandInput) {
      manageCommandInput.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        runManageCommand(manageCommandInput.value.trim());
      });
    }

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileNameEl.textContent = file ? file.name : T().noFile;
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });

    async function autoTitleIfNeeded(promptText) {
      try {
        var current = threads.find(function (t) { return t.chatJid === chatJid; });
        if (!current) return;
        var existing = (current.title || '').trim();
        // Only auto-title if the thread has no real title yet
        if (existing && existing !== T().threadUntitled && existing !== '新对话' && existing !== 'New chat' && existing !== 'New thread') return;
        var clean = String(promptText).replace(/\s+/g, ' ').trim();
        if (!clean) return;
        var nextTitle = clean.length > 24 ? clean.slice(0, 24) + '…' : clean;
        await fetch('/api/threads/' + encodeURIComponent(chatJid), {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ title: nextTitle }),
        });
        await refreshThreads();
      } catch (e) {}
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var text = input.value.trim();
      var file = fileInput.files && fileInput.files[0];
      if (!text && !file) return;
      streamingLocked = false;   // new run starting — allow streaming bubble again
      sendBtn.disabled = true;
      var promptForTitle = text;
      try {
        if (file) {
          setStatus(T().uploading);
          var upRes = await fetch('/api/upload?chatJid=' + encodeURIComponent(chatJid), {
            method: 'POST',
            headers: { 'x-file-name': encodeURIComponent(file.name), 'content-type': file.type || 'application/octet-stream' },
            body: file,
          });
          if (!upRes.ok) throw new Error('UPLOAD_FAIL');
          fileInput.value = '';
          fileNameEl.textContent = T().noFile;
        }
        if (text) {
          var res2 = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatJid: chatJid, text: text }),
          });
          if (!res2.ok) throw new Error('SEND_FAIL');
          input.value = '';
        }
        setStatus('');
        await refreshMessages();
        if (promptForTitle) autoTitleIfNeeded(promptForTitle);
      } catch (e) {
        var msg = e && e.message;
        if (msg === 'UPLOAD_FAIL') setStatus(T().uploadFail);
        else if (msg === 'SEND_FAIL') setStatus(T().sendFail);
        else setStatus(String(msg || ''));
      } finally {
        sendBtn.disabled = false;
      }
    });

    function setStatus(text) { statusEl.textContent = text || ''; }

    async function createFreshThread() {
      try {
        var res = await fetch('/api/threads', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ title: '' }),
        });
        if (!res.ok) return null;
        var data = await res.json();
        return data && data.thread && data.thread.chatJid ? data.thread.chatJid : null;
      } catch (e) { return null; }
    }

    function isThreadEmpty(jid) {
      var t = threads.find(function (x) { return x.chatJid === jid; });
      // Empty thread = lastActivity hasn't moved past addedAt (no real messages yet)
      return t && t.lastActivity === t.addedAt;
    }

    (async function initThreadsAndChat() {
      try {
        await refreshThreads();
        // Pick chatJid in this order:
        //  1. An existing "empty" thread (created but never used) — reuse it
        //  2. Otherwise create a fresh empty one (non-blocking: if it fails, fall back)
        //  3. Fall back to whatever thread we already have
        //  4. Final fallback: the default local-web JID (backend always honors it)
        var picked = null;
        try {
          var emptyThread = threads.find(function (x) { return isThreadEmpty(x.chatJid); });
          if (emptyThread) picked = emptyThread.chatJid;
        } catch (_) {}
        if (!picked) {
          try {
            var newJid = await createFreshThread();
            if (newJid) {
              picked = newJid;
              await refreshThreads();
            }
          } catch (_) {}
        }
        if (!picked && threads.length > 0) picked = threads[0].chatJid;
        if (!picked) picked = chatJid;   // whatever the server told us via /api/config
        chatJid = picked;
        if (jidEl) jidEl.textContent = chatJid;
        try { localStorage.setItem(THREAD_KEY, chatJid); } catch (_) {}
      } catch (e) {
        console.warn('[bioclaw] thread init failed', e);
      }
      // Render UI regardless of what happened above — never leave the screen blank.
      renderThreads();
      refreshMessages();
      refreshManagementPanels();
      connectChatSse();
      ensureTraceSseAlways();
    })();
})();
