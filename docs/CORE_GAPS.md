# Vizual Core Gap 清单

这个文档只记录 Studio 推动出来的 Core 缺口。不是所有缺口都要立刻下沉到 Core；先在 Studio 验证，稳定后再抽象。

## P0

### 1. Deck Artifact Schema

当前 Core 有 spec/docview/liveControl/artifact，但没有 first-class deck。

需要：

- `kind: 'deck'`
- slides
- blocks
- speaker notes
- theme/designMd
- targetMap
- versions
- exports

为什么重要：

- 历史对话里的 deck 需要可追溯和可再次修改。
- 用户三天后说“把这张图改成折线图，只看华东区，再导出 PDF/HTML”，Agent 必须能找到对应 artifact 和 target。

### 2. Slide / Block Target Map

DocView 已经有 section/annotation 概念。Deck 需要类似但更细：

- `slide:<id>`
- `block:<id>`
- `visual:<id>`
- `text:<id>`
- `data:<id>`

目标：

- 评论能落在明确对象上。
- Agent patch 不需要猜 DOM。
- Export/版本/审计能追溯到具体块。

### 3. Generic Review Model

DocView 的批注能力应该抽象成 artifact 级评论模型，而不是只服务文档。

需要：

- comment target
- quote/context
- status
- proposal
- accepted/rejected
- resolved/unresolved

### 4. Export Surface API

当前导出能力已经存在，但 deck 需要标准化入口：

- export current slide PNG/PDF
- export full deck PDF
- export standalone HTML bundle
- export selected data CSV/XLSX

PPTX 暂缓，不作为第一阶段验收标准。

## P1

### 5. Inline Text Editing SDK

Studio 需要直接在画布改字。可以先在 Studio 实现，后续如果 DocView/其他 artifact 也需要，再下沉到 Core。

需要：

- editable text block
- commit/cancel
- targetMap integration
- version history
- conflict handling

### 6. Design.md Mapping Report

`loadDesignMd()` 应暴露稳定的 mapping report UX contract。

需要：

- token count
- mapped count
- fallback count
- unsupported token list
- warning list
- confidence/quality score

原因：

- 用户需要知道“这个 Design.md 哪些被 runtime 吃进去了，哪些没有”。
- Agent 需要知道下一轮应该怎么修正 Design.md。

### 7. Complete Design.md liveControl Matrix

Studio 当前只控制核心 token。后续需要覆盖：

- palette
- typography scale
- spacing scale
- radius
- shadows
- chart palette
- semantic states
- buttons
- cards
- tables
- slide layout rules
- motion preference

## P2

### 8. Agent Action Protocol

冷启动 Agent 不应该靠猜页面 DOM。需要正式 SDK：

```ts
studio.applyAction({ type: 'replaceVisual', slideId, visual, spec })
studio.addComment({ target, quote, request })
studio.resolveComment(commentId, proposal)
studio.exportDeck({ format: 'pdf' })
```

### 9. Motion Layer

Hyperframes 提醒我们 HTML 可以进一步变成 motion/video。Core 可能需要：

- motion tokens
- timeline metadata
- transition metadata
- render-safe animation constraints

但这不应阻塞 PPT 第一版。

### 10. Presentation Layout Primitives

如果 Studio 内的 slide templates 稳定，可以迁移到 Core：

- cover
- executive summary
- title + chart
- KPI + narrative
- comparison
- appendix table

当前先留在 Studio。

## 决策原则

- Studio 先验证用户旅程。
- Core 只吸收可复用、稳定、跨应用的原语。
- 不把 AI parser/creator 放进 runtime。
- 不为了 PPTX 牺牲 HTML-first 表达力。
