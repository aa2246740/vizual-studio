import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { VizualRenderer, loadDesignMd, type VizualSpec } from 'vizual'
import './App.css'

type WorkspaceMode = 'deck' | 'theme' | 'review'

type DesignControls = {
  brandName: string
  accent: string
  background: string
  surface: string
  text: string
  muted: string
  radius: number
  shadow: 'none' | 'soft' | 'strong'
  density: 'executive' | 'analytical' | 'board'
  motion: 'none' | 'subtle' | 'cinematic'
}

type SlideLayout = 'cover' | 'insight' | 'chart' | 'appendix'
type SlideVisual = 'kpi' | 'combo' | 'line' | 'table'
type SlideStatus = 'draft' | 'review' | 'approved'

type Slide = {
  id: string
  layout: SlideLayout
  visual: SlideVisual
  status: SlideStatus
  kicker: string
  title: string
  body: string
  speakerNote: string
}

type ReviewComment = {
  id: string
  slideId: string
  target: string
  request: string
  status: 'open' | 'resolved'
}

type Revision = {
  id: string
  target: string
  summary: string
  status: 'pending' | 'accepted' | 'rejected'
}

type MappingSummary = {
  name: string
  mapped: number
  total: number
  fallback: number
}

type StoredProject = {
  designControls: DesignControls
  designMd: string
  slides: Slide[]
  comments: ReviewComment[]
  revisions: Revision[]
}

const STORAGE_KEY = 'vizual-studio:first-ppt-workspace'

const initialDesign: DesignControls = {
  brandName: 'CMB Strategy Desk',
  accent: '#c8152d',
  background: '#f7f5f0',
  surface: '#ffffff',
  text: '#1b1d22',
  muted: '#68717f',
  radius: 8,
  shadow: 'soft',
  density: 'executive',
  motion: 'subtle',
}

const initialSlides: Slide[] = [
  {
    id: 'cover',
    layout: 'cover',
    visual: 'kpi',
    status: 'approved',
    kicker: 'Q1 Business Review',
    title: '2026 Q1 经营分析汇报',
    body: '面向管理层的业务趋势、风险信号与下一步行动建议。',
    speakerNote: '开场说明：本 deck 展示业务结果、增长质量和行动建议。',
  },
  {
    id: 'growth-quality',
    layout: 'insight',
    visual: 'line',
    status: 'review',
    kicker: 'Growth Quality',
    title: '收入下滑主要来自活跃用户减少',
    body: 'Day 8 后活跃用户下降，同时 ARPPU 上升，说明高价值用户留存但用户规模承压。',
    speakerNote: '强调 ARPPU 上升可能是筛选效应，不能单独证明产品变好。',
  },
  {
    id: 'revenue-trend',
    layout: 'chart',
    visual: 'combo',
    status: 'review',
    kicker: 'Revenue Trend',
    title: '增长率先于收入出现拐点',
    body: '组合图同时呈现收入规模和增长率，帮助识别 Day 5-7 的斜率变化。',
    speakerNote: '提示管理层关注增长率滞后传导到收入的风险。',
  },
  {
    id: 'appendix',
    layout: 'appendix',
    visual: 'table',
    status: 'draft',
    kicker: 'Appendix',
    title: '关键指标明细',
    body: '保留原始指标，方便追溯图表结论和后续导出。',
    speakerNote: '附录用于支撑问答，不一定进入正式汇报。',
  },
]

const initialComments: ReviewComment[] = [
  {
    id: 'c1',
    slideId: 'growth-quality',
    target: '正文段落',
    request: '把“筛选效应”和“不能直接因果归因”讲得更明确。',
    status: 'open',
  },
  {
    id: 'c2',
    slideId: 'revenue-trend',
    target: '组合图',
    request: '把增长率线条强调出来，方便领导一眼看到拐点。',
    status: 'open',
  },
]

const initialRevisions: Revision[] = [
  {
    id: 'r1',
    target: 'revenue-trend / chart',
    summary: 'Agent proposal: 将图表切换为双轴组合图，并在 Day 5-7 标注拐点。',
    status: 'pending',
  },
  {
    id: 'r2',
    target: 'growth-quality / narrative',
    summary: 'Agent proposal: 增加“相关不等于因果”的管理层提示。',
    status: 'pending',
  },
]

const revenueData = [
  { day: 'D1', revenue: 128, growth: 12, active: 42, arppu: 3.0 },
  { day: 'D2', revenue: 142, growth: 14, active: 47, arppu: 3.1 },
  { day: 'D3', revenue: 156, growth: 15, active: 51, arppu: 3.2 },
  { day: 'D4', revenue: 169, growth: 13, active: 54, arppu: 3.4 },
  { day: 'D5', revenue: 181, growth: 10, active: 55, arppu: 3.6 },
  { day: 'D6', revenue: 176, growth: 6, active: 51, arppu: 3.8 },
  { day: 'D7', revenue: 164, growth: 2, active: 46, arppu: 4.1 },
]

const journey = [
  { title: '1. Brief', desc: '输入商业目标、受众、数据口径和限制。' },
  { title: '2. Design.md', desc: '确定品牌语言，一次设置，多处复用。' },
  { title: '3. Draft Deck', desc: 'Agent 生成 HTML-first 商业 PPT 初稿。' },
  { title: '4. Review Loop', desc: '用户直接改字、批注局部、让 Agent 修订。' },
  { title: '5. Export', desc: '导出 HTML / PDF / PNG，PPTX 作为后续适配。' },
]

function buildDesignMd(controls: DesignControls) {
  const shadowText =
    controls.shadow === 'none'
      ? 'No shadows. Use flat panels and hairline borders.'
      : controls.shadow === 'strong'
        ? 'Use confident layered shadows for important commercial presentation panels.'
        : 'Use soft low-alpha shadows for cards, callouts, and slide panels.'

  const densityText = {
    executive: 'Executive rhythm: fewer objects, stronger hierarchy, one decision per slide.',
    analytical: 'Analytical rhythm: denser tables and charts are allowed when they support auditability.',
    board: 'Board rhythm: restrained, high-contrast, presentation-ready pages with strong source traceability.',
  }[controls.density]

  return `# ${controls.brandName} DESIGN.md

## 1. Visual Theme & Atmosphere
${controls.brandName} is a business presentation system for AI-generated reports and executive decks. It should feel rigorous, data-first, and ready for stakeholder review.

## 2. Color Palette & Roles
- Primary / Accent (${controls.accent}): CTA, active state, chart-1, focus ring, high-priority callouts.
- Background (${controls.background}): Main page canvas and slide backdrop.
- Surface / Card (${controls.surface}): Cards, slide panels, control surfaces, data containers.
- Text / Foreground (${controls.text}): Primary text.
- Text Muted / Secondary (${controls.muted}): Captions, metadata, helper copy.

## 3. Typography Rules
- Primary font: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
- Display headings: 40px to 60px, weight 700, tight line-height.
- Slide body: 17px to 22px, weight 400, readable line-height.
- UI labels: 12px to 14px, weight 650.
- Numeric emphasis: tabular numbers where possible.

## 4. Component Stylings
- Cards use ${controls.radius}px radius.
- Buttons use ${Math.max(controls.radius * 2, 12)}px radius.
- ${shadowText}
- Charts should inherit theme colors from runtime tokens, not per-chart hardcoded colors.

## 5. Layout Principles
- Use a 16:9 slide canvas for decks.
- Use 8px spacing rhythm with 16px, 24px, 32px, and 48px section gaps.
- ${densityText}

## 6. Depth & Elevation
- Shadow mode: ${controls.shadow}.
- Motion mode: ${controls.motion}. Motion should clarify hierarchy, not distract from data.

## 7. Do's and Don'ts
- Do prioritize charts, KPIs, tables, and concise executive narrative.
- Do preserve source traceability for any numeric claim.
- Do support direct text editing and comment-driven revision loops.
- Do not hardcode chart colors per component; use theme tokens.
- Do not use decorative visuals when a data or decision object is needed.

## 8. Responsive Behavior
- Studio editing surfaces can stack on narrow screens.
- Exported decks should target desktop and projector-first 16:9 layouts.

## 9. Agent Prompt Guide
- Use Vizual components for data blocks.
- Use DocView-style comments for review loops.
- Use liveControl only when the user asks for adjustable controls.
- Use deck slides for executive presentation output.
`
}

function loadStoredProject(): Partial<StoredProject> {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Partial<StoredProject>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function buildVizualSpec(slide: Slide): VizualSpec {
  if (slide.visual === 'table') {
    return {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: {
            title: '指标明细',
            columns: [
              { key: 'day', label: '日期' },
              { key: 'revenue', label: '收入' },
              { key: 'growth', label: '增长率' },
              { key: 'active', label: '活跃用户' },
              { key: 'arppu', label: 'ARPPU' },
            ],
            data: revenueData,
          },
        },
      },
    }
  }

  if (slide.visual === 'line') {
    return {
      root: 'chart',
      elements: {
        chart: {
          type: 'LineChart',
          props: {
            title: '活跃用户与 ARPPU',
            x: 'day',
            y: ['active', 'arppu'],
            data: revenueData,
            height: 300,
          },
        },
      },
    }
  }

  if (slide.visual === 'kpi') {
    return {
      root: 'kpis',
      elements: {
        kpis: {
          type: 'KpiDashboard',
          props: {
            title: '经营摘要',
            columns: 3,
            metrics: [
              { label: '收入', value: '1.16M', trend: 'down', trendValue: '-4.8%' },
              { label: '活跃用户', value: '46k', trend: 'down', trendValue: '-16.4%' },
              { label: 'ARPPU', value: '4.1', trend: 'up', trendValue: '+36.7%' },
            ],
          },
        },
      },
    }
  }

  return {
    root: 'dashboard',
    elements: {
      dashboard: {
        type: 'GridLayout',
        props: { columns: 1, gap: 14 },
        children: ['combo'],
      },
      combo: {
        type: 'ComboChart',
        props: {
          title: '收入与增长率',
          x: 'day',
          y: ['revenue', 'growth'],
          data: revenueData,
          height: 320,
        },
      },
    },
  }
}

function getMappingSummary(themeName: string, report: unknown): MappingSummary {
  if (!report || typeof report !== 'object') {
    return { name: themeName, mapped: 0, total: 0, fallback: 0 }
  }

  const data = report as Record<string, unknown>
  const stats = typeof data.stats === 'object' && data.stats !== null ? (data.stats as Record<string, unknown>) : {}
  const mapped = Number(data.mappedCount ?? data.mappedTokenCount ?? data.mapped ?? stats.mappedColors ?? 0)
  const rawTotal = Number(data.totalCount ?? data.tokenCount ?? data.total ?? stats.totalColors ?? 0)
  const fallback = Number(data.fallbackCount ?? data.fallbacks ?? 0)

  return {
    name: themeName,
    mapped: Number.isFinite(mapped) ? mapped : 0,
    total: Math.max(Number.isFinite(rawTotal) ? rawTotal : 0, Number.isFinite(mapped) ? mapped : 0),
    fallback: Number.isFinite(fallback) ? fallback : 0,
  }
}

function createStandaloneHtml(slides: Slide[], designMd: string) {
  const renderedSlides = slides
    .map(
      (slide, index) => `
        <section class="slide">
          <p class="kicker">${String(index + 1).padStart(2, '0')} / ${slide.kicker}</p>
          <h1>${escapeHtml(slide.title)}</h1>
          <p>${escapeHtml(slide.body)}</p>
          <footer>${escapeHtml(slide.speakerNote)}</footer>
        </section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vizual Studio Deck Export</title>
  <style>
    body { margin: 0; background: #f7f5f0; font-family: Inter, system-ui, sans-serif; color: #1b1d22; }
    .slide { width: min(1280px, 100vw); aspect-ratio: 16 / 9; margin: 0 auto 24px; padding: 56px; background: white; box-sizing: border-box; display: flex; flex-direction: column; }
    .kicker { color: #c8152d; text-transform: uppercase; font-size: 12px; font-weight: 800; }
    h1 { max-width: 900px; font-size: 56px; line-height: 1; margin: 24px 0; }
    p { max-width: 760px; font-size: 22px; line-height: 1.45; }
    footer { margin-top: auto; color: #68717f; font-size: 13px; }
  </style>
</head>
<body>
  <!-- Design.md source:
${escapeHtml(designMd)}
  -->
${renderedSlides}
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const stored = useMemo(() => loadStoredProject(), [])
  const [mode, setMode] = useState<WorkspaceMode>('deck')
  const [designControls, setDesignControls] = useState(stored.designControls ?? initialDesign)
  const [designMd, setDesignMd] = useState(stored.designMd ?? buildDesignMd(stored.designControls ?? initialDesign))
  const [slides, setSlides] = useState(stored.slides ?? initialSlides)
  const [comments, setComments] = useState(stored.comments ?? initialComments)
  const [revisions, setRevisions] = useState(stored.revisions ?? initialRevisions)
  const [activeSlideId, setActiveSlideId] = useState(slides[0].id)
  const [newComment, setNewComment] = useState('')

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0]
  const activeSpec = useMemo(() => buildVizualSpec(activeSlide), [activeSlide])
  const openComments = comments.filter((comment) => comment.status === 'open')
  const themePreview = useMemo(() => {
    try {
      const theme = loadDesignMd(designMd, { name: 'vizual-studio-preview', register: false })
      return {
        status: `Theme applied: vizual-studio-live`,
        mapping: getMappingSummary(theme.name, theme._mappingReport),
      }
    } catch (error) {
      return {
        status: error instanceof Error ? error.message : 'Theme parse failed',
        mapping: null,
      }
    }
  }, [designMd])

  useEffect(() => {
    document.documentElement.style.setProperty('--studio-bg', designControls.background)
    document.documentElement.style.setProperty('--studio-surface', designControls.surface)
    document.documentElement.style.setProperty('--studio-text', designControls.text)
    document.documentElement.style.setProperty('--studio-muted', designControls.muted)
    document.documentElement.style.setProperty('--studio-accent', designControls.accent)
    document.documentElement.style.setProperty('--studio-radius', `${designControls.radius}px`)
  }, [designControls])

  useEffect(() => {
    try {
      loadDesignMd(designMd, { name: 'vizual-studio-live', apply: true })
    } catch (error) {
      console.warn('Failed to apply Design.md theme', error)
    }
  }, [designMd])

  useEffect(() => {
    const project: StoredProject = { designControls, designMd, slides, comments, revisions }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  }, [designControls, designMd, slides, comments, revisions])

  function updateControl<K extends keyof DesignControls>(key: K, value: DesignControls[K]) {
    const next = { ...designControls, [key]: value }
    setDesignControls(next)
    setDesignMd(buildDesignMd(next))
  }

  function updateSlide(id: string, patch: Partial<Slide>) {
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)))
  }

  function handleInlineText(key: 'title' | 'body', event: FormEvent<HTMLElement>) {
    updateSlide(activeSlide.id, { [key]: event.currentTarget.textContent ?? '' })
  }

  function applyAgentPreset(kind: 'line' | 'executive' | 'dense') {
    if (kind === 'line') {
      updateSlide(activeSlide.id, {
        visual: 'line',
        title: '活跃用户下降先于收入压力显现',
        body: '折线图更适合追踪连续趋势。Day 5 后活跃用户斜率转负，ARPPU 上升更像用户筛选效应。',
      })
    }

    if (kind === 'executive') {
      updateSlide(activeSlide.id, {
        status: 'review',
        body: `${activeSlide.body} 建议先做 7 天 A/B 对照，再判断 AI 内容比例与流失之间是否存在真实因果。`,
      })
    }

    if (kind === 'dense') {
      updateControl('density', 'analytical')
      updateSlide(activeSlide.id, { visual: 'table', layout: 'appendix' })
    }

    setRevisions((current) => [
      {
        id: `r${current.length + 1}`,
        target: `${activeSlide.id} / ${kind}`,
        summary: `Agent action applied: ${kind}. A revision record was created for audit.`,
        status: 'accepted',
      },
      ...current,
    ])
  }

  function addComment() {
    if (!newComment.trim()) return
    setComments((current) => [
      {
        id: `c${current.length + 1}`,
        slideId: activeSlide.id,
        target: '当前选中页',
        request: newComment.trim(),
        status: 'open',
      },
      ...current,
    ])
    setNewComment('')
    setMode('review')
  }

  function setRevisionStatus(id: string, status: Revision['status']) {
    setRevisions((current) => current.map((revision) => (revision.id === id ? { ...revision, status } : revision)))
  }

  function exportHtml() {
    downloadText('vizual-studio-deck.html', createStandaloneHtml(slides, designMd))
  }

  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">V</span>
          <div>
            <strong>Vizual Studio</strong>
            <span>HTML-first business PPT</span>
          </div>
        </div>

        <nav className="nav">
          <button className={mode === 'deck' ? 'active' : ''} onClick={() => setMode('deck')} type="button">
            Deck Studio
          </button>
          <button className={mode === 'theme' ? 'active' : ''} onClick={() => setMode('theme')} type="button">
            Design.md
          </button>
          <button className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')} type="button">
            Review Loop
          </button>
        </nav>

        <div className="journey-card">
          <p className="eyebrow">User Journey</p>
          {journey.map((step) => (
            <div className="journey-step" key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.desc}</span>
            </div>
          ))}
        </div>

        <div className="runtime-card">
          <span>Runtime Boundary</span>
          <strong>Vizual Core + Studio App</strong>
          <p>Core renders specs, themes, DocView, liveControl, and exports. Studio owns deck UX, review flow, and product state.</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Official app layer on top of Vizual</p>
            <h1>{mode === 'deck' ? '商业 HTML PPT 工作台' : mode === 'theme' ? 'Design.md 品牌底座' : '批注与修订循环'}</h1>
          </div>
          <div className="status-stack">
            <span className="status">{themePreview.status}</span>
            {themePreview.mapping && (
              <span className="status quiet">
                mapped {themePreview.mapping.mapped}/{themePreview.mapping.total || '-'} · fallback {themePreview.mapping.fallback}
              </span>
            )}
          </div>
        </header>

        {mode === 'deck' && (
          <section className="deck-layout">
            <div className="panel slide-list-panel">
              <div className="panel-header">
                <h2>Deck Outline</h2>
                <p>每一页都是可定位、可批注、可由 Agent patch 的 artifact 节点。</p>
              </div>
              <div className="slide-list">
                {slides.map((slide, index) => (
                  <button
                    className={slide.id === activeSlide.id ? 'slide-thumb active' : 'slide-thumb'}
                    key={slide.id}
                    onClick={() => setActiveSlideId(slide.id)}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{slide.title}</strong>
                    <small>{slide.status}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="deck-stage">
              <div className={`slide-canvas slide-${activeSlide.layout}`}>
                <div className="slide-copy">
                  <p className="eyebrow">{activeSlide.kicker}</p>
                  <h2
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => handleInlineText('title', event)}
                  >
                    {activeSlide.title}
                  </h2>
                  <p
                    className="editable-body"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => handleInlineText('body', event)}
                  >
                    {activeSlide.body}
                  </p>
                </div>
                {activeSlide.layout !== 'cover' && (
                  <div className="slide-viz">
                    <VizualRenderer spec={activeSpec} />
                  </div>
                )}
                <footer>
                  <span>{designControls.brandName}</span>
                  <span>{activeSlide.status}</span>
                </footer>
              </div>
            </div>

            <div className="panel inspector-panel">
              <div className="panel-header">
                <h2>AI Controls</h2>
                <p>这里模拟 Agent 常见动作。真实接入时由 Agent 生成 patch 或调用 Studio SDK。</p>
              </div>
              <div className="button-grid">
                <button type="button" onClick={() => applyAgentPreset('line')}>
                  改成折线趋势页
                </button>
                <button type="button" onClick={() => applyAgentPreset('executive')}>
                  加管理层结论
                </button>
                <button type="button" onClick={() => applyAgentPreset('dense')}>
                  变成明细附录
                </button>
              </div>

              <label>
                Slide title
                <input value={activeSlide.title} onChange={(event) => updateSlide(activeSlide.id, { title: event.target.value })} />
              </label>
              <label>
                Narrative
                <textarea
                  value={activeSlide.body}
                  onChange={(event) => updateSlide(activeSlide.id, { body: event.target.value })}
                  rows={5}
                />
              </label>
              <label>
                Visual block
                <select
                  value={activeSlide.visual}
                  onChange={(event) => updateSlide(activeSlide.id, { visual: event.target.value as SlideVisual })}
                >
                  <option value="kpi">KPI dashboard</option>
                  <option value="combo">Combo chart</option>
                  <option value="line">Line chart</option>
                  <option value="table">Data table</option>
                </select>
              </label>
              <label>
                Speaker note
                <textarea
                  value={activeSlide.speakerNote}
                  onChange={(event) => updateSlide(activeSlide.id, { speakerNote: event.target.value })}
                  rows={3}
                />
              </label>

              <div className="export-actions">
                <button type="button" onClick={() => window.print()}>
                  打印 / PDF
                </button>
                <button type="button" onClick={exportHtml}>
                  下载 HTML
                </button>
              </div>
            </div>
          </section>
        )}

        {mode === 'theme' && (
          <section className="theme-layout">
            <div className="panel controls-panel">
              <div className="panel-header">
                <h2>Design.md liveControl</h2>
                <p>第一版先覆盖商业 deck 最关键的品牌参数，后续扩展到完整 token 矩阵。</p>
              </div>
              <label>
                Brand name
                <input value={designControls.brandName} onChange={(event) => updateControl('brandName', event.target.value)} />
              </label>
              <div className="color-grid">
                <label>
                  Accent
                  <input type="color" value={designControls.accent} onChange={(event) => updateControl('accent', event.target.value)} />
                </label>
                <label>
                  Background
                  <input
                    type="color"
                    value={designControls.background}
                    onChange={(event) => updateControl('background', event.target.value)}
                  />
                </label>
                <label>
                  Surface
                  <input type="color" value={designControls.surface} onChange={(event) => updateControl('surface', event.target.value)} />
                </label>
                <label>
                  Text
                  <input type="color" value={designControls.text} onChange={(event) => updateControl('text', event.target.value)} />
                </label>
              </div>
              <label>
                Radius: {designControls.radius}px
                <input
                  type="range"
                  min="0"
                  max="28"
                  value={designControls.radius}
                  onChange={(event) => updateControl('radius', Number(event.target.value))}
                />
              </label>
              <label>
                Density
                <select
                  value={designControls.density}
                  onChange={(event) => updateControl('density', event.target.value as DesignControls['density'])}
                >
                  <option value="executive">Executive</option>
                  <option value="analytical">Analytical</option>
                  <option value="board">Board</option>
                </select>
              </label>
              <label>
                Motion
                <select value={designControls.motion} onChange={(event) => updateControl('motion', event.target.value as DesignControls['motion'])}>
                  <option value="none">None</option>
                  <option value="subtle">Subtle</option>
                  <option value="cinematic">Cinematic</option>
                </select>
              </label>
              <label>
                Shadow
                <select value={designControls.shadow} onChange={(event) => updateControl('shadow', event.target.value as DesignControls['shadow'])}>
                  <option value="none">None</option>
                  <option value="soft">Soft</option>
                  <option value="strong">Strong</option>
                </select>
              </label>
            </div>

            <div className="panel design-editor-panel">
              <div className="panel-header">
                <h2>Standard Design.md</h2>
                <p>Runtime 只保证标准 Design.md 的确定性解析；非标准品牌描述应由 Agent parser 先归一化。</p>
              </div>
              <textarea value={designMd} onChange={(event) => setDesignMd(event.target.value)} rows={28} />
            </div>

            <div className="panel preview-panel">
              <div className="panel-header">
                <h2>Vizual Theme Preview</h2>
                <p>预览直接走 VizualRenderer，用真实组件验证主题覆盖。</p>
              </div>
              <VizualRenderer spec={buildVizualSpec(slides[1])} />
            </div>
          </section>
        )}

        {mode === 'review' && (
          <section className="review-layout">
            <div className="panel">
              <div className="panel-header">
                <h2>Comments</h2>
                <p>目标是把 Codex/DocView 式的批注循环变成 Studio 的通用协作模型。</p>
              </div>
              <label>
                Add comment to current slide
                <textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} rows={4} />
              </label>
              <button className="primary-action" type="button" onClick={addComment}>
                添加批注
              </button>
              <div className="comment-list">
                {comments.map((comment) => (
                  <article className={comment.status === 'resolved' ? 'comment resolved' : 'comment'} key={comment.id}>
                    <span>{comment.slideId} · {comment.target}</span>
                    <p>{comment.request}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setComments((current) =>
                          current.map((item) => (item.id === comment.id ? { ...item, status: item.status === 'open' ? 'resolved' : 'open' } : item)),
                        )
                      }
                    >
                      {comment.status === 'open' ? '标记完成' : '重新打开'}
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Revision Queue</h2>
                <p>Agent 每次修订都应该变成可审计的 proposal，而不是悄悄覆盖页面。</p>
              </div>
              <div className="revision-list">
                {revisions.map((revision) => (
                  <article className="revision" key={revision.id}>
                    <span>{revision.target}</span>
                    <p>{revision.summary}</p>
                    <div>
                      <button type="button" onClick={() => setRevisionStatus(revision.id, 'accepted')}>
                        Accept
                      </button>
                      <button type="button" onClick={() => setRevisionStatus(revision.id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                    <strong>{revision.status}</strong>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Claude Design Lessons</h2>
                <p>已经内化到 Studio 第一版的关键模式。</p>
              </div>
              <div className="lesson-list">
                <span>左侧任务流 + 右侧持久画布</span>
                <span>Design.md 先行，所有输出自动继承</span>
                <span>文字直接编辑，样式交给 Agent patch</span>
                <span>评论、版本、导出是产品级能力</span>
                <span>Hyperframes 作为未来 motion/export 研究方向</span>
              </div>
              <div className="metric-row">
                <div>
                  <strong>{slides.length}</strong>
                  <span>slides</span>
                </div>
                <div>
                  <strong>{openComments.length}</strong>
                  <span>open comments</span>
                </div>
                <div>
                  <strong>{revisions.length}</strong>
                  <span>revisions</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
