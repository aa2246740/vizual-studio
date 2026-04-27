# 参考资料归档

> 这份文档只记录后续要回看的材料、用途和授权风险。原则：学习方法论和产品判断，不复制受限提示词、文档原文或商业受限实现。

## Claude Design 系统提示词

- 本地路径：`/Users/wu/Downloads/Claude-Design-Sys-Prompt.txt`
- 用途：理解 Claude Design 的工作流、批注、direct edit、tweak、design system、export/handoff 思路。
- 使用方式：只吸收方法论，例如“持久画布 + 对话 + 精确目标批注 + 可调参数 + 导出闭环”。
- 风险：逆向提示词不应复制进仓库、skill 或产品文档。后续只能写自己的协议和实现。

## Huashu Design

- 地址：https://github.com/alchaincyf/huashu-design
- 重点文件：
  - `references/slide-decks.md`
  - `references/design-styles.md`
  - `references/critique-guide.md`
  - `references/animation-pitfalls.md`
  - `references/editable-pptx.md`
- 用途：参考设计质量体系、HTML-first slide deck 方法、设计风格库、5 维评审、动画避坑、可编辑 PPTX 约束。
- 已确认信息：仓库 README 把它定位为 HTML-native design skill；能力覆盖原型、HTML slides、动画、信息图和评审。许可证是 Personal Use License，“个人随便用，企业要打招呼”。
- 使用方式：不集成、不复制。只学习可抽象原则：
  - HTML-first 作为演示源格式。
  - 大型 deck 先做少量 showcase 定视觉 grammar。
  - 把设计质量拆成可评审维度。
  - 动画和导出必须有自动验证路径。
- 风险：商业/团队/内部工具链使用需要作者书面授权。Vizual/Vizual Studio 不能直接搬运其 skill、references、scripts、assets、demos。

## Hyperframes

- 地址：https://github.com/heygen-com/hyperframes
- 官网/文档：https://hyperframes.heygen.com
- 用途：未来 HTML motion、video、presentation 动效和 Agent-friendly CLI 的参考。
- 已确认信息：Hyperframes 是 Apache 2.0，核心方向是让 Agent 写 HTML/CSS/JS，再渲染视频。
- 使用方式：当前不作为依赖。后续可研究其 lint/render/preview 命令化流程、motion metadata、frame capture pipeline。
- 风险：Apache 2.0 可商用，但仍要保留许可和 NOTICE 要求；不要引入不必要的重依赖到 Core。

## CMB Design 素材

- 本地路径：`/Users/wu/Downloads/cmb_design.md`
- 用途：企业品牌风格测试素材，用来验证 `loadDesignMd()`、动态主题切换、组件矩阵、liveControl。
- 使用方式：作为本地 QA 样本，不默认发布完整原文。

## 用户提供的 Studio 原型

- 工作台首页：模板入口、最近项目、侧边导航、搜索。
- PPT 编辑器：左侧页面缩略图、中央 16:9 画布、顶部工具栏、右侧 Agent 协作面板。
- 设计系统配置页：左侧品牌主题控制，右侧实时预览，浮动 AI 主题助手。
- 用途：产品方向参考，不是最终 UI 规范。
- 关键吸收点：
  - 默认中文。
  - 普通用户不要看到太多专业术语。
  - PPT 编辑器应是独立产品，而不是功能堆砌页。
  - 批注应提交给 Agent 进入修订循环，而不是普通评论。
  - 所有可调能力要和 Design.md / liveControl 打通。

## 已有 Studio 调研文档

- `docs/CLAUDE_DESIGN_RESEARCH.md`
- `docs/HYPERFRAMES_RESEARCH.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/AGENT_HANDOFF.md`
- `docs/CORE_GAPS.md`

这些文档保留当前理解。Core 完善后再回到 Studio 时，需要先读 `STUDIO_HANDOFF.md` 和本归档，再继续产品化。

