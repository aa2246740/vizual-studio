# Roadmap

## 原则

先把 HTML 商业 PPT 做深。Design.md、批注、liveControl、导出、动画都是围绕 deck 服务的能力。

## Milestone 0: Repo Foundation

状态：第一版已完成。

- Vite + React + TypeScript。
- sibling dependency `../vizual`。
- Deck-first Studio shell。
- docs: product definition, architecture, core gaps, agent handoff。

## Milestone 1: Deck MVP

目标：一个真实用户可以打开 Studio，做出一份可展示的 HTML deck 初稿。

范围：

- slide outline。
- 16:9 canvas。
- cover / insight / chart / appendix layouts。
- direct title/body editing。
- Vizual KPI/chart/table blocks。
- speaker notes。
- local persistence。
- print/PDF 和 HTML handoff。

当前第一版已有基础能力，下一步需要：

- drag reorder slides。
- add/delete slide。
- duplicate slide。
- per-slide layout template selector。
- better print CSS for full deck pagination。

## Milestone 2: Design.md For Decks

目标：用户能在 Studio 内建立适合 deck 的 Design.md，并看到所有 Vizual block 响应。

范围：

- palette/radius/shadow/density/motion controls。
- standard Design.md editor。
- mapping report。
- theme preview matrix。

下一步：

- import standard Design.md file。
- export Design.md。
- warning panel for unsupported tokens。
- full token matrix。

## Milestone 3: Review Loop

目标：像 Codex 批注一样，用户可以对 slide/block 发起精确修订。

范围：

- comment target model。
- revision proposal model。
- accept/reject。
- version history。
- new message/new version behavior for old artifacts。

下一步：

- DOM selection to targetMap。
- block-level comments。
- revision diff preview。
- restore previous version。

## Milestone 4: Agent SDK

目标：Agent 不需要猜 DOM；只调用 Studio SDK。

范围：

- `createDeck`
- `applyDesignMd`
- `updateSlideText`
- `replaceVisual`
- `addComment`
- `resolveComment`
- `exportDeck`

验收：

- 冷启动 Agent 只读 skill/docs，也能完成端到端 deck 生成和修订。
- 多个 liveControl/visual blocks 互相隔离。

## Milestone 5: Export & Handoff

目标：商业汇报能离开 Studio。

优先级：

1. standalone HTML。
2. full deck PDF。
3. selected slide PNG。
4. data CSV/XLSX。
5. optional PPTX adapter。

PPTX 不是第一阶段主路径。

## Milestone 6: Motion / Hyperframes Exploration

目标：评估 HTML presentation 是否能升级到商业级 motion/video。

范围：

- motion tokens in Design.md。
- slide transition metadata。
- Hyperframes lint/render pipeline research。
- optional video export prototype。

不在 PPT MVP 阻塞路径上。
