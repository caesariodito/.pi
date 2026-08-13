import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Type } from "typebox";

const DEFAULT_BASE_URL = "http://pm-sesar:20128/v1";
const DEFAULT_SEARCH_MODEL = "best-reliable-web-search";
const DEFAULT_FETCH_MODEL = "best-reliable-web-fetch";
const DEFAULT_SEARCH_TIMEOUT_MS = 20_000;
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_OUTPUT_LIMIT = 30_000;

type SearchResult = {
  title?: string;
  url?: string;
  display_url?: string;
  snippet?: string;
  content?: string | null;
  position?: number;
  score?: number;
  published_at?: string | null;
  citation?: { provider?: string; rank?: number; retrieved_at?: string };
};

type SearchResponse = {
  provider?: string;
  query?: string;
  answer?: string | null;
  results?: SearchResult[];
  usage?: unknown;
  metrics?: unknown;
  errors?: unknown[];
};

type FetchResponse = {
  provider?: string;
  url?: string;
  title?: string;
  content?: { format?: string; text?: string; length?: number } | string;
  metadata?: unknown;
  usage?: unknown;
  metrics?: unknown;
};

function readEnvFile() {
  const envPath = path.join(os.homedir(), ".pi", "agent", ".env");
  if (!fs.existsSync(envPath)) return {} as Record<string, string>;

  return Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim().replace(/^['\"]|['\"]$/g, "")];
      }),
  );
}

function getConfig() {
  const env = readEnvFile();
  const get = (key: string) => process.env[key] || env[key];
  const baseUrl = (get("NINEROUTER_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return {
    baseUrl,
    apiKey: get("NINEROUTER_KEY"),
    searchModel: get("NINEROUTER_SEARCH_MODEL") || DEFAULT_SEARCH_MODEL,
    fetchModel: get("NINEROUTER_FETCH_MODEL") || DEFAULT_FETCH_MODEL,
    outputLimit: Number(get("NINEROUTER_OUTPUT_LIMIT") || DEFAULT_OUTPUT_LIMIT),
  };
}

function headers(apiKey?: string) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

function withTimeout(parentSignal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);

  const abort = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) abort();
  else parentSignal.addEventListener("abort", abort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal.removeEventListener("abort", abort);
    },
  };
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[Truncated: ${text.length - limit} chars omitted]`;
}

function formatUnknown(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

async function postJson<T>(url: string, body: unknown, apiKey: string | undefined, signal: AbortSignal): Promise<T> {
  if (!apiKey) throw new Error("Missing NINEROUTER_KEY. Set it in ~/.pi/agent/.env or the process environment.");

  const res = await fetch(url, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }

  if (!res.ok) {
    const message = typeof data === "object" && data && "error" in data
      ? formatUnknown((data as { error: unknown }).error)
      : formatUnknown(data);
    throw new Error(`9Router request failed ${res.status}: ${message}`);
  }

  return data as T;
}

function formatSearch(data: SearchResponse, outputLimit: number) {
  const lines: string[] = [];
  lines.push(`## Web search: ${data.query || ""}`.trim());
  if (data.provider) lines.push(`Provider: ${data.provider}`);
  if (data.answer) lines.push(`\nAnswer: ${data.answer}`);

  const results = data.results || [];
  if (results.length === 0) lines.push("\nNo results.");
  else {
    lines.push("\nResults:");
    results.forEach((r, i) => {
      const n = r.position || i + 1;
      const title = r.title || r.url || `Result ${n}`;
      const url = r.url || "";
      lines.push(`\n${n}. ${url ? `[${title}](${url})` : title}`);
      if (r.display_url) lines.push(`   Display URL: ${r.display_url}`);
      if (r.snippet) lines.push(`   ${r.snippet}`);
      if (r.content) lines.push(`   Content: ${truncate(r.content.replace(/\s+/g, " "), 800)}`);
      if (r.published_at) lines.push(`   Published: ${r.published_at}`);
      if (typeof r.score === "number") lines.push(`   Score: ${r.score}`);
      if (r.citation?.provider || r.citation?.rank) {
        lines.push(`   Citation: provider=${r.citation.provider || "unknown"}, rank=${r.citation.rank ?? n}`);
      }
    });
  }

  if (data.errors?.length) lines.push(`\nErrors: ${formatUnknown(data.errors)}`);
  return truncate(lines.join("\n"), outputLimit);
}

function formatFetch(data: FetchResponse, outputLimit: number) {
  const content = typeof data.content === "string" ? data.content : data.content?.text || "";
  const format = typeof data.content === "object" ? data.content?.format : undefined;
  const lines: string[] = [];

  lines.push(`# ${data.title || "Fetched page"}`);
  if (data.url) lines.push(`URL: ${data.url}`);
  if (data.provider) lines.push(`Provider: ${data.provider}`);
  if (format) lines.push(`Format: ${format}`);
  lines.push("\n---\n");
  lines.push(content || "No content returned.");

  return truncate(lines.join("\n"), outputLimit);
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web via 9Router using the best-reliable-web-search combo.",
    promptSnippet: "Search the web via 9Router best-reliable-web-search combo.",
    promptGuidelines: [
      "Use web_search when the user asks for current information, online facts, recent docs, articles, or web lookup.",
      "Use web_fetch after web_search when a result page needs full content extraction.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      max_results: Type.Optional(Type.Number({ description: "Maximum number of results. Default 5." })),
      search_type: Type.Optional(Type.Union([Type.Literal("web"), Type.Literal("news")])), 
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      const cfg = getConfig();
      const maxResults = Math.min(Math.max(params.max_results ?? 5, 1), 20);
      onUpdate?.({ content: [{ type: "text", text: `Searching web: ${params.query}` }] });

      const timeout = withTimeout(signal, DEFAULT_SEARCH_TIMEOUT_MS);
      try {
        const data = await postJson<SearchResponse>(
          `${cfg.baseUrl}/search`,
          {
            model: cfg.searchModel,
            query: params.query,
            max_results: maxResults,
            search_type: params.search_type || "web",
          },
          cfg.apiKey,
          timeout.signal,
        );

        return {
          content: [{ type: "text", text: formatSearch(data, cfg.outputLimit) }],
          details: data,
        };
      } finally {
        timeout.cleanup();
      }
    },
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description: "Fetch and extract webpage content via 9Router using the best-reliable-web-fetch combo.",
    promptSnippet: "Fetch webpage content via 9Router best-reliable-web-fetch combo.",
    promptGuidelines: [
      "Use web_fetch when the user gives a URL and wants page contents read, summarized, quoted, or converted to markdown/text/html.",
      "Use web_fetch for full source pages after web_search returns relevant URLs.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "HTTP or HTTPS URL to fetch" }),
      format: Type.Optional(Type.Union([Type.Literal("markdown"), Type.Literal("text"), Type.Literal("html")])), 
      max_characters: Type.Optional(Type.Number({ description: "Maximum extracted characters requested from 9Router. Default 20000." })),
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      if (!/^https?:\/\//i.test(params.url)) {
        throw new Error("web_fetch requires an http:// or https:// URL");
      }

      const cfg = getConfig();
      const maxCharacters = Math.min(Math.max(params.max_characters ?? 20_000, 1_000), 100_000);
      onUpdate?.({ content: [{ type: "text", text: `Fetching URL: ${params.url}` }] });

      const timeout = withTimeout(signal, DEFAULT_FETCH_TIMEOUT_MS);
      try {
        const data = await postJson<FetchResponse>(
          `${cfg.baseUrl}/web/fetch`,
          {
            model: cfg.fetchModel,
            url: params.url,
            format: params.format || "markdown",
            max_characters: maxCharacters,
          },
          cfg.apiKey,
          timeout.signal,
        );

        return {
          content: [{ type: "text", text: formatFetch(data, cfg.outputLimit) }],
          details: data,
        };
      } finally {
        timeout.cleanup();
      }
    },
  });
}
