# Vizual Studio

Vizual Studio 是 Vizual Core 之上的官方产品层。第一阶段专注一件事：让 AI Agent 能生成、编辑、批注、修订和导出商业级 HTML PPT。

它不是 Vizual Core，也不是 PowerPoint 克隆。Vizual Core 负责运行时、组件、Design.md、DocView、liveControl 和导出原语；Vizual Studio 负责把这些能力组织成一个面向用户的工作台。

## 当前第一版能力

- **Deck Studio**：16:9 HTML-first 商业 PPT 画布，slide outline，直接文本编辑。
- **Vizual blocks**：在 slide 中嵌入真实 Vizual 图表、KPI、表格组件。
- **Design.md**：用 liveControl 调整品牌色、背景、表面、圆角、密度、动效，并实时应用到 Vizual runtime。
- **Review Loop**：批注、修订 proposal、accept/reject，目标是走向 DocView/Codex 式协作。
- **Export**：当前支持浏览器打印/PDF 与轻量 HTML handoff；PPTX 暂缓。
- **Agent handoff**：把 Studio 需要的 Agent 角色、边界和 Core gap 写进 `docs/`。

## 为什么单独建仓库

Vizual Core 必须保持干净：

- JSON/Vizual artifact runtime
- 31 个可视化组件
- Design.md 标准解析与主题映射
- DocView / liveControl / export primitives
- Agent bridge SDK

Vizual Studio 是上层应用：

- 用户旅程
- 项目状态
- Deck artifact UX
- 设计系统编辑器
- 批注与修订工作流
- 未来的分享、导出、协作和权限

## 本地开发

当前使用 sibling local dependency：

```bash
/Users/wu/Documents/New project/
  vizual/
  vizual-studio/
```

先确保 `vizual` 已构建：

```bash
cd "/Users/wu/Documents/New project/vizual"
npm install
npm run build
```

然后启动 Studio：

```bash
cd "/Users/wu/Documents/New project/vizual-studio"
npm install
npm run dev -- --host 127.0.0.1 --port 4174
```

构建检查：

```bash
npm run lint
npm run build
```

## 产品方向

短期目标：做深 HTML 商业 PPT。

用户可以：

1. 给 Agent 一个数据分析或汇报任务。
2. Agent 生成 Vizual deck artifact。
3. Studio 用 Design.md 渲染品牌一致的 deck。
4. 用户直接改文字、批注局部、要求 Agent 改图表/布局/样式。
5. Studio 记录修订、版本和导出。

长期目标：成为 AI Agent 的视觉工作台。PPT 是第一条打深的路线，不是唯一路线。

## 参考

- Claude Design：对话 + 持久画布 + design system + inline comments + direct edits + custom sliders + export/handoff。
- Hyperframes：agent-friendly HTML 动画/视频流水线，未来可作为 Studio motion/export 方向的参考。

详细文档见：

- `docs/PRODUCT_DEFINITION.md`
- `docs/ARCHITECTURE.md`
- `docs/CORE_GAPS.md`
- `docs/ROADMAP.md`
- `docs/AGENT_HANDOFF.md`
- `docs/CLAUDE_DESIGN_RESEARCH.md`
- `docs/HYPERFRAMES_RESEARCH.md`
