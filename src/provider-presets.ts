/**
 * Provider presets — ccswitch-style named provider+model bundles
 * stored at ~/.config/bioclaw/provider-presets.json.
 *
 * Enables one-command switching between common setups without editing .env
 * or remembering long model IDs:
 *
 *   /preset list                       — list all presets, mark current
 *   /preset switch <name>              — apply preset to current agent
 *   /preset save <name> [description]  — save current provider+model
 *   /preset delete <name>              — remove a preset
 *   /preset default <name>             — set the startup default
 *
 * Additionally exposed as `npm run preset -- <subcommand>` for terminal use.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export type PresetProvider =
  | 'anthropic'
  | 'openrouter'
  | 'openai-compatible'
  | 'openai-codex'
  | 'gemini';

export interface ProviderPreset {
  name: string;                 // unique identifier, [a-z0-9-]+
  provider: PresetProvider;
  model?: string;               // optional — defaults to provider's default
  baseUrl?: string;             // for openai-compatible / openrouter overrides
  description?: string;
}

export interface PresetsFile {
  presets: ProviderPreset[];
  default?: string;             // name of the preset to load on fresh agents
}

const DEFAULT_PRESETS_FILE: PresetsFile = {
  presets: [
    { name: 'claude',    provider: 'anthropic',         description: 'Native Anthropic Claude' },
    { name: 'gemini',    provider: 'gemini',            model: 'gemini-2.0-pro',                description: 'Google Gemini via CLI/OAuth or GEMINI_API_KEY' },
    { name: 'codex',     provider: 'openai-codex',      model: 'gpt-5.4',                       description: 'OpenAI Codex CLI (reuses ChatGPT login)' },
    { name: 'deepseek',     provider: 'openrouter',     model: 'deepseek/deepseek-chat-v3.1',   description: 'DeepSeek V3.1 via OpenRouter' },
    { name: 'deepseek-pro',  provider: 'openrouter',     model: 'deepseek/deepseek-v4-pro',       description: 'DeepSeek V4 Pro via OpenRouter' },
    { name: 'flash',     provider: 'openrouter',        model: 'google/gemini-2.5-flash',       description: 'Gemini 2.5 Flash via OpenRouter' },
    { name: 'opus',      provider: 'openrouter',        model: 'anthropic/claude-3.5-sonnet',   description: 'Claude 3.5 Sonnet via OpenRouter' },
  ],
  default: 'claude',
};

const PRESET_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

function getPresetsPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'bioclaw', 'provider-presets.json');
}

/**
 * Load presets from disk. Seeds the default file on first call.
 * Returns a safe copy — in-memory edits do not propagate back to disk until
 * {@link savePresets} is called.
 */
export function loadPresets(): PresetsFile {
  const presetsPath = getPresetsPath();
  if (!fs.existsSync(presetsPath)) {
    try {
      fs.mkdirSync(path.dirname(presetsPath), { recursive: true });
      fs.writeFileSync(
        presetsPath,
        JSON.stringify(DEFAULT_PRESETS_FILE, null, 2) + '\n',
        { encoding: 'utf8', mode: 0o600 },
      );
    } catch {
      // If we can't seed (e.g. read-only HOME), just return the defaults in memory.
      return { ...DEFAULT_PRESETS_FILE, presets: [...DEFAULT_PRESETS_FILE.presets] };
    }
    return { ...DEFAULT_PRESETS_FILE, presets: [...DEFAULT_PRESETS_FILE.presets] };
  }

  try {
    const raw = fs.readFileSync(presetsPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PresetsFile>;
    if (!Array.isArray(parsed.presets)) {
      return { ...DEFAULT_PRESETS_FILE, presets: [...DEFAULT_PRESETS_FILE.presets] };
    }
    return {
      presets: parsed.presets.filter((p): p is ProviderPreset =>
        Boolean(p && typeof p.name === 'string' && typeof p.provider === 'string'),
      ),
      default: typeof parsed.default === 'string' ? parsed.default : undefined,
    };
  } catch {
    return { ...DEFAULT_PRESETS_FILE, presets: [...DEFAULT_PRESETS_FILE.presets] };
  }
}

export function savePresets(file: PresetsFile): void {
  const presetsPath = getPresetsPath();
  fs.mkdirSync(path.dirname(presetsPath), { recursive: true });
  fs.writeFileSync(
    presetsPath,
    JSON.stringify(file, null, 2) + '\n',
    { encoding: 'utf8', mode: 0o600 },
  );
}

export function isValidPresetName(name: string): boolean {
  return PRESET_NAME_PATTERN.test(name);
}

export function getPreset(name: string): ProviderPreset | undefined {
  return loadPresets().presets.find((p) => p.name === name);
}

export function listPresets(): ProviderPreset[] {
  return loadPresets().presets;
}

export function getDefaultPreset(): ProviderPreset | undefined {
  const file = loadPresets();
  if (!file.default) return undefined;
  return file.presets.find((p) => p.name === file.default);
}

export function upsertPreset(preset: ProviderPreset): void {
  if (!isValidPresetName(preset.name)) {
    throw new Error(`Invalid preset name: ${preset.name} (must match ${PRESET_NAME_PATTERN.source})`);
  }
  const file = loadPresets();
  const idx = file.presets.findIndex((p) => p.name === preset.name);
  if (idx >= 0) {
    file.presets[idx] = preset;
  } else {
    file.presets.push(preset);
  }
  savePresets(file);
}

export function deletePreset(name: string): boolean {
  const file = loadPresets();
  const before = file.presets.length;
  file.presets = file.presets.filter((p) => p.name !== name);
  if (file.default === name) file.default = undefined;
  if (file.presets.length === before) return false;
  savePresets(file);
  return true;
}

export function setDefaultPreset(name: string): void {
  const file = loadPresets();
  if (!file.presets.some((p) => p.name === name)) {
    throw new Error(`Preset not found: ${name}`);
  }
  file.default = name;
  savePresets(file);
}

export function formatPresetsList(
  currentProvider?: string,
  currentModel?: string,
): string {
  const file = loadPresets();
  if (file.presets.length === 0) {
    return 'No presets configured. Use `/preset save <name>` to create one.';
  }
  const rows = file.presets.map((p) => {
    const isCurrent =
      currentProvider === p.provider && (!p.model || p.model === currentModel);
    const isDefault = p.name === file.default;
    const tags = [isCurrent ? '← current' : '', isDefault ? '[default]' : '']
      .filter(Boolean)
      .join(' ');
    const modelPart = p.model ? ` · ${p.model}` : '';
    const descPart = p.description ? `  —  ${p.description}` : '';
    return `  ${p.name.padEnd(12)} ${p.provider}${modelPart}${descPart} ${tags}`.trimEnd();
  });
  return ['Provider presets:', ...rows].join('\n');
}
