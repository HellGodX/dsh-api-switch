# dsh-api-switch

DSH 右下角的一个小挂件：一眼看到**现在用的是哪家模型**、火山还剩多少、DeepSeek 余额还剩多少，点一下切过去。

配合 AstrBot 用（切换的是 AstrBot 的聊天 provider）。

## 界面

- 右下角一个鲸鱼头像，角标「火 / 余 / 智」表示当前是哪家。
- 点开是面板：当前来源、火山 5 小时 / 本周 / 本月用量、DeepSeek 余额。
- 三个按钮：火山 / 余额 / 智谱，点完直接改配置并重启 AstrBot（约 30 秒）。
- 另有两个小按钮：刷新、重启 AstrBot。
- 可以拖动，位置记在 localStorage。

## 切换改了什么

1. `I:\yuzhuanyong\astrbot\data\cmd_config.json`
   - `provider_sources`：启用本家的 `openai_chat_completion`，关掉别家
   - `provider`：只让本家的模型条目 `enable: true`
   - `agent_runner.config.model.provider_id`：默认模型指向本家
2. `data/config/astrbot_plugin_memory_companion_config.json` 的三个 provider
3. `data/config/astrbot_plugin_private_companion_config.json` 的 `model.provider_id`

embedding 源不动，知识库照常。

## 接口

`GET /api/api-switch` → 状态

```json
{
  "ok": true,
  "current": { "name": "deepseek", "providerId": "deepseek-chat", "label": "DeepSeek 余额" },
  "ark": { "session": 12.3, "weekly": 44.1, "monthly": 60.0 },
  "deepseek": { "available": true, "balance": "6.80", "currency": "CNY" }
}
```

`POST /api/api-switch`

```json
{ "action": "use", "target": "ark" | "deepseek" | "zhipu" }
{ "action": "key", "target": "deepseek", "key": "sk-..." }
{ "action": "restart" }
```

只允许本机调用（127.0.0.1 / ::1）。

## 安装

```bash
cd ~/.dsh/profiles/desktop
node <pnpm> add file:I:/yuzhuanyong/dsh-api-switch
```

或直接把目录拷进 `node_modules/dsh-api-switch`，把 `dsh-api-switch` 加进 `package.json` 的 `dsh.profile.bundles`，然后重启 DSH。

## 说明

- 切换是**改配置 + 重启**，不是热切换。
- 火山用量靠 `arkcli`（`%APPDATA%\npm\arkcli.cmd`）；它登录过期时面板会直说「火山登录过期，要 arkcli auth login volc-sso」，不会假装有数。
- 路径是写给这台机器的（`I:\yuzhuanyong\astrbot`），换机器改 `lib/index.js` 顶部的 `ASTRBOT`。
