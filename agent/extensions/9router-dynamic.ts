import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface ModelEntry {
  id: string;
  name?: string;
  reasoning?: boolean;
  input?: ("text" | "image")[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

interface ModelsConfig {
  providers?: Record<string, {
    baseUrl?: string;
    api?: string;
    apiKey?: string;
    compat?: Record<string, unknown>;
    models?: ModelEntry[];
  }>;
}

interface RouterModel {
  id: string;
  object?: string;
  owned_by?: string;
  name?: string;
  context_window?: number;
  max_tokens?: number;
}

interface ModelsResponse {
  data?: RouterModel[];
}

function resolveValue(value: string | undefined): string | undefined {
  if (!value) return value;
  const envOnly = value.match(/^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/);
  if (envOnly) return process.env[envOnly[1]];
  return value.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_match, name) => process.env[name] ?? "");
}

function displayName(id: string): string {
  const [owner, model] = id.includes("/") ? id.split(/\/(.+)/) : ["9router", id];
  const pretty = model
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `9Router ${pretty} (${owner})`;
}

function looksLikeChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !(
    lower.includes("tts") ||
    lower.includes("voiceclone") ||
    lower.includes("voicedesign") ||
    lower.includes("embedding") ||
    lower.includes("rerank")
  );
}

export default async function (pi: ExtensionAPI) {
  const configPath = path.join(os.homedir(), ".pi", "agent", "models.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as ModelsConfig;
  const existing = config.providers?.["9router"];

  const baseUrl = process.env.NINE_ROUTER_BASE_URL ?? existing?.baseUrl ?? "http://pm-sesar:20128/v1";
  const apiKey = process.env.NINE_ROUTER_API_KEY ?? resolveValue(existing?.apiKey);
  const api = existing?.api ?? "openai-completions";
  const compat = existing?.compat ?? {
    supportsDeveloperRole: false,
    supportsReasoningEffort: true,
    maxTokensField: "max_tokens",
  };

  if (!apiKey) {
    console.warn("[9router-dynamic] Missing API key. Set NINE_ROUTER_API_KEY or apiKey in ~/.pi/agent/models.json");
    return;
  }

  const modelsUrl = `${baseUrl.replace(/\/$/, "")}/models`;
  const response = await fetch(modelsUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`[9router-dynamic] Failed to fetch models: ${response.status} ${body}`);
    return;
  }

  const existingModels = new Map((existing?.models ?? []).map((m) => [m.id, m]));

  const payload = (await response.json()) as ModelsResponse;
  const models = (payload.data ?? [])
    .filter((model) => model.id && looksLikeChatModel(model.id))
    .map((model) => {
      const saved = existingModels.get(model.id);
      return {
        id: model.id,
        name: saved?.name ?? model.name ?? displayName(model.id),
        reasoning: saved?.reasoning ?? true,
        input: saved?.input ?? (["text", "image"] as ("text" | "image")[]),
        contextWindow: saved?.contextWindow ?? model.context_window ?? 200000,
        maxTokens: saved?.maxTokens ?? model.max_tokens ?? 16384,
        cost: saved?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      };
    });

  if (models.length === 0) {
    console.warn("[9router-dynamic] No chat models returned from 9Router");
    return;
  }

  pi.registerProvider("9router", {
    baseUrl,
    apiKey,
    api: api as "openai-completions",
    compat,
    models,
  });

  console.log(`[9router-dynamic] Registered ${models.length} models from ${modelsUrl}`);
}
