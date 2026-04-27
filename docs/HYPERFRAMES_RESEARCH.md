# Hyperframes 调研摘录

调研日期：2026-04-27

仓库/文档：

- https://github.com/heygen-com/hyperframes
- https://hyperframes.heygen.com/packages/cli
- https://hyperframes.heygen.com/guides/claude-design

## 结论

Hyperframes 对 Vizual Studio 的直接启发不是“现在就做视频”，而是：

1. HTML 可以成为高质量 motion / video / presentation 的源格式。
2. Agent-friendly CLI 比人工交互 CLI 更适合 AI 生态。
3. 结构规则应该技能化、模板化、可 lint，而不是靠长篇说明让 Agent 猜。

## 关键事实

Hyperframes CLI 支持：

- create/init
- preview with hot reload
- render to MP4
- lint
- diagnostics
- website capture
- non-interactive agent mode
- JSON output / `_meta`
- skill install for Claude Code / Gemini / Codex / Cursor

Hyperframes repo 分层包含：

- `cli`
- `core`
- `engine`
- `player`
- `producer`
- `studio`

## 对 Vizual Studio 的启发

### 1. 后续 motion layer 可以独立

不要把 motion/video 直接塞进 Vizual Core。可以先设计：

- `motion` tokens in Design.md。
- slide transition metadata。
- animation-safe constraints。
- optional `vizual-motion` package。

### 2. 导出能力应该命令化

未来 Studio 可以有：

```bash
vizual-studio lint deck.json
vizual-studio render deck.json --format pdf
vizual-studio export deck.json --format html
```

这会比纯 UI 更适合 Agent 和 CI。

### 3. 技能化规则非常重要

Hyperframes 通过 skills 教 Agent 正确写 composition。Vizual/Vizual Studio 也应该：

- 维护冷启动测试。
- 维护 Agent handoff。
- 维护 Studio SDK examples。
- 对 deck artifact 做 lint。

## 暂不集成原因

- 当前主线是 HTML 商业 PPT。
- Hyperframes 主要服务 video/motion render。
- 过早集成会扩大 scope。

## 后续实验

当 deck 主流程稳定后，做一个 `Motion Export Spike`：

1. 从当前 HTML slide 生成 10 秒 executive highlight video。
2. 使用 Design.md motion tokens 控制进入动画。
3. 通过 Hyperframes lint/render 验证 agent-friendly 流程。
