window.__ModuleLoader__.load({
  id: "dsh-api-switch",
  // 跟 dsh-study 同一个形状：loader 要的是「模块对象上带 apply」，
  // 直接 return 一个字面量对象会被判成 invalid plugin（整个界面锁死）。
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const { useState, useEffect, useCallback } = react;
    const h = react.createElement;

    const API = "/api/api-switch";
    const POS_KEY = "dsh-api-switch:widget-pos";

    const WHALE =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<path d="M8 36c0-12 10-20 22-20 8 0 13 3 17 7l8-4-2 9c2 3 3 6 3 9 0 11-10 18-24 18S8 47 8 36z" fill="#2b5f8f"/>' +
          '<circle cx="22" cy="32" r="2.6" fill="#fff"/>' +
          '<path d="M14 22c2-6 7-9 12-9" stroke="#8fd0ff" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<path d="M40 52c-2 4-1 6 2 8" stroke="#2b5f8f" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          "</svg>",
      );

    const state = { data: null, open: false, busy: false };

    async function readJSON(res) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`宿主路由没挂上（HTTP ${res.status}）`);
      }
    }

    async function get() {
      const res = await fetch(API, { cache: "no-store" });
      return readJSON(res);
    }

    async function post(payload) {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJSON(res);
    }

    // ---------- 样式 ----------
    const css = document.createElement("style");
    css.id = "dsh-api-switch-style";
    css.textContent = `
      #dsh-api-switch-root { position: fixed; right: 18px; bottom: 96px; z-index: 2147482999;
        display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        font: 12px/1.5 ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
      #dsh-api-switch-avatar { width: 46px; height: 46px; cursor: pointer; border-radius: 50%;
        background: #0d1b2a; padding: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
      #dsh-api-switch-avatar img { width: 100%; height: 100%; display: block; }
      #dsh-api-switch-badge { position: absolute; right: -2px; top: -2px; min-width: 16px; height: 16px;
        border-radius: 8px; background: #2b5f8f; color: #fff; font-size: 10px; line-height: 16px;
        text-align: center; padding: 0 4px; }
      #dsh-api-switch-panel { display: none; width: 236px; background: #0d1b2a; color: #dce9f5;
        border: 1px solid #24405c; border-radius: 12px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
      #dsh-api-switch-panel.open { display: block; }
      #dsh-api-switch-panel h4 { margin: 0 0 6px; font-size: 13px; color: #fff; }
      #dsh-api-switch-panel .row { margin: 4px 0; color: #9fb8cd; }
      #dsh-api-switch-panel .row b { color: #e8f3ff; font-weight: 600; }
      #dsh-api-switch-panel .btns { display: flex; gap: 6px; margin-top: 10px; }
      #dsh-api-switch-panel button { flex: 1; cursor: pointer; border: 1px solid #2f5578;
        background: #14283c; color: #dce9f5; border-radius: 8px; padding: 6px 0; font-size: 12px; }
      #dsh-api-switch-panel button:hover { background: #1c3550; }
      #dsh-api-switch-panel button.primary { background: #2b5f8f; border-color: #3d7bb5; }
      #dsh-api-switch-panel .err { color: #ff9a9a; margin-top: 6px; word-break: break-all; }
    `;
    document.head.appendChild(css);

    const root = document.createElement("div");
    root.id = "dsh-api-switch-root";

    const panel = document.createElement("div");
    panel.id = "dsh-api-switch-panel";

    const avatar = document.createElement("div");
    avatar.id = "dsh-api-switch-avatar";
    avatar.style.position = "relative";
    avatar.title = "切换模型";
    const img = document.createElement("img");
    img.src = WHALE;
    img.alt = "切换模型";
    const badge = document.createElement("span");
    badge.id = "dsh-api-switch-badge";
    badge.textContent = "";
    badge.style.display = "none";
    avatar.appendChild(img);
    avatar.appendChild(badge);

    root.appendChild(panel);
    root.appendChild(avatar);

    function el(tag, cls, text) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }

    function fmt(n) {
      return n == null ? "—" : `${Math.round(Number(n))}%`;
    }

    function render() {
      panel.innerHTML = "";
      const d = state.data;
      panel.appendChild(el("h4", null, "模型开关"));
      if (!d) {
        panel.appendChild(el("div", "row", "读不到状态"));
      } else {
        panel.appendChild(el("div", "row", `现在：${d.current?.label || "未知"}`));
        if (d.ark && !d.ark.error) {
          panel.appendChild(
            el(
              "div",
              "row",
              `火山 5h ${fmt(d.ark.session)} · 周 ${fmt(d.ark.weekly)} · 月 ${fmt(d.ark.monthly)}`,
            ),
          );
        } else {
          panel.appendChild(el("div", "row", d.ark?.error || "火山 读不到额度"));
        }
        if (d.deepseek && !d.deepseek.error) {
          panel.appendChild(
            el(
              "div",
              "row",
              `DeepSeek ${d.deepseek.available ? "" : "（不可用）"}${d.deepseek.balance ?? "—"} ${d.deepseek.currency || ""}`,
            ),
          );
        } else {
          panel.appendChild(el("div", "row", "DeepSeek 没配钥匙或查不到"));
        }
        const btns = el("div", "btns");
        for (const [key, label] of [
          ["ark", "火山"],
          ["deepseek", "余额"],
          ["zhipu", "智谱"],
        ]) {
          const b = el("button", d.current?.name === key ? "primary" : null, label);
          b.onclick = () => use(key);
          btns.appendChild(b);
        }
        panel.appendChild(btns);
        const btns2 = el("div", "btns");
        const rf = el("button", null, "刷新");
        rf.onclick = () => load();
        btns2.appendChild(rf);
        const rs = el("button", null, "重启 AstrBot");
        rs.onclick = () => act({ action: "restart" });
        btns2.appendChild(rs);
        panel.appendChild(btns2);
        badge.textContent = d.current?.name === "ark" ? "火" : d.current?.name === "deepseek" ? "余" : "智";
        badge.style.display = "block";
      }
    }

    async function load() {
      try {
        state.data = await get();
      } catch (e) {
        state.data = null;
        panel.innerHTML = "";
        panel.appendChild(el("h4", null, "模型开关"));
        panel.appendChild(el("div", "err", String(e.message || e)));
      }
      render();
    }

    async function act(payload) {
      if (state.busy) return;
      state.busy = true;
      try {
        const r = await post(payload);
        if (!r.ok) throw new Error(r.error || "失败");
        if (r.restarting) {
          panel.innerHTML = "";
          panel.appendChild(el("h4", null, "切过去了"));
          panel.appendChild(el("div", "row", "AstrBot 正在重启，约 30 秒"));
        } else {
          await load();
        }
      } catch (e) {
        const err = el("div", "err", String(e.message || e));
        panel.appendChild(err);
      } finally {
        state.busy = false;
      }
    }

    function use(name) {
      act({ action: "use", target: name });
    }

    avatar.onclick = () => {
      state.open = !state.open;
      panel.classList.toggle("open", state.open);
      if (state.open) load();
    };

    // 拖动
    let drag = null;
    avatar.onmousedown = (ev) => {
      drag = { x: ev.clientX, y: ev.clientY, rect: root.getBoundingClientRect() };
    };
    window.addEventListener("mousemove", (ev) => {
      if (!drag) return;
      const right = Math.max(4, window.innerWidth - drag.rect.right - (ev.clientX - drag.x));
      const bottom = Math.max(4, window.innerHeight - drag.rect.bottom + (drag.y - ev.clientY));
      root.style.right = `${right}px`;
      root.style.bottom = `${bottom}px`;
    });
    window.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = null;
      try {
        localStorage.setItem(
          POS_KEY,
          JSON.stringify({ bottom: root.style.bottom, right: root.style.right }),
        );
      } catch {
        /* ignore */
      }
    });
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved?.bottom) root.style.bottom = saved.bottom;
      if (saved?.right) root.style.right = saved.right;
    } catch {
      /* ignore */
    }

    // 把挂件钉到窗口右下角。桌面端 body 可能被 transform 过，fixed 会跑偏，
    // 所以用「先量一次基准再补差值」的办法硬摆位置。
    function placeWidget() {
      try {
        if (!document.body) return;
        const pad = 18;
        const size = 54;
        root.style.right = "auto";
        root.style.bottom = "auto";
        root.style.left = "0px";
        root.style.top = "0px";
        const base = root.getBoundingClientRect();
        const w = window.innerWidth || document.documentElement.clientWidth || 1440;
        const h = window.innerHeight || document.documentElement.clientHeight || 900;
        const targetX = Math.max(pad, w - size - pad);
        const targetY = Math.max(pad, h - size - 96);
        root.style.left = Math.round(targetX - base.x) + "px";
        root.style.top = Math.round(targetY - base.y) + "px";
        const after = root.getBoundingClientRect();
        if (after.x < 0 || after.x + after.width > w) {
          root.style.left = Math.round(targetX - base.x - after.x) + "px";
        }
        probe("placed", JSON.stringify({ w, h, base: [Math.round(base.x), Math.round(base.y)], after: [Math.round(after.x), Math.round(after.y)] }));
      } catch (e) {
        probe("place-error", String((e && e.message) || e));
      }
    }
    function isMounted() {
      return !!(document && document.body && root.isConnected && document.body.contains(root));
    }

    function ensureMount(tries = 40, force = false) {
      if (!document.body) {
        if (tries > 0) setTimeout(() => ensureMount(tries - 1, force), 250);
        return false;
      }
      if (!force && isMounted()) return true;
      try {
        if (root.parentNode !== document.body) document.body.appendChild(root);
      } catch (e) {
        probe("mount-error", String((e && e.message) || e));
        return false;
      }
      placeWidget();
      setTimeout(placeWidget, 600);
      setTimeout(placeWidget, 2000);
      try { window.addEventListener("resize", placeWidget); } catch (e) {}
      probe("mounted-root", "bodyChildren=" + document.body.children.length + (force ? " forced" : ""));
      try {
        const cs = getComputedStyle(root);
        const rc = root.getBoundingClientRect();
        probe("style", JSON.stringify({ styleTag: !!document.getElementById("dsh-api-switch-style"), pos: cs.position, disp: cs.display, vis: cs.visibility, op: cs.opacity, z: cs.zIndex, rect: [Math.round(rc.x), Math.round(rc.y), Math.round(rc.width), Math.round(rc.height)], sheets: document.styleSheets.length }));
      } catch (e) { probe("style-error", String((e && e.message) || e)); }
      load();
      return true;
    }

    // 自愈：前端如果被重渲染冲掉，隔一会儿自己补回来（前台出不来时不用重启）。
    function startWatchdog() {
      setInterval(() => {
        try {
          if (!isMounted()) ensureMount(10, true);
        } catch (e) {}
      }, 15000);
      setInterval(() => {
        try {
          if (state.open && isMounted()) load();
        } catch (e) {}
      }, 30000);
    }
    // ---- 插件页「配置」面板 ------------------------------------------
    // 插件页里点 dsh-api-switch 卡片时渲染这里；数据与右下角挂件同源（GET/POST /api/api-switch）。

    const TONE = {
      text: "#a8bccf",
      strong: "#eaf2f9",
      surface: "rgba(255,255,255,.055)",
      border: "rgba(255,255,255,.14)",
      hot: "#ff8b8b",
      ok: "#4cc46a",
      key: "#5aa9e6",
    };

    const BTN = {
      appearance: "none",
      border: "1px solid " + TONE.border,
      background: TONE.surface,
      color: TONE.strong,
      borderRadius: 8,
      padding: "6px 14px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
    };

    function pctText(n) {
      return typeof n === "number" && isFinite(n) ? Math.round(n * 10) / 10 + "%" : "—";
    }

    function Channel({ label, detail, active, busy, onPick, pickable }) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            marginBottom: 8,
            borderRadius: 10,
            border: "1px solid " + (active ? "rgba(61,123,181,.75)" : TONE.border),
            background: active ? "rgba(43,95,143,.20)" : "transparent",
          },
        },
        h("span", {
          style: {
            width: 8,
            height: 8,
            flex: "0 0 auto",
            borderRadius: 8,
            background: active ? TONE.ok : TONE.border,
          },
        }),
        h(
          "div",
          { style: { flex: "1 1 auto", minWidth: 0 } },
          h(
            "div",
            { style: { fontSize: 13, fontWeight: 600, color: TONE.strong } },
            label,
            active
              ? h(
                  "span",
                  {
                    style: {
                      marginLeft: 8,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "1px 6px",
                      borderRadius: 6,
                      color: TONE.ok,
                      border: "1px solid rgba(76,196,106,.55)",
                    },
                  },
                  "当前",
                )
              : null,
          ),
          h(
            "div",
            { style: { fontSize: 12, color: TONE.text, marginTop: 2, lineHeight: 1.6 } },
            detail,
          ),
        ),
        h(
          "button",
          {
            type: "button",
            style: { ...BTN, flex: "0 0 auto", opacity: active || busy ? 0.55 : 1 },
            disabled: !!busy || active || !pickable,
            onClick: onPick,
          },
          busy ? "切换中…" : active ? "已启用" : pickable ? "切换" : "未配置",
        ),
      );
    }

    function ConfigPanel() {
      const [data, setData] = useState(null);
      const [error, setError] = useState("");
      const [busy, setBusy] = useState("");
      const [at, setAt] = useState(0);

      const load = useCallback(async (manual) => {
        if (manual) setBusy("__load");
        try {
          const res = await fetch(API, { cache: "no-store" });
          const json = await res.json();
          if (!res.ok) setError(json?.error || "HTTP " + res.status);
          else setError("");
          setData(json);
          setAt(Date.now());
        } catch (e) {
          setError(String((e && e.message) || e));
        } finally {
          if (manual) setBusy("");
        }
      }, []);

      useEffect(() => {
        load(false);
        const timer = setInterval(() => load(false), 30000);
        return () => clearInterval(timer);
      }, [load]);

      const pick = useCallback(
        async (name) => {
          setBusy(name);
          try {
            const res = await fetch(API, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const json = await res.json();
            if (!res.ok || json?.ok === false) setError(json?.error || "切换失败");
            else {
              setError("");
              await load(false);
            }
          } catch (e) {
            setError(String((e && e.message) || e));
          } finally {
            setBusy("");
          }
        },
        [load],
      );

      const currentKey = data?.current?.key || data?.current?.name || "";
      const cur = String(currentKey || "").toLowerCase();
      const isArk = cur.includes("ark") || cur.includes("volc") || cur.includes("火山");
      const isDs = cur.includes("deepseek");
      const isZp = cur.includes("zhipu") || cur.includes("智谱");

      const arkDetail =
        data?.ark && !data.ark.error
          ? "5 小时 " + pctText(data.ark.session) + " · 本周 " + pctText(data.ark.weekly) + " · 本月 " + pctText(data.ark.monthly)
          : data?.ark?.error || "读不到额度";

      const dsDetail =
        data?.deepseek && !data.deepseek.error
          ? "余额 " + (data.deepseek.balance ?? "—") + " " + (data.deepseek.currency || "")
          : data?.deepseek?.error || "没配钥匙或查不到";

      const has = (k) => !!(data?.presets && data.presets[k] && data.presets[k].hasKey);

      const time = at ? new Date(at).toLocaleTimeString("zh-CN", { hour12: false }) : "—";

      return h(
        "div",
        { style: { padding: "18px 20px", maxWidth: 620, fontSize: 13, color: TONE.strong } },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 14,
              borderRadius: 10,
              border: "1px solid " + TONE.border,
              background: TONE.surface,
            },
          },
          h(
            "div",
            { style: { minWidth: 0 } },
            h("div", { style: { fontSize: 12, color: TONE.text } }, "现在走"),
            h(
              "div",
              { style: { fontSize: 16, fontWeight: 600, marginTop: 2 } },
              data?.current?.label || "未知",
            ),
          ),
          h(
            "button",
            {
              type: "button",
              style: { ...BTN, flex: "0 0 auto", opacity: busy === "__load" ? 0.6 : 1 },
              disabled: !!busy,
              onClick: () => load(true),
            },
            busy === "__load" ? "刷新中…" : "刷新",
          ),
        ),
        h(Channel, {
          label: "火山方舟",
          detail: arkDetail,
          active: isArk,
          busy: busy === "ark",
          pickable: has("ark") || !data?.presets,
          onPick: () => pick("ark"),
        }),
        h(Channel, {
          label: "DeepSeek 余额",
          detail: dsDetail,
          active: isDs,
          busy: busy === "deepseek",
          pickable: has("deepseek") || !data?.presets,
          onPick: () => pick("deepseek"),
        }),
        h(Channel, {
          label: "智谱",
          detail: has("zhipu") ? "已配钥匙" : "未配钥匙",
          active: isZp,
          busy: busy === "zhipu",
          pickable: has("zhipu"),
          onPick: () => pick("zhipu"),
        }),
        error
          ? h(
              "div",
              {
                style: {
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  color: TONE.hot,
                  border: "1px solid rgba(255,139,139,.45)",
                  background: "rgba(255,139,139,.10)",
                  wordBreak: "break-all",
                },
              },
              error,
            )
          : null,
        h(
          "div",
          { style: { marginTop: 12, fontSize: 11, color: TONE.text } },
          "每 30 秒自动刷新 · 最近更新 " + time + " · 只改配置，不动对话",
        ),
        h(
          "div",
          { style: { display: "flex", gap: 10, alignItems: "center", marginTop: 12 } },
          h("div", { style: { fontSize: 12, color: TONE.text, marginRight: 4 } }, "右下角挂件"),
          h(
            "button",
            {
              type: "button",
              style: { ...BTN, padding: "4px 12px" },
              onClick: () => {
                ensureMount(20, true);
                setAt(Date.now());
              },
            },
            "显示",
          ),
          h(
            "button",
            {
              type: "button",
              style: { ...BTN, padding: "4px 12px" },
              onClick: () => {
                try {
                  root.remove();
                } catch (e) {}
                setAt(Date.now());
              },
            },
            "隐藏",
          ),
        ),
      );
    }
    let mounted = false;

    exports.inject = ["slots"];
    function probe(stage, extra) {
      try {
        fetch("http://127.0.0.1:9393/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify([{ source: "apiprobe", text: stage + " | " + (extra || "") + " | href=" + location.href + " | " + new Date().toISOString() }]),
        }).catch(function () {});
      } catch (e) {}
    }
    exports.apply = function apply(ctx) {
      if (mounted) return;
      mounted = true;
      probe("apply-enter", "slots=" + !!(ctx && ctx.slots));
      try {
        window.addEventListener("error", function (e) {
          probe("window-error", String((e && e.message) || e));
        });
        window.addEventListener("unhandledrejection", function (e) {
          probe("unhandled-rejection", String((e && e.reason) || e));
        });
      } catch (e) {}
      if (ctx && ctx.slots && typeof ctx.slots.inject === "function") {
        ctx.slots.inject("plugins.bundle.config", function () {
          return ctx.slots.register({ name: "plugins.bundle.config", key: "dsh-api-switch" }, function () {
            return h(ConfigPanel, null);
          });
        });
      }
      startWatchdog();
      ensureMount();
    };
    return module.exports;
  },
});
