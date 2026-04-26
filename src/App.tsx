import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { VizualRenderer, loadDesignMd, type VizualSpec } from 'vizual'
import './App.css'

type AgentTab = 'chat' | 'tweak' | 'comment' | 'history'
type SelectedTarget = '整页' | '标题' | '正文' | '图表'

type DesignControls = {
  brandName: string
  accent: string
  background: string
  surface: string
  text: string
  muted: string
  radius: number
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
  target: SelectedTarget
  request: string
  status: 'open' | 'resolved'
}

type Revision = {
  id: string
  target: string
  summary: string
  status: 'pending' | 'accepted' | 'rejected'
}

type AgentMessage = {
  id: string
  role: 'user' | 'agent'
  text: string
}

type StoredProject = {
  designControls: DesignControls
  slides: Slide[]
  comments: ReviewComment[]
  revisions: Revision[]
  agentMessages: AgentMessage[]
}

type StudioAgentAction =
  | { type: 'updateSlide'; slideId?: string; patch: Partial<Slide>; summary?: string }
  | { type: 'replaceVisual'; slideId?: string; visual: SlideVisual; summary?: string }
  | { type: 'applyBrand'; patch: Partial<DesignControls>; summary?: string }
  | { type: 'addRevision'; target?: string; summary: string }
  | { type: 'resolveComment'; commentId: string; summary?: string }
  | { type: 'addAgentMessage'; text: string }

declare global {
  interface Window {
    VizualStudio?: {
      snapshot: () => {
        activeSlideId: string
        selectedTarget: SelectedTarget
        slides: Slide[]
        comments: ReviewComment[]
        revisions: Revision[]
        designControls: DesignControls
      }
      getOpenComments: () => ReviewComment[]
      applyAgentAction: (action: StudioAgentAction) => void
      addAgentMessage: (text: string) => void
    }
  }
}

const STORAGE_KEY = 'vizual-studio:ppt-product-zh-v3'

const initialDesign: DesignControls = {
  brandName: 'CMB 策略分析台',
  accent: '#c8152d',
  background: '#f6f2ea',
  surface: '#ffffff',
  text: '#1c2430',
  muted: '#697386',
  radius: 10,
  density: 'executive',
  motion: 'subtle',
}

const initialSlides: Slide[] = [
  {
    id: 'cover',
    layout: 'cover',
    visual: 'kpi',
    status: 'approved',
    kicker: 'Q1 经营回顾',
    title: '2026 Q1\n经营分析汇报',
    body: '面向管理层的业务趋势、风险信号与下一步行动建议。',
    speakerNote: '开场说明：本 deck 展示业务结果、增长质量和行动建议。',
  },
  {
    id: 'growth-quality',
    layout: 'insight',
    visual: 'line',
    status: 'review',
    kicker: '增长质量',
    title: '收入下滑主要来自活跃用户减少',
    body: 'Day 8 后活跃用户下降，同时 ARPPU 上升，说明高价值用户留存但用户规模承压。',
    speakerNote: '强调 ARPPU 上升可能是筛选效应，不能单独证明产品变好。',
  },
  {
    id: 'revenue-trend',
    layout: 'chart',
    visual: 'combo',
    status: 'review',
    kicker: '收入趋势',
    title: '增长率先于收入出现拐点',
    body: '组合图同时呈现收入规模和增长率，帮助识别 Day 5-7 的斜率变化。',
    speakerNote: '提示管理层关注增长率滞后传导到收入的风险。',
  },
  {
    id: 'appendix',
    layout: 'appendix',
    visual: 'table',
    status: 'draft',
    kicker: '附录',
    title: '关键指标明细',
    body: '保留原始指标，方便追溯图表结论和后续导出。',
    speakerNote: '附录用于支撑问答，不一定进入正式汇报。',
  },
]

const initialComments: ReviewComment[] = [
  {
    id: 'c1',
    slideId: 'growth-quality',
    target: '正文',
    request: '把“筛选效应”和“不能直接因果归因”讲得更明确。',
    status: 'open',
  },
  {
    id: 'c2',
    slideId: 'revenue-trend',
    target: '图表',
    request: '把增长率线条强调出来，方便领导一眼看到拐点。',
    status: 'open',
  },
]

const initialRevisions: Revision[] = [
  {
    id: 'r1',
    target: 'revenue-trend / 图表',
    summary: 'Agent 建议将图表切换为双轴组合图，并在 Day 5-7 标注拐点。',
    status: 'pending',
  },
]

const initialAgentMessages: AgentMessage[] = [
  {
    id: 'm1',
    role: 'agent',
    text: '我已生成一版经营分析 PPT。你可以直接改文字，也可以选中页面元素后批注或微调。',
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

const statusLabels: Record<SlideStatus | Revision['status'], string> = {
  draft: '草稿',
  review: '待审',
  approved: '已确认',
  pending: '待处理',
  accepted: '已接受',
  rejected: '已拒绝',
}

const visualLabels: Record<SlideVisual, string> = {
  kpi: 'KPI 看板',
  combo: '组合图',
  line: '折线图',
  table: '数据表',
}

function buildBrandGuide(controls: DesignControls) {
  const densityText = {
    executive: 'Executive rhythm: fewer objects, stronger hierarchy, one decision per slide.',
    analytical: 'Analytical rhythm: denser tables and charts are allowed when they support auditability.',
    board: 'Board rhythm: restrained, high-contrast pages with strong source traceability.',
  }[controls.density]

  return `# ${controls.brandName} Design System

## Color Palette & Roles
- Primary / Accent (${controls.accent}): CTA, active state, chart-1, focus ring, high-priority callouts.
- Background (${controls.background}): Main page canvas and slide backdrop.
- Surface / Card (${controls.surface}): Cards, slide panels, control surfaces, data containers.
- Text / Foreground (${controls.text}): Primary text.
- Text Muted / Secondary (${controls.muted}): Captions, metadata, helper copy.

## Typography Rules
- Primary font: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
- Display headings: 40px to 60px, weight 700, tight line-height.
- Slide body: 17px to 22px, weight 400, readable line-height.
- UI labels: 12px to 14px, weight 650.

## Component Stylings
- Cards use ${controls.radius}px radius.
- Buttons use ${Math.max(controls.radius * 2, 12)}px radius.
- Charts should inherit theme colors from runtime tokens.

## Layout Principles
- Use a 16:9 slide canvas for decks.
- ${densityText}

## Motion
- Motion mode: ${controls.motion}. Motion should clarify hierarchy, not distract from data.
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
            title: '活跃用户趋势',
            x: 'day',
            y: 'active',
            data: revenueData,
            height: 260,
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

function createStandaloneHtml(slides: Slide[], brandGuide: string, controls: DesignControls) {
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
    body { margin: 0; background: ${controls.background}; font-family: Inter, system-ui, sans-serif; color: ${controls.text}; }
    .slide { width: min(1280px, 100vw); aspect-ratio: 16 / 9; margin: 0 auto 24px; padding: 56px; background: ${controls.surface}; box-sizing: border-box; display: flex; flex-direction: column; }
    .kicker { color: ${controls.accent}; text-transform: uppercase; font-size: 12px; font-weight: 800; }
    h1 { max-width: 900px; font-size: 56px; line-height: 1; margin: 24px 0; }
    p { max-width: 760px; font-size: 22px; line-height: 1.45; }
    footer { margin-top: auto; color: ${controls.muted}; font-size: 13px; }
  </style>
</head>
<body>
  <!-- Brand source:
${escapeHtml(brandGuide)}
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
  const [agentTab, setAgentTab] = useState<AgentTab>('chat')
  const [designControls, setDesignControls] = useState(stored.designControls ?? initialDesign)
  const [slides, setSlides] = useState(stored.slides ?? initialSlides)
  const [comments, setComments] = useState(stored.comments ?? initialComments)
  const [revisions, setRevisions] = useState(stored.revisions ?? initialRevisions)
  const [agentMessages, setAgentMessages] = useState(stored.agentMessages ?? initialAgentMessages)
  const [activeSlideId, setActiveSlideId] = useState(slides[0].id)
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>('整页')
  const [commentDraft, setCommentDraft] = useState('')
  const [chatDraft, setChatDraft] = useState('')

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0]
  const activeSpec = useMemo(() => buildVizualSpec(activeSlide), [activeSlide])
  const brandGuide = useMemo(() => buildBrandGuide(designControls), [designControls])
  const openComments = comments.filter((comment) => comment.status === 'open')
  const deckProgress = Math.round((slides.filter((slide) => slide.status === 'approved').length / slides.length) * 100)

  function updateSlide(id: string, patch: Partial<Slide>) {
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)))
  }

  function updateControl<K extends keyof DesignControls>(key: K, value: DesignControls[K]) {
    setDesignControls((current) => ({ ...current, [key]: value }))
  }

  function addRevision(summary: string, target = `${activeSlide.id} / ${selectedTarget}`, status: Revision['status'] = 'pending') {
    setRevisions((current) => [
      {
        id: `r${Date.now()}`,
        target,
        summary,
        status,
      },
      ...current,
    ])
  }

  function applyAgentAction(action: StudioAgentAction) {
    if (action.type === 'updateSlide') {
      updateSlide(action.slideId ?? activeSlideId, action.patch)
      addRevision(action.summary ?? 'Agent 已更新当前幻灯片。', action.slideId ?? activeSlideId, 'accepted')
      return
    }

    if (action.type === 'replaceVisual') {
      updateSlide(action.slideId ?? activeSlideId, { visual: action.visual })
      addRevision(action.summary ?? `Agent 已切换为${visualLabels[action.visual]}。`, action.slideId ?? activeSlideId, 'accepted')
      return
    }

    if (action.type === 'applyBrand') {
      setDesignControls((current) => ({ ...current, ...action.patch }))
      addRevision(action.summary ?? 'Agent 已调整品牌风格。', '品牌风格', 'accepted')
      return
    }

    if (action.type === 'addRevision') {
      addRevision(action.summary, action.target)
      return
    }

    if (action.type === 'resolveComment') {
      setComments((current) =>
        current.map((comment) => (comment.id === action.commentId ? { ...comment, status: 'resolved' } : comment)),
      )
      addRevision(action.summary ?? 'Agent 已处理一条批注。', action.commentId, 'accepted')
      return
    }

    if (action.type === 'addAgentMessage') {
      setAgentMessages((current) => [...current, { id: `m${Date.now()}`, role: 'agent', text: action.text }])
    }
  }

  function handleInlineText(key: 'title' | 'body', event: FormEvent<HTMLElement>) {
    updateSlide(activeSlide.id, { [key]: event.currentTarget.textContent ?? '' })
  }

  function addComment() {
    if (!commentDraft.trim()) return
    const comment: ReviewComment = {
      id: `c${Date.now()}`,
      slideId: activeSlide.id,
      target: selectedTarget,
      request: commentDraft.trim(),
      status: 'open',
    }
    setComments((current) => [comment, ...current])
    setAgentMessages((current) => [
      ...current,
      { id: `m${Date.now()}`, role: 'user', text: `批注 ${comment.target}：${comment.request}` },
    ])
    window.dispatchEvent(new CustomEvent('vizual-studio:comment-added', { detail: comment }))
    setCommentDraft('')
  }

  function sendChat() {
    if (!chatDraft.trim()) return
    const prompt = chatDraft.trim()
    setAgentMessages((current) => [...current, { id: `m${Date.now()}`, role: 'user', text: prompt }])
    setChatDraft('')

    const lower = prompt.toLowerCase()
    if (prompt.includes('折线') || lower.includes('line')) {
      applyAgentAction({
        type: 'replaceVisual',
        visual: 'line',
        summary: '根据对话请求，Agent 已将当前可视化切换为折线图。',
      })
      setAgentMessages((current) => [...current, { id: `m${Date.now() + 1}`, role: 'agent', text: '已改成折线趋势图，并保留原始数据口径。' }])
      return
    }

    if (prompt.includes('明细') || prompt.includes('表格')) {
      applyAgentAction({
        type: 'updateSlide',
        patch: { visual: 'table', layout: 'appendix', status: 'review' },
        summary: '根据对话请求，Agent 已将当前页改为明细附录。',
      })
      setAgentMessages((current) => [...current, { id: `m${Date.now() + 1}`, role: 'agent', text: '已切换为明细表格页，方便追溯数据。' }])
      return
    }

    if (prompt.includes('结论') || prompt.includes('详细')) {
      applyAgentAction({
        type: 'updateSlide',
        patch: {
          body: `${activeSlide.body} 建议先做 7 天 A/B 对照，并补充分群分析，避免把时间趋势误判为因果关系。`,
          status: 'review',
        },
        summary: '根据对话请求，Agent 已补充管理层结论。',
      })
      setAgentMessages((current) => [...current, { id: `m${Date.now() + 1}`, role: 'agent', text: '已补充更具体的管理层建议，并保留因果风险提示。' }])
      return
    }

    setAgentMessages((current) => [
      ...current,
      { id: `m${Date.now() + 1}`, role: 'agent', text: '我已收到。内部版可以通过右侧批注或 DevTools 桥接让我对具体对象做修订。' },
    ])
  }

  function resolveOpenComments() {
    const pending = comments.filter((comment) => comment.status === 'open')
    if (!pending.length) return

    pending.forEach((comment) => {
      if (comment.target === '图表') {
        updateSlide(comment.slideId, { visual: 'combo', status: 'review' })
      }
      if (comment.target === '正文') {
        const targetSlide = slides.find((slide) => slide.id === comment.slideId)
        if (targetSlide) {
          updateSlide(comment.slideId, {
            body: `${targetSlide.body} 这里需要明确区分相关性和因果性，后续建议通过对照实验验证。`,
            status: 'review',
          })
        }
      }
    })

    setComments((current) => current.map((comment) => (comment.status === 'open' ? { ...comment, status: 'resolved' } : comment)))
    addRevision(`Agent 已处理 ${pending.length} 条未完成批注。`, '批注队列', 'accepted')
    setAgentMessages((current) => [...current, { id: `m${Date.now()}`, role: 'agent', text: `我处理了 ${pending.length} 条批注，并生成了修订记录。` }])
  }

  function setRevisionStatus(id: string, status: Revision['status']) {
    setRevisions((current) => current.map((revision) => (revision.id === id ? { ...revision, status } : revision)))
  }

  function exportHtml() {
    downloadText('vizual-studio-deck.html', createStandaloneHtml(slides, brandGuide, designControls))
  }

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
      loadDesignMd(brandGuide, { name: 'vizual-studio-live', apply: true })
    } catch (error) {
      console.warn('Failed to apply brand theme', error)
    }
  }, [brandGuide])

  useEffect(() => {
    const project: StoredProject = { designControls, slides, comments, revisions, agentMessages }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  }, [designControls, slides, comments, revisions, agentMessages])

  useEffect(() => {
    window.VizualStudio = {
      snapshot: () => ({
        activeSlideId,
        selectedTarget,
        slides,
        comments,
        revisions,
        designControls,
      }),
      getOpenComments: () => comments.filter((comment) => comment.status === 'open'),
      applyAgentAction,
      addAgentMessage: (text: string) => applyAgentAction({ type: 'addAgentMessage', text }),
    }
  })

  return (
    <div className="studio-app">
      <header className="appbar">
        <div className="app-brand">
          <span className="brand-mark">V</span>
          <div>
            <strong>Vizual Studio</strong>
            <span>商业 PPT 协作平台</span>
          </div>
        </div>
        <div className="project-title">
          <span>当前项目</span>
          <strong>2026 Q1 经营分析汇报</strong>
        </div>
        <div className="app-actions">
          <span>内部预览版</span>
          <button type="button" onClick={() => window.print()}>
            导出 PDF
          </button>
          <button type="button" onClick={exportHtml}>
            导出 HTML
          </button>
        </div>
      </header>

      <div className="product-layout">
        <main className="content-workspace">
          <aside className="slide-rail">
            {slides.map((slide, index) => (
              <button
                className={slide.id === activeSlide.id ? 'thumb active' : 'thumb'}
                key={slide.id}
                onClick={() => {
                  setActiveSlideId(slide.id)
                  setSelectedTarget('整页')
                }}
                type="button"
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{slide.title}</strong>
                <small>{statusLabels[slide.status]}</small>
              </button>
            ))}
          </aside>

          <section className="canvas-workspace">
            <div className="canvas-toolbar">
              <div className="target-switcher">
                {(['整页', '标题', '正文', '图表'] as SelectedTarget[]).map((target) => (
                  <button
                    className={selectedTarget === target ? 'active' : ''}
                    key={target}
                    onClick={() => setSelectedTarget(target)}
                    type="button"
                  >
                    {target}
                  </button>
                ))}
              </div>
              <div className="canvas-meta">
                <span>{activeSlide.kicker}</span>
                <span>{statusLabels[activeSlide.status]}</span>
              </div>
            </div>

            <div className={`slide-canvas slide-${activeSlide.layout}`} onClick={() => setSelectedTarget('整页')}>
              <div className="slide-copy">
                <p className="eyebrow">{activeSlide.kicker}</p>
                <h1
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => handleInlineText('title', event)}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedTarget('标题')
                  }}
                >
                  {activeSlide.title}
                </h1>
                <p
                  className="editable-body"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => handleInlineText('body', event)}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedTarget('正文')
                  }}
                >
                  {activeSlide.body}
                </p>
              </div>
              {activeSlide.layout !== 'cover' && (
                <div
                  className={selectedTarget === '图表' ? 'slide-viz selected' : 'slide-viz'}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedTarget('图表')
                  }}
                >
                  <VizualRenderer spec={activeSpec} />
                </div>
              )}
              <footer>
                <span>{designControls.brandName}</span>
                <span>{activeSlide.id}</span>
              </footer>
            </div>

            <div className="speaker-notes">
              <span>备注</span>
              <textarea
                value={activeSlide.speakerNote}
                onChange={(event) => updateSlide(activeSlide.id, { speakerNote: event.target.value })}
                rows={2}
              />
            </div>
          </section>
        </main>

        <aside className="agent-panel">
          <div className="agent-header">
            <div>
              <strong>Agent 协作</strong>
              <span>当前对象：{selectedTarget}</span>
            </div>
            <button type="button" onClick={resolveOpenComments}>
              处理批注
            </button>
          </div>

          <div className="agent-tabs">
            {[
              ['chat', '对话'],
              ['tweak', '微调'],
              ['comment', '批注'],
              ['history', '版本'],
            ].map(([key, label]) => (
              <button
                className={agentTab === key ? 'active' : ''}
                key={key}
                onClick={() => setAgentTab(key as AgentTab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {agentTab === 'chat' && (
            <section className="agent-section chat-section">
              <div className="message-list">
                {agentMessages.map((message) => (
                  <article className={`message ${message.role}`} key={message.id}>
                    {message.text}
                  </article>
                ))}
              </div>
              <div className="chat-box">
                <textarea value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} rows={3} />
                <button type="button" onClick={sendChat}>
                  发送
                </button>
              </div>
            </section>
          )}

          {agentTab === 'tweak' && (
            <section className="agent-section tweak-section">
              <label>
                视觉类型
                <select
                  value={activeSlide.visual}
                  onChange={(event) => updateSlide(activeSlide.id, { visual: event.target.value as SlideVisual })}
                >
                  <option value="kpi">{visualLabels.kpi}</option>
                  <option value="combo">{visualLabels.combo}</option>
                  <option value="line">{visualLabels.line}</option>
                  <option value="table">{visualLabels.table}</option>
                </select>
              </label>
              <label>
                品牌主色
                <input type="color" value={designControls.accent} onChange={(event) => updateControl('accent', event.target.value)} />
              </label>
              <label>
                背景色
                <input type="color" value={designControls.background} onChange={(event) => updateControl('background', event.target.value)} />
              </label>
              <label>
                圆角 {designControls.radius}px
                <input
                  type="range"
                  min="0"
                  max="28"
                  value={designControls.radius}
                  onChange={(event) => updateControl('radius', Number(event.target.value))}
                />
              </label>
              <label>
                信息密度
                <select
                  value={designControls.density}
                  onChange={(event) => updateControl('density', event.target.value as DesignControls['density'])}
                >
                  <option value="executive">高管汇报</option>
                  <option value="analytical">分析明细</option>
                  <option value="board">董事会</option>
                </select>
              </label>
              <label>
                动效强度
                <select value={designControls.motion} onChange={(event) => updateControl('motion', event.target.value as DesignControls['motion'])}>
                  <option value="none">无动效</option>
                  <option value="subtle">克制动效</option>
                  <option value="cinematic">演示级动效</option>
                </select>
              </label>
            </section>
          )}

          {agentTab === 'comment' && (
            <section className="agent-section comment-section">
              <div className="comment-compose">
                <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={4} />
                <button type="button" onClick={addComment}>
                  提交批注
                </button>
              </div>
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
            </section>
          )}

          {agentTab === 'history' && (
            <section className="agent-section history-section">
              <div className="progress-card">
                <strong>{deckProgress}%</strong>
                <span>已确认</span>
                <span>{openComments.length} 条待处理批注</span>
              </div>
              <div className="revision-list">
                {revisions.map((revision) => (
                  <article className="revision" key={revision.id}>
                    <span>{revision.target}</span>
                    <p>{revision.summary}</p>
                    <div>
                      <button type="button" onClick={() => setRevisionStatus(revision.id, 'accepted')}>
                        接受
                      </button>
                      <button type="button" onClick={() => setRevisionStatus(revision.id, 'rejected')}>
                        拒绝
                      </button>
                    </div>
                    <strong>{statusLabels[revision.status]}</strong>
                  </article>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

export default App
