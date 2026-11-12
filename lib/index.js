import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";

export const inject = ["webServer"];

const ASTRBOT = "I:\\yuzhuanyong\\astrbot";
const CMD_CONFIG = path.join(ASTRBOT, "data", "cmd_config.json");
const CONFIG_DIR = path.join(ASTRBOT, "data", "config");
const LOG = path.join(ASTRBOT, "ab-restart.log");

const PRESETS = {
  ark: {
    sourceId: "ark-coding_source",
    providerId: "ark-coding",
    model: "deepseek-v4.1-flash",
    apiBase: "https://ark.cn-beijing.volces.com/api/coding/v3",
    label: "火山方舟",
  },
  deepseek: {
    sourceId: "deepseek_source",
    providerId: "deepseek-chat",
    model: "deepseek-chat",
    apiBase: "https://api.deepseek.com/v1",
    label: "DeepSeek 余额",
  },
  zhipu: {
    sourceId: "zhipu-chat_source",
    providerId: "zhipu-flash",
    model: "glm-4-flash",
    apiBase: "https://open.bigmodel.cn/api/paas/v4",
    label: "智谱",
  },
};

const CHILD_CONFIGS = [
  ["astrbot_plugin_memory_companion_config.json", ["memory_summary", "provider_id"]],
  ["astrbot_plugin_memory_companion_config.json", ["memory_summary", "private_provider_id"]],
  ["astrbot_plugin_memory_companion_config.json", ["memory_summary", "group_provider_id"]],
  ["astrbot_plugin_private_companion_config.json", ["model", "provider_id"]],
];

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function currentOf(cfg) {
  const id = cfg?.agent_runner?.config?.model?.provider_id || "";
  for (const [name, p] of Object.entries(PRESETS)) {
    if (p.providerId === id) return { name, providerId: id, label: p.label };
  }
  return { name: "?", providerId: id || "(未设置)", label: "未知" };
}

function keyOf(cfg, name) {
  const source = (cfg.provider_sources || []).find((s) => s.id === PRESETS[name].sourceId);
  return source?.key?.[0] || "";
}

function applySwitch(name) {
  const preset = PRESETS[name];
  if (!preset) return { ok: false, error: "不认识的来源" };
  const cfg = readJson(CMD_CONFIG);
  if (!cfg) return { ok: false, error: "读不到 cmd_config.json" };

  const sources = (cfg.provider_sources = cfg.provider_sources || []);
  let src = sources.find((s) => s.id === preset.sourceId);
  if (!src) {
    src = {
      id: preset.sourceId,
      type: "openai_chat_completion",
      provider: "openai",
      provider_type: "chat_completion",
      api_base: preset.apiBase,
      key: [""],
      timeout: 120,
      enable: true,
    };
    sources.push(src);
  }
  if (!(src.key || [""])[0]) return { ok: false, error: `${preset.label} 还没配钥匙` };
  src.enable = true;
  for (const [other, p] of Object.entries(PRESETS)) {
    if (other === name) continue;
    const s = sources.find((x) => x.id === p.sourceId);
    if (s) s.enable = false;
  }

  const providers = (cfg.provider = cfg.provider || []);
  for (const p of Object.values(PRESETS)) {
    const entry = providers.find((x) => x.id === p.providerId);
    if (entry) entry.enable = entry.id === preset.providerId;
    else if (p.providerId === preset.providerId) {
      providers.push({
        id: p.providerId,
        provider_source_id: p.sourceId,
        model: p.model,
        enable: true,
        modalities: [],
      });
    }
  }

  cfg.agent_runner = cfg.agent_runner || {};
  cfg.agent_runner.config = cfg.agent_runner.config || {};
  cfg.agent_runner.config.model = cfg.agent_runner.config.model || {};
  cfg.agent_runner.config.model.provider_id = preset.providerId;

  writeJson(CMD_CONFIG, cfg);

  for (const [file, trail] of CHILD_CONFIGS) {
    const full = path.join(CONFIG_DIR, file);
    if (!fs.existsSync(full)) continue;
    const child = readJson(full);
    if (!child) continue;
    let node = child;
    for (const part of trail.slice(0, -1)) {
      node[part] = node[part] || {};
      node = node[part];
    }
    node[trail[trail.length - 1]] = preset.providerId;
    writeJson(full, child);
  }

  return { ok: true, providerId: preset.providerId, label: preset.label };
}

function arkQuota() {
  return new Promise((resolve) => {
    const exe = path.join(process.env.APPDATA || "", "npm", "arkcli.cmd");
    if (!fs.existsSync(exe)) return resolve(null);
    execFile(
      "cmd.exe",
      ["/c", exe, "usage", "plan", "--format", "json"],
      { windowsHide: true, timeout: 40000, maxBuffer: 4 << 20 },
      (err, stdout, stderr) => {
        try {
          const text = `${stdout || ""}${stderr || ""}`;
          const start = text.indexOf("{");
          if (start < 0) return resolve(null);
          const data = JSON.parse(text.slice(start));
          if (data.ok === false) return resolve({ error: "火山登录过期，要 arkcli auth login volc-sso" });
          const periods = data.items?.[0]?.periods || [];
          const pick = (label) => periods.find((p) => p.label === label)?.percent ?? null;
          resolve({
            session: pick("session"),
            weekly: pick("weekly"),
            monthly: pick("monthly"),
          });
        } catch {
          resolve(null);
        }
      },
    );
  });
}

async function deepseekBalance(key) {
  if (!key) return null;
  try {
    const r = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const j = await r.json();
    const b = j.balance_infos?.[0];
    return {
      available: j.is_available !== false,
      balance: b?.total_balance ?? null,
      currency: b?.currency ?? "",
    };
  } catch (e) {
    return { error: e.name || "查询失败" };
  }
}

function restartAstrBot() {
  const bat = path.join(os.tmpdir(), "dsh_api_switch_restart.bat");
  const py = path.join(ASTRBOT, ".venv", "Scripts", "pythonw.exe");
  fs.writeFileSync(
    bat,
    [
      "@echo off",
      "timeout /t 2 /nobreak >nul",
      'wmic process where "name=\'pythonw.exe\' or name=\'python.exe\'" get processid,commandline | findstr /i main.py > "%TEMP%\\dsh_api_pids.txt"',
      'for /f "tokens=2 delims=," %%i in (\'type "%TEMP%\\dsh_api_pids.txt" ^| findstr /r "[0-9][0-9]*"\') do taskkill /f /pid %%i >nul 2>&1',
      "timeout /t 2 /nobreak >nul",
      `cd /d "${ASTRBOT}"`,
      `start "" /b "${py}" main.py >> "${LOG}" 2>&1`,
      "exit",
    ].join("\r\n"),
    "utf8",
  );
  spawn("cmd.exe", ["/c", bat], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

async function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1 << 20) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function isLocal(req) {
  const ip = req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

async function statusPayload() {
  const cfg = readJson(CMD_CONFIG, {});
  const cur = currentOf(cfg);
  const quota = await arkQuota();
  const balance = await deepseekBalance(keyOf(cfg, "deepseek"));
  return {
    ok: true,
    current: cur,
    sources: Object.fromEntries(
      Object.entries(PRESETS).map(([k, p]) => [k, { label: p.label, hasKey: !!keyOf(cfg, k) }]),
    ),
    ark: quota,
    deepseek: balance,
  };
}

export function apply(ctx, config = {}) {
  const handler = async (req, res) => {
    const send = (status, obj) => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(obj));
    };
    if (!isLocal(req)) return send(403, { ok: false, error: "只允许本机" });

    if (req.method === "GET") {
      return send(200, await statusPayload());
    }
    if (req.method !== "POST") return send(405, { ok: false, error: "只支持 GET/POST" });

    const body = await readBody(req);
    const action = body.action || "status";

    if (action === "status") return send(200, await statusPayload());

    if (action === "use") {
      const name = String(body.target || "").toLowerCase();
      if (!PRESETS[name]) return send(400, { ok: false, error: "要切哪家" });
      const r = applySwitch(name);
      if (!r.ok) return send(400, r);
      restartAstrBot();
      return send(200, { ...r, restarting: true });
    }

    if (action === "key") {
      const name = String(body.target || "").toLowerCase();
      const key = String(body.key || "").trim();
      if (!PRESETS[name] || !key) return send(400, { ok: false, error: "用法：target + key" });
      const cfg = readJson(CMD_CONFIG);
      const src = (cfg.provider_sources || []).find((s) => s.id === PRESETS[name].sourceId);
      if (!src) return send(400, { ok: false, error: "这家还没建过源头，先切一次" });
      src.key = [key];
      writeJson(CMD_CONFIG, cfg);
      return send(200, { ok: true });
    }

    if (action === "restart") {
      restartAstrBot();
      return send(200, { ok: true, restarting: true });
    }

    return send(400, { ok: false, error: "不认识的动作" });
  };

  const register = () => ctx.webServer.register({ kind: "exact", path: "/api/api-switch", handler });
  if (typeof ctx.effect === "function") ctx.effect(register, "dsh-api-switch: /api/api-switch");
  else register();

  const log = ctx.logger || console;
  log.info?.("[api-switch] 已挂载：/api/api-switch");
}
