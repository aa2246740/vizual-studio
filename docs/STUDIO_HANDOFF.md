# Vizual Studio 交接

> Vizual Core 已经回到远端 main。Studio 当前继续作为 Vizual 之上的上层应用开发，不把 PPT/Deck/Slide 语义下沉到 Core。

## 产品愿景

Vizual Studio 是面向内部种子用户的 AI 协作式商业 PPT 平台。它的目标不是替代 PowerPoint，也不是做泛化网页设计器，而是让用户和 Agent 一起完成“高质量商业汇报”的生成、编辑、批注、修订和交付。

源格式以 HTML 为主，Vizual Core 负责图表、表格、KPI、DocView、Design.md、liveControl、artifact、导出原语；Studio 负责项目、模板、页面编辑、Agent 协作和 PPT 用户旅程。

## 当前已做

- Vite + React 单页应用，默认语言为中文。
- 首页：模板入口、最近项目、从模板开始。
- 16:9 HTML slide 工作台。
- 左侧页面缩略图、中央画布、右侧 Agent 协作面板。
- 编辑模式：文字块可直接在画布上编辑。
- 圈画 / 点选模式：画布标注、底部说明输入、队列批量提交给 Agent。
- 图片占位块：支持风格、缩放和横向裁剪感微调。
- VizualRenderer 嵌入 KPI、图表、表格。
- 设计风格库：用普通用户语言管理多套可复用设计风格，支持创建、复制、删除、切换和绑定到当前 PPT；内部基于 `loadDesignMd()` 应用到 Vizual runtime。
- 基础 liveControl：当前选中对象拥有文字排版 / 尺寸 / 容器属性面板，图表和图片有专属展示参数。
- 批注/修订闭环第一版：用户提交目标化修改，Agent 先生成可审阅修订提案，用户接受后才写回画布。
- 稳定目标引用第一版：页面、标题、正文、图表、图片会进入 `targetRef`，供浏览器 Agent 读取和追踪。
- 本地 `localStorage` 保存项目状态。
- 依赖远端 Vizual Core GitHub 提交，不使用本地 `file:../vizual`。

## 明确未做

- 项目中心、团队空间、搜索、权限、分享还未做成完整工作流。
- 设计风格导入/导出、完整 token matrix、风格版本历史尚未完整产品化。
- 更细粒度 block-level target map：当前稳定到页面对象级，尚未到文本选区、图表数据点、表格单元格。
- 完整批注循环：当前是 Studio 内第一版协议，后续需要和 Core 的 generic Review/Revision 协议对齐。
- 完整版本历史和可回滚 diff。
- 高质量全 deck PDF/PNG/HTML bundle 导出暂缓，当前阶段不做。
- PPTX 导出暂缓。
- Hyperframes/motion 暂不集成。

## Core 完善后 Studio 下一步

1. 接入 Core `Artifact` / `TargetRef` / `Review` / `Revision`，替换页面内临时 comment/revision 状态。
2. 接入 Core `createAgentBridge()` 的 artifact history、new bubble revision、export record、error state。
3. 把设计系统页面改为普通用户语言，不暴露“Design.md”术语；内部仍导入/导出标准 Design.md。
4. 首页补全：模板开始、最近项目、从空白开始、从数据开始。
5. PPT 编辑器补全：加/删/复制/拖拽页面、元素选择、文字框约束、图片替换/裁剪、图表仅走批注让 Agent 改。
6. 右侧 Agent 面板与批注合并：批注是带 target/context 的对话消息。
7. 导出先做 HTML/PDF/PNG，PPTX 作为后续适配器。

## Core / Studio 边界

Core 做：

- JSON/Vizual artifact runtime
- 组件渲染
- Design.md 标准解析和主题映射
- liveControl 协议和状态隔离
- 通用 Review/Revision 协议
- 单个 artifact 的 PNG/PDF/CSV/XLSX 导出原语
- Agent bridge 状态层

Studio 做：

- PPT 模板、项目中心、页面管理
- 16:9 canvas 和页面编辑体验
- 用户旅程、Agent 协作、权限、分享
- 全 deck 导出和交付体验
- Studio-specific deck schema

## 当前工作目录

```text
/Users/wu/Documents/New project/
  vizual/          # Core
  vizual-studio/   # Studio application
```

## 回来继续时先读

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/AGENT_HANDOFF.md`
- `docs/REFERENCE_ARCHIVE.md`
