window.__ModuleLoader__.load({
  id: "dsh-api-switch",
  // 跟 dsh-study 同一个形状：loader 要的是「模块对象上带 apply」，
  // 直接 return 一个字面量对象会被判成 invalid plugin（整个界面锁死）。
  factory: () => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

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

    function ensureMount(tries = 40) {
      if (!document.body) {
        if (tries > 0) setTimeout(() => ensureMount(tries - 1), 250);
        return;
      }
      document.body.appendChild(root);
      load();
      setInterval(() => {
        if (state.open) load();
      }, 30000);
    }
    let mounted = false;

    exports.inject = ["slots"];
    exports.apply = function apply() {
      if (mounted) return;
      mounted = true;
      ensureMount();
    };
    return module.exports;
  },
});
