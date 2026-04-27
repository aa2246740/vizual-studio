# Vizual Studio 产品定义

## 一句话

Vizual Studio 是 Vizual Core 的官方应用层：一个 AI 协作式 HTML PPT 工作台，用标准 Design.md 和 Vizual 组件生成、编辑、批注、修订和导出商业级演示文稿。

## 第一性原理

Vizual Core 是运行时，不是产品。它负责把 Agent 输出的结构化 artifact 渲染成图表、表格、报表、DocView、liveControl 和可导出的页面。

Vizual Studio 是用户真正工作的地方。它要解决的不是“画一个图”，而是：

> Agent 生成一份商业汇报，用户能在可视化画布上看、改、批注、要求 AI 修订，并最终交付给真实业务场景。

因此第一版不做泛化设计工具，先把 **HTML 商业 PPT** 做深。

## 核心用户旅程

### 1. 建立设计风格底座

用户或 Agent 提供标准 Design.md。Studio 通过 liveControl 暴露关键参数，让用户能调设计主色、背景、表面、圆角、阴影、密度、动效。

原则：

- Runtime 只保证标准 Design.md 的确定性解析。
- 非标准设计描述由 Agent-side parser/creator 先归一化。
- 用户调参应该实时影响 Vizual preview 和 deck canvas。

### 2. 生成 deck 初稿

Agent 根据用户任务、数据口径和受众生成 deck artifact。每页是 16:9 HTML slide，每个标题、正文、图表、表格、注释都是可定位节点。

原则：

- HTML-first，不以 PPTX 为主格式。
- 每页只服务一个业务判断或讨论目标。
- 图表和表格必须保留数据追溯能力。

### 3. 用户直接编辑

用户可以直接在画布上改文字。改字不应该每次都要求 Agent 参与。

原则：

- 文本内容直接编辑。
- 样式、结构、图表类型、数据筛选交给 Agent patch。
- 每次 Agent 修改都进入 revision queue。

### 4. 批注与修订循环

用户选中一页或一个区块批注，Agent 读取 target metadata 后给出修订 proposal。用户 accept/reject，Studio 记录版本。

原则：

- 不静默覆盖旧内容。
- 旧对话里的 artifact 可以被引用，但修改应生成新消息/新版本。
- 所有批注都要有 target、quote/context、status。

### 5. 导出与交付

当前优先 HTML/PDF/PNG。PPTX 是后续适配器，不在第一阶段强行做。

原则：

- HTML 是源格式。
- PDF/PNG 是导出格式。
- PPTX 可以作为企业兼容层，但不能反过来限制 HTML 表达力。

## 第一版范围

必须可用：

- Deck Studio 默认首页。
- 16:9 HTML slide canvas。
- slide outline。
- 直接编辑标题和正文。
- 嵌入 Vizual KPI、chart、table。
- Design.md liveControl。
- 批注列表和修订队列。
- 浏览器 print/PDF 和 HTML handoff。

暂不做：

- 真实 LLM 后端。
- 账号、权限、多人协作。
- PPTX 导出。
- 完整 Design.md parser/creator。
- Hyperframes 集成。

## Claude Design 参考结论

Claude Design 验证了同一个大方向：

- 左侧对话 + 右侧持久画布。
- 设计系统一次建立，之后自动应用。
- 用户通过 inline comments、直接文字编辑、自定义 sliders 迭代。
- 输出可以导出 PDF/PPTX/HTML，并 handoff 到代码实现。

Vizual Studio 要吸收这些模式，但定位不同：Claude Design 面向广义设计和原型，Vizual Studio 面向 Agent 输出的商业汇报、数据可视化和可协作 deck。

## Hyperframes 参考结论

Hyperframes 的价值不是替代 Vizual，而是提示我们：

- HTML 可以成为高级 motion / video / presentation 的源格式。
- CLI 应该 agent-friendly，非交互、可 lint、可 render。
- 技能化规则比纯文档更适合 Agent 稳定执行。

第一版只记录方向；后续可研究 `Vizual Motion` 或 `Studio Motion Export`。

## 成功标准

第一版成功不是“功能很多”，而是：

- 打开页面就知道这是做商业 PPT 的 Studio。
- 能调 Design.md，并看到真实 Vizual 组件响应。
- 能编辑一页 slide 的文字和视觉块。
- 能模拟批注、修订、accept/reject。
- 能导出一个可交付的 HTML/PDF 初稿。
- Agent/开发者看 docs 后知道 Core 和 Studio 的边界。

## Sources

- Claude Design help: https://support.claude.com/en/articles/14604416-get-started-with-claude-design
- Claude Design announcement: https://www.anthropic.com/news/claude-design-anthropic-labs?lang=us
- Hyperframes CLI: https://hyperframes.heygen.com/packages/cli
- Hyperframes Claude Design guide: https://hyperframes.heygen.com/guides/claude-design
