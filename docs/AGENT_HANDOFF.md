# Agent Handoff

给接手这个仓库的 Agent 先读。

## 你在做什么

你不是在改 Vizual Core，也不是在做通用网页设计器。

你在做 Vizual Studio：Vizual Core 之上的产品层，第一阶段目标是 **商业级 HTML PPT 工作台**。

## 当前用户目标

用户希望：

- AI Agent 的输出不再是纯文字/Markdown，而是图文并茂、可交互、可批注。
- 基于标准 Design.md，生成商业级、品牌一致的报告和 PPT。
- 用户能直接在页面改文字。
- 用户能批注某一页/某一块，让 Agent 修订。
- 样式、布局、图表类型、数据筛选由 Agent 通过 patch 修改。
- HTML 是第一源格式，PPTX 以后再说。

## 当前实现

入口：`src/App.tsx`

已有：

- Deck Studio 默认首页。
- 16:9 slide canvas。
- slide outline。
- direct text edit。
- VizualRenderer 嵌入 KPI/chart/table。
- Design.md liveControl。
- Review Loop。
- HTML handoff + print/PDF。
- localStorage persistence。

## Core 边界

用 Vizual Core 做：

- `VizualRenderer`
- `loadDesignMd`
- charts/tables/KPIs/layouts
- DocView/review primitives when needed
- liveControl model when needed
- artifact/export primitives

不要在 Studio 里重新造：

- 图表组件
- theme parser
- runtime renderer
- generic artifact store

可以先在 Studio 里验证：

- deck artifact
- slide templates
- review UX
- export UX
- agent action SDK

稳定后再下沉到 Core。

## Claude Design 参考点

必须借鉴：

- 左侧对话/任务流 + 右侧持久画布。
- Design system 先建立，之后每个项目自动继承。
- 文字直接编辑。
- inline comments 精确指向对象。
- custom sliders / tweaks 让用户能不用写 prompt 调样式。
- export/handoff 是主流程，不是最后补丁。

必须避免：

- 评论丢失或 Agent 没读到。
- Agent 静默覆盖用户历史产物。
- 只生成看起来漂亮但不可审计的页面。
- 用自然语言猜 Design.md 结果，不暴露 mapping report。

## Hyperframes 参考点

Hyperframes 不是当前依赖，但值得学习：

- CLI 非交互，适合 Agent。
- lint/render/preview 都是命令化流程。
- HTML 可以成为 video/motion/presentation 的源格式。
- skills 比长文档更能让 Agent 稳定执行结构规则。

## 开发命令

```bash
npm install
npm run lint
npm run build
npm run dev -- --host 127.0.0.1 --port 4174
```

本地目录预期：

```text
/Users/wu/Documents/New project/
  vizual/
  vizual-studio/
```

## 下一步优先级

1. 完善 Deck MVP：加/删/复制/拖拽 slide。
2. 完善 full deck print/PDF。
3. 做正式 Agent action SDK。
4. 做 block-level targetMap。
5. 做真实 comment selection 和 revision diff。
6. 再考虑 Hyperframes/motion。
