# Claude Design 调研摘录

调研日期：2026-04-27

## 结论

Claude Design 和 Vizual Studio 的方向高度重合，但目标用户不同：

- Claude Design 是广义设计/原型/演示工具。
- Vizual Studio 是 Agent 输出的商业汇报和 HTML deck 工作台。

Vizual Studio 应吸收 Claude Design 的交互模式，但不要复制其泛设计定位。

## 官方能力摘要

Anthropic 官方描述的核心能力：

- 对话生成 design/prototype/presentation。
- 左侧 chat，右侧 canvas。
- 通过 conversation、inline comments、direct edits、custom sliders 迭代。
- 组织级 design system 自动应用。
- 可从文本、图片、DOCX/PPTX/XLSX、代码库开始。
- 可导出 ZIP、PDF、PPTX、Canva、standalone HTML。
- 可 handoff 给 Claude Code。

来源：

- https://support.claude.com/en/articles/14604416-get-started-with-claude-design
- https://www.anthropic.com/news/claude-design-anthropic-labs?lang=us

## 对 Vizual Studio 的启发

### 1. Canvas 必须持久

Agent 的 visual output 不能只是聊天气泡里的临时图。用户需要持续编辑、评论、导出，canvas 应是主工作区。

Studio 第一版已采用：

- Deck Studio 默认首页。
- 右侧/中心 persistent slide canvas。
- slide outline 与 inspector。

### 2. Design.md 是组织级上下文

Claude Design 的 design system 是 project 的默认上下文。Vizual Studio 中，标准 Design.md 应承担同类职责。

Studio 第一版已采用：

- Design.md liveControl。
- `loadDesignMd(..., { apply: true })`。
- mapping summary。

### 3. 直接改文字很关键

让用户为每个错别字都问 AI，会降低效率。

Studio 第一版已采用：

- title/body contentEditable。
- inspector 中同步输入框。

### 4. 评论和 revision 必须有生命周期

Claude Design 的已知限制之一是 comments 偶发丢失或未被读取。Vizual Studio 必须从一开始把 comment/revision 设计成 artifact 数据，不只是 DOM 标注。

Studio 第一版已采用：

- comments state。
- revision queue。
- accept/reject。

后续要补：

- targetMap。
- quote/context。
- version diff。

### 5. Tweaks / sliders 是 prompt 之外的必要交互

用户不总想写“把圆角调小一点”。可调控件可以降低交互摩擦。

Studio 第一版已采用：

- Design.md liveControl。
- Agent Controls 模拟常见 deck patch。

后续要补：

- 全 Design.md token matrix。
- per-block liveControl。

## 不应该照搬的地方

- 不做泛设计工具。
- 不把生成结果视为生产完成品。
- 不用不透明 inference 替代标准 Design.md。
- 不让 Agent 静默覆盖历史 artifact。

## 对 Vizual Core 的要求

Claude Design 暗示一个成熟系统需要：

- artifact schema
- target map
- comments
- revisions
- export
- design system report
- handoff bundle

这些是 Vizual Core 与 Studio 接下来最重要的协作方向。
