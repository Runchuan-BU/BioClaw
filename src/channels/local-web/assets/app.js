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
  var threads = [];

  // Set session JID in settings drawer
  var jidEl = document.getElementById('sessionJid');
  if (jidEl) jidEl.textContent = chatJid;

const LANG_KEY = 'bioclaw-web-lang';

    const unifiedRoot = document.getElementById('unifiedRoot');
    const tabTraceBtn = document.getElementById('tabTraceBtn');
    const tabChatBtn = document.getElementById('tabChatBtn');
    const panelTrace = document.getElementById('panelTrace');
    const panelChat = document.getElementById('panelChat');
    const threadListEl = document.getElementById('threadList');
    const newThreadBtn = document.getElementById('newThreadBtn');
    const messagesEl = document.getElementById('messages');
    const form = document.getElementById('composer');
    const input = document.getElementById('text');
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
    const themeBtn = document.getElementById('themeBtn');
    const langBtn = document.getElementById('langBtn');
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const openSettingsBtn = document.getElementById('openSettings');
    const closeSettingsBtn = document.getElementById('closeSettings');
    const settingsConnValue = document.getElementById('settingsConnValue');
    const settingsTraceConnValue = document.getElementById('settingsTraceConnValue');

    const timeline = document.getElementById('timeline');
    const groupSel = document.getElementById('group');
    const treeEl = document.getElementById('tree');
    const traceStreamCb = document.getElementById('traceShowStream');

    var traceShowStream = false;
    try { traceShowStream = localStorage.getItem('bioclaw-trace-stream') === '1'; } catch (e) {}

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
        lblLang: '界面语言',
        lblTheme: '外观',
        lblConn: '对话列表',
        lblTraceConn: '追踪列表',
        lblSession: '会话 ID',
        langToggle: 'English',
        themeToggle: '切换浅色 / 深色',
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
        uploading: '正在上传…',
        uploadFail: '上传失败',
        sendFail: '发送失败',
        sidebarTitle: '工作区树',
        sidebarHint: '选择上方群组后加载 groups/&lt;folder&gt;',
        treePick: '请选择群组',
        treeEmpty: '（空）',
        loadFail: '加载失败',
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
        lblLang: 'Language',
        lblTheme: 'Appearance',
        lblConn: 'Chat list',
        lblTraceConn: 'Trace feed',
        lblSession: 'Session ID',
        langToggle: '中文',
        themeToggle: 'Light / dark theme',
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
        uploading: 'Uploading…',
        uploadFail: 'Upload failed',
        sendFail: 'Send failed',
        sidebarTitle: 'Workspace tree',
        sidebarHint: 'Pick a group above to load groups/&lt;folder&gt;',
        treePick: 'Select a group',
        treeEmpty: '(empty)',
        loadFail: 'Load failed',
      },
    };

    function T() { return I18N[lang]; }

    function applyLang(next) {
      lang = next === 'en' ? 'en' : 'zh';
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      var t = T();
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
      document.title = t.pageTitle;
      tabTraceBtn.textContent = t.tabTrace;
      tabChatBtn.textContent = t.tabChat;
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
      document.getElementById('lblLang').textContent = t.lblLang;
      document.getElementById('lblTheme').textContent = t.lblTheme;
      document.getElementById('lblConn').textContent = t.lblConn;
      document.getElementById('lblTraceConn').textContent = t.lblTraceConn;
      document.getElementById('lblSession').textContent = t.lblSession;
      langBtn.textContent = t.langToggle;
      themeBtn.textContent = t.themeToggle;
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
      var hasFile = fileInput.files && fileInput.files[0];
      fileNameEl.textContent = hasFile ? fileInput.files[0].name : t.noFile;
      if (!groupSel.value) treeEl.textContent = t.treePick;
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
      applyLang(saved === 'zh' ? 'zh' : 'en');
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
      traceEs.onmessage = function () { loadTrace(); loadTree(); };
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

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

    function renderProcessStep(r, t) {
      var parsed = traceParsedPayload(r.payload);
      var cls = pstepIconClass(r.type);
      var icon = pstepIconLabel(r.type);
      var label = '';
      var detail = '';
      var time = r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

      if (r.type === 'agent_thinking' && parsed) {
        label = t.evtThinking;
        detail = parsed.text || '';
      } else if (r.type === 'agent_tool_use' && parsed) {
        label = '<span class="pstep-tool-name">' + esc(String(parsed.toolName || '')) + '</span>';
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
      if (detail) {
        var detailStr = String(detail);
        if (detailStr.length <= 80) {
          detailHtml = '<div class="pstep-detail short">' + esc(detailStr) + '</div>';
        } else {
          var summary = esc(detailStr.slice(0, 60).replace(/\n/g, ' ')) + '…';
          detailHtml = '<details class="pstep-collapse"><summary>' + summary + '</summary>' +
            '<div class="pstep-collapse-body">' + esc(detailStr) + '</div></details>';
        }
      }
      return '<div class="pstep">' +
        '<div class="pstep-icon ' + cls + '">' + icon + '</div>' +
        '<div class="pstep-body"><span class="pstep-label">' + label + '</span>' +
        (time ? '<span class="pstep-time">' + esc(time) + '</span>' : '') +
        detailHtml +
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

        // Process steps (collapsible)
        if (bub.process.length > 0) {
          var stepsHtml = '';
          for (var p = 0; p < bub.process.length; p++) {
            stepsHtml += renderProcessStep(bub.process[p], t);
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
          if (evDetail) {
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

          html += '<details class="' + cardClass + '" ' + (isLast ? 'open' : '') + '>';
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
      var g = groupSel.value;
      var q = '/api/trace/list?limit=400' + (g ? '&group_folder=' + encodeURIComponent(g) : '');
      if (!traceShowStream) q += '&compact=1';
      return q;
    }

    async function loadTrace() {
      var res = await fetch(traceListQuery(), { headers: authHeaders() });
      if (!res.ok) { timeline.textContent = T().loadFail; return; }
      var data = await res.json();
      renderList(data.events || []);
    }

    async function loadTree() {
      var g = groupSel.value;
      if (!g) { treeEl.textContent = T().treePick; return; }
      var res = await fetch('/api/workspace/tree?group_folder=' + encodeURIComponent(g), { headers: authHeaders() });
      if (!res.ok) { treeEl.textContent = T().loadFail; return; }
      var data = await res.json();
      function nodeHtml(n) {
        if (n.type === 'dir') {
          var inner = (n.children || []).map(nodeHtml).join('');
          return '<details open><summary>' + esc(n.name) + '/</summary><div>' + inner + '</div></details>';
        }
        return '<div>· ' + esc(n.name) + '</div>';
      }
      treeEl.innerHTML = (data.tree || []).map(nodeHtml).join('') || T().treeEmpty;
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

    function isWide() { return window.matchMedia('(min-width: 1100px)').matches; }

    function applyLayout() {
      var wide = isWide();
      unifiedRoot.classList.toggle('unified-wide', wide);
      if (wide) {
        panelChat.classList.remove('hidden-narrow');
        panelTrace.classList.remove('hidden-narrow');
        ensureTrace();
      } else {
        if (currentTab === 'chat') {
          panelChat.classList.remove('hidden-narrow');
          panelTrace.classList.add('hidden-narrow');
          stopTraceSse();
        } else {
          panelChat.classList.add('hidden-narrow');
          panelTrace.classList.remove('hidden-narrow');
          ensureTrace();
        }
        tabTraceBtn.setAttribute('aria-selected', currentTab === 'trace' ? 'true' : 'false');
        tabChatBtn.setAttribute('aria-selected', currentTab === 'chat' ? 'true' : 'false');
      }
    }

    function setTab(tab) {
      currentTab = tab;
      var u = new URL(window.location.href);
      u.searchParams.set('tab', tab === 'trace' ? 'trace' : 'chat');
      window.history.replaceState({}, '', u.pathname + u.search);
      applyLayout();
    }

    tabTraceBtn.addEventListener('click', function () { setTab('trace'); });
    tabChatBtn.addEventListener('click', function () { setTab('chat'); });
    window.matchMedia('(min-width: 1100px)').addEventListener('change', applyLayout);

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

    langBtn.addEventListener('click', function () {
      applyLang(lang === 'zh' ? 'en' : 'zh');
      lastSignature = '';
      refreshMessages();
    });

    function loadTheme() {
      var th = localStorage.getItem('bioclaw-theme');
      if (th === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }
    loadTheme();
    themeBtn.addEventListener('click', function () {
      if (document.documentElement.getAttribute('data-theme') === 'light') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('bioclaw-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('bioclaw-theme', 'light');
      }
    });

    function setSettingsOpen(open) {
      settingsBackdrop.classList.toggle('is-open', open);
      settingsDrawer.classList.toggle('is-open', open);
      settingsBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
      settingsDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    openSettingsBtn.addEventListener('click', function () { setSettingsOpen(true); });
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
        return '<button type="button" class="thread-item' + active + '" data-chat-jid="' + esc(thread.chatJid) + '">' +
          '<div class="thread-item-title">' + esc(title) + '</div>' +
          '<div class="thread-item-meta"><span>' + esc(thread.workspaceFolder || '') + '</span><span>' + esc(metaTime) + '</span></div>' +
          '</button>';
      }).join('');
    }

    async function refreshThreads() {
      try {
        var res = await fetch('/api/threads');
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
      if (!nextChatJid || nextChatJid === chatJid) return;
      chatJid = nextChatJid;
      lastSignature = '';
      messagesEl.innerHTML = '';
      if (jidEl) jidEl.textContent = chatJid;
      try { localStorage.setItem(THREAD_KEY, chatJid); } catch (e) {}
      renderThreads();
      stopPolling();
      stopChatSse();
      await refreshMessages();
      connectChatSse();
    }

    function render(messages) {
      var signature = JSON.stringify(messages.map(function (m) { return [m.id, m.timestamp, m.content]; }));
      if (signature === lastSignature) return;
      lastSignature = signature;
      var t = T();
      messagesEl.innerHTML = messages.map(function (msg) {
        var kind = msg.is_from_me ? 'bot' : 'user';
        var name = msg.is_from_me ? assistantName : (msg.sender_name || t.userFallback);
        var role = msg.is_from_me ? t.roleAssistant : t.roleYou;
        return '<article class="bubble ' + kind + '"><div class="meta"><span class="badge">' + esc(role) + '</span>' +
          esc(name) + ' · ' + esc(msg.timestamp) + '</div><div class="content">' + renderBody(msg.content) + '</div></article>';
      }).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderBody(text) {
      var upload = parseUploadMessage(text);
      if (upload) return renderUploadCard(upload);
      return markdownToSafeHtml(String(text));
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
      threadListEl.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('.thread-item') : null;
        if (!button) return;
        var nextChatJid = button.getAttribute('data-chat-jid');
        if (nextChatJid) setActiveThread(nextChatJid);
      });
    }

    if (newThreadBtn) {
      newThreadBtn.addEventListener('click', async function () {
        var title = window.prompt(T().newThreadPrompt, '');
        if (title === null) return;
        newThreadBtn.disabled = true;
        try {
          var res = await fetch('/api/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title }),
          });
          if (!res.ok) throw new Error('THREAD_CREATE_FAIL');
          var data = await res.json();
          await refreshThreads();
          if (data.thread && data.thread.chatJid) {
            await setActiveThread(data.thread.chatJid);
          }
        } catch (e) {
          setStatus('Failed to create thread');
        } finally {
          newThreadBtn.disabled = false;
        }
      });
    }

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileNameEl.textContent = file ? file.name : T().noFile;
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var text = input.value.trim();
      var file = fileInput.files && fileInput.files[0];
      if (!text && !file) return;
      sendBtn.disabled = true;
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

    (async function initThreadsAndChat() {
      try {
        await refreshThreads();
        var savedThread = null;
        try { savedThread = localStorage.getItem(THREAD_KEY); } catch (e) {}
        if (savedThread && threads.some(function (thread) { return thread.chatJid === savedThread; })) {
          chatJid = savedThread;
        } else if (threads.length > 0) {
          chatJid = threads[0].chatJid;
        }
        if (jidEl) jidEl.textContent = chatJid;
        renderThreads();
      } catch (e) {}
      refreshMessages();
      connectChatSse();
    })();
})();
