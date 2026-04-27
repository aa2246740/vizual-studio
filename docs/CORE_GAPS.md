# Vizual Core Gap 清单

这个文档只记录 Studio 推动出来的 Core 缺口。最新边界：Core 做 AI Agent 可视化运行时基础能力，不引入 PPT、Deck、Slide 产品语义。

## 当前状态

截至 2026-04-27，Vizual Core 已经把通用 artifact、TargetRef、Review/Revision、Agent Bridge、Design.md mapping report、liveControl 隔离和导出原语合入 `aa2246740/vizual` main。Studio 当前通过 GitHub dependency 使用该远端版本。

本文件继续保留为 Studio 视角的边界清单：哪些能力应留在 Core，哪些能力必须留在 Studio。

## 已明确不下沉到 Core

- Deck schema
- Slide schema
- PPT 模板
- 项目中心
- 页面缩略图、拖拽排序、演示模式
- 全 deck 导出

这些属于 Vizual Studio 或其他上层应用。

## P0：Core 通用协议

### 1. Generic Artifact

Core 需要稳定描述可渲染、可更新、可导出、可追溯的 Vizual 输出。

需要覆盖：

- `kind: spec | docview | liveControl | interactive`
- `spec`
- `targetMap`
- `versions`
- `exports`
- `source`
- `metadata`
- `lastError`

### 2. TargetRef

批注、修订、导出和历史追问都需要统一 target，不绑定 slide/block。

需要覆盖：

- `artifactId`
- `targetId`
- `path`
- `quote`
- `contextBefore/contextAfter`
- `meta`

### 3. Review / Revision

DocView 的批注循环要抽象成 artifact 级协议。

需要覆盖：

- review thread
- comment
- proposal
- patch list
- accept / reject / apply
- resolved / rejected / orphaned

### 4. Agent Bridge

冷启动 Agent 不应该靠猜 DOM。Core bridge 要管理：

- artifact registry
- messageId ↔ artifactId
- 新气泡 revision
- artifact history
- review threads
- revision proposals
- liveControl sessions
- export records
- error state

## P1：Design.md 和 liveControl

### 5. Design.md Mapping Report

`loadDesignMd()` 需要暴露稳定 report：

- token count
- mapped count
- fallback count
- unsupported token list
- warning list
- quality score
- mapped/fallback variable list

原因：

- 用户需要知道“这个设计系统哪些被 runtime 吃进去了，哪些没有”。
- Agent 需要知道下一轮怎么修正设计输入。

### 6. liveControl Schema

liveControl 要正式化为 Core 协议，而不是测试页私有实现。

需要覆盖：

- controls schema
- `$bindState`
- `statePath`
- field dependency / visibility
- state patch
- scope isolation
- computed function

多个 liveControl artifact 必须互不影响。

## P2：Export 原语

Core 只做单个可视化元素和数据导出：

- element PNG
- element PDF
- data CSV
- data XLSX
- export record
- failure record
- width/height/metadata

不做：

- PPTX
- full deck PDF
- full deck HTML bundle

这些由 Studio 或其他上层应用组合。

## P3：Motion 方向

Hyperframes 提醒我们 HTML 内容可以继续走向 motion/video。Core 可以预留但不阻塞主线：

- motion token
- transition metadata
- render-safe animation constraints

短期只归档研究，不集成。
