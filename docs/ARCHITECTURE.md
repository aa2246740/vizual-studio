# 架构

## 边界

```text
vizual/
  Core runtime:
  - VizualRenderer / renderSpec
  - 31 visualization components
  - Design.md parser + mapper + theme registry
  - DocView
  - liveControl
  - Agent bridge
  - export primitives

vizual-studio/
  Product application:
  - HTML deck workspace
  - Design.md control UX
  - slide canvas
  - review / revision loop
  - export UX
  - future collaboration and persistence
```

Core 不依赖 Studio。Studio 可以推动 Core 补能力，但必须先在应用层验证 shape。

## 当前运行层

### 1. Studio Shell

职责：

- 工作区导航。
- 项目状态。
- 本地持久化。
- 未来账号、权限、项目列表。

当前实现：

- `Deck Studio`
- `Design.md`
- `Review Loop`
- localStorage 保存第一版项目状态。

### 2. Deck Layer

职责：

- HTML-first deck artifact。
- 16:9 slide canvas。
- slide outline。
- 直接文本编辑。
- Vizual block 嵌入。

当前实现：

```ts
type Slide = {
  id: string
  layout: 'cover' | 'insight' | 'chart' | 'appendix'
  visual: 'kpi' | 'combo' | 'line' | 'table'
  status: 'draft' | 'review' | 'approved'
  kicker: string
  title: string
  body: string
  speakerNote: string
}
```

后续应演进为：

```ts
type DeckArtifact = {
  kind: 'deck'
  id: string
  title: string
  designMd: string
  slides: SlideArtifact[]
  targetMap: DeckTarget[]
  versions: DeckVersion[]
  exports: ExportRecord[]
}
```

### 3. Design System Layer

职责：

- 生成标准 Design.md。
- 通过 liveControl 控制 Design.md 参数。
- 调用 `loadDesignMd(markdown, { apply: true })` 应用到 Vizual runtime。
- 展示 mapping report。

边界：

- 标准 Design.md 是 runtime 输入。
- 非标准设计描述不由 runtime 猜测，应由 Agent parser/creator 归一化。

### 4. Review Layer

职责：

- 评论。
- 修订 proposal。
- accept/reject。
- 版本历史。

当前实现是本地模拟，目的是把用户旅程和数据结构先跑通。

未来要与 Vizual Core 的 artifact patch、DocView annotation、Agent bridge 合并成统一协作模型。

### 5. Export Layer

当前：

- 浏览器 print/PDF。
- 下载轻量 HTML handoff。

未来：

- 当前 slide PNG/PDF。
- 全 deck PDF。
- standalone HTML bundle。
- 可选 PPTX adapter。

## Agent 集成方式

Studio 不要求 Agent “会写 React”。Agent 应该输出 typed actions：

```ts
type StudioAgentAction =
  | { type: 'createDeck'; brief: string; dataRef?: string }
  | { type: 'updateSlideText'; slideId: string; field: 'title' | 'body'; value: string }
  | { type: 'replaceVisual'; slideId: string; visual: 'kpi' | 'combo' | 'line' | 'table'; spec?: unknown }
  | { type: 'applyDesignMd'; markdown: string }
  | { type: 'respondToComment'; commentId: string; proposal: unknown }
  | { type: 'exportDeck'; format: 'html' | 'pdf' | 'png' }
```

第一版 UI 里的 “AI Controls” 是这些 action 的可视化占位。

## 从 Claude Design 借鉴但不照搬

借鉴：

- chat + persistent canvas。
- direct text edit。
- inline comments。
- custom sliders。
- design system context。
- export/handoff。

不照搬：

- 泛设计工具定位。
- 只靠自然语言生成不可审计结果。
- 把 Design.md inference 当成真理。

## Hyperframes 的架构启发

Hyperframes 的结构是 CLI/core/engine/player/producer/studio 分层。对 Vizual Studio 的启发：

- Studio 可以先做编辑器，渲染和导出能力保持可拆分。
- 后续 motion/export 可以独立成 `vizual-motion` 或 `studio-motion`。
- CLI/SDK 要适合 Agent：非交互、可 lint、可诊断、输出 JSON。
