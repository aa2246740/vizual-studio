import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { VizualRenderer, loadDesignMd, type ThemeMappingReport, type VizualSpec } from 'vizual'
import './App.css'

type AppView = 'home' | 'editor' | 'design'
type AgentTab = 'chat' | 'tweak' | 'review'
type SelectedTarget = '整页' | '标题' | '正文' | '图表' | '图片'

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
type ImageTone = 'business' | 'warm' | 'mono'

type Slide = {
  id: string
  layout: SlideLayout
  visual: SlideVisual
  status: SlideStatus
  kicker: string
  title: string
  body: string
  speakerNote: string
  titleWidth: number
  titleSize: number
  titleWrap: 'wrap' | 'nowrap'
  bodyWidth: number
  bodySize: number
  bodyWrap: 'wrap' | 'nowrap'
  visualHeight: number
  imageTone: ImageTone
  imageZoom: number
  imageX: number
  imageY: number
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
  view: AppView
  projectTitle: string
  designControls: DesignControls
  slides: Slide[]
  comments: ReviewComment[]
  revisions: Revision[]
  agentMessages: AgentMessage[]
}

type StudioAgentAction =
  | { type: 'navigate'; view: AppView }
  | { type: 'createFromTemplate'; templateId: string }
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
        view: AppView
        projectTitle: string
        activeSlideId: string
        selectedTarget: SelectedTarget
        slides: Slide[]
        comments: ReviewComment[]
        revisions: Revision[]
        designControls: DesignControls
        mappingReport?: ThemeMappingReport
      }
      getOpenComments: () => ReviewComment[]
      applyAgentAction: (action: StudioAgentAction) => void
      addAgentMessage: (text: string) => void
      createFromTemplate: (templateId: string) => void
      navigate: (view: AppView) => void
    }
  }
}

const STORAGE_KEY = 'vizual-studio:ppt-product-zh-v6'

const initialDesign: DesignControls = {
  brandName: '招商经营分析',
  accent: '#c8152d',
  background: '#f6f2ea',
  surface: '#ffffff',
  text: '#1c2430',
  muted: '#697386',
  radius: 10,
  density: 'executive',
  motion: 'subtle',
}

const slideBase = {
  titleWidth: 72,
  titleSize: 38,
  titleWrap: 'wrap' as const,
  bodyWidth: 76,
  bodySize: 18,
  bodyWrap: 'wrap' as const,
  visualHeight: 280,
  imageTone: 'business' as ImageTone,
  imageZoom: 100,
  imageX: 50,
  imageY: 50,
}

const initialSlides: Slide[] = [
  {
    ...slideBase,
    id: 'cover',
    layout: 'cover',
    visual: 'kpi',
    status: 'approved',
    kicker: 'Q1 经营回顾',
    title: '2026 Q1\n经营分析汇报',
    body: '面向管理层的业务趋势、风险信号与下一步行动建议。',
    speakerNote: '开场说明：本 deck 展示业务结果、增长质量和行动建议。',
    titleWidth: 58,
    titleSize: 54,
    bodyWidth: 68,
    visualHeight: 260,
  },
  {
    ...slideBase,
    id: 'growth-quality',
    layout: 'insight',
    visual: 'line',
    status: 'review',
    kicker: '增长质量',
    title: '收入下滑主要来自活跃用户减少',
    body: 'Day 8 后活跃用户下降，同时 ARPPU 上升，说明高价值用户留存但用户规模承压。',
    speakerNote: '强调 ARPPU 上升可能是筛选效应，不能单独证明产品变好。',
    imageTone: 'warm',
  },
  {
    ...slideBase,
    id: 'revenue-trend',
    layout: 'chart',
    visual: 'combo',
    status: 'review',
    kicker: '收入趋势',
    title: '增长率先于收入出现拐点',
    body: '组合图同时呈现收入规模和增长率，帮助识别 Day 5-7 的斜率变化。',
    speakerNote: '提示管理层关注增长率滞后传导到收入的风险。',
    visualHeight: 300,
  },
  {
    ...slideBase,
    id: 'appendix',
    layout: 'appendix',
    visual: 'table',
    status: 'draft',
    kicker: '附录',
    title: '关键指标明细',
    body: '保留原始指标，方便追溯图表结论和后续导出。',
    speakerNote: '附录用于支撑问答，不一定进入正式汇报。',
    visualHeight: 310,
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
    text: '我已生成一版经营分析 PPT。你可以直接改文字，也可以选中页面元素后把修改要求提交给我，或用微调控制当前对象。',
  },
]

const templates = [
  {
    id: 'monthly',
    title: '月度经营复盘',
    subtitle: '指标总览、增长质量、风险信号、下月行动',
    slides: 12,
    tone: '管理层汇报',
  },
  {
    id: 'weekly',
    title: '项目周报',
    subtitle: '进度、阻塞、资源、下周计划',
    slides: 8,
    tone: '团队协作',
  },
  {
    id: 'summary',
    title: '阶段工作总结',
    subtitle: '目标、成果、复盘、下一阶段规划',
    slides: 15,
    tone: '述职总结',
  },
  {
    id: 'product',
    title: '产品介绍方案',
    subtitle: '价值主张、功能亮点、客户场景、路线图',
    slides: 18,
    tone: '客户展示',
  },
]

const recentProjects = [
  { title: '华东区零售金融 3 月经营简报', status: '继续编辑', updated: '12 分钟前' },
  { title: '财富管理平台产品发布材料', status: '待批注', updated: '昨天 18:20' },
  { title: '风险能力建设季度复盘', status: '已导出', updated: '3 天前' },
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

const densityLabels: Record<DesignControls['density'], string> = {
  executive: '高管汇报',
  analytical: '分析明细',
  board: '董事会',
}

const motionLabels: Record<DesignControls['motion'], string> = {
  none: '无动效',
  subtle: '克制动效',
  cinematic: '演示级动效',
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
- Primary font: Inter, Microsoft YaHei, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
- Display headings: 40px to 60px, weight 700, tight line-height.
- Slide body: 17px to 22px, weight 400, readable line-height.
- UI labels: 12px to 14px, weight 650.

## Component Stylings
- Cards use ${controls.radius}px radius.
- Buttons use ${Math.max(controls.radius * 2, 12)}px radius.
- Charts, tables, KPI cards, and page sections inherit runtime colors.

## Layout Principles
- Use a 16:9 slide canvas for presentation pages.
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
            height: slide.visualHeight,
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
          height: slide.visualHeight,
        },
      },
    },
  }
}

function createStandaloneHtml(slides: Slide[], brandGuide: string, controls: DesignControls, projectTitle: string) {
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
  <title>${escapeHtml(projectTitle)}</title>
  <style>
    body { margin: 0; background: ${controls.background}; font-family: Inter, "Microsoft YaHei", system-ui, sans-serif; color: ${controls.text}; }
    .slide { width: min(1280px, 100vw); aspect-ratio: 16 / 9; margin: 0 auto 24px; padding: 56px; background: ${controls.surface}; box-sizing: border-box; display: flex; flex-direction: column; }
    .kicker { color: ${controls.accent}; text-transform: uppercase; font-size: 12px; font-weight: 800; }
    h1 { max-width: 900px; font-size: 56px; line-height: 1; white-space: pre-wrap; margin: 24px 0; }
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

function patchSlidesForTemplate(templateId: string): { title: string; slides: Slide[] } {
  const template = templates.find((item) => item.id === templateId) ?? templates[0]
  const titleMap: Record<string, string> = {
    monthly: '2026 年 3 月经营复盘',
    weekly: '重点项目周报',
    summary: '阶段工作总结汇报',
    product: '智能分析平台产品介绍',
  }
  const title = titleMap[template.id] ?? template.title

  return {
    title,
    slides: initialSlides.map((slide, index) => ({
      ...slide,
      status: index === 0 ? 'approved' : 'draft',
      title: index === 0 ? title : slide.title,
      kicker: index === 0 ? template.tone : slide.kicker,
    })),
  }
}

function App() {
  const stored = useMemo(() => loadStoredProject(), [])
  const [view, setView] = useState<AppView>(stored.view ?? 'home')
  const [agentTab, setAgentTab] = useState<AgentTab>('chat')
  const [projectTitle, setProjectTitle] = useState(stored.projectTitle ?? '2026 Q1 经营分析汇报')
  const [designControls, setDesignControls] = useState(stored.designControls ?? initialDesign)
  const [slides, setSlides] = useState(stored.slides ?? initialSlides)
  const [comments, setComments] = useState(stored.comments ?? initialComments)
  const [revisions, setRevisions] = useState(stored.revisions ?? initialRevisions)
  const [agentMessages, setAgentMessages] = useState(stored.agentMessages ?? initialAgentMessages)
  const [activeSlideId, setActiveSlideId] = useState(slides[0].id)
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>('整页')
  const [collabDraft, setCollabDraft] = useState('')

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0]
  const activeSpec = useMemo(() => buildVizualSpec(activeSlide), [activeSlide])
  const brandGuide = useMemo(() => buildBrandGuide(designControls), [designControls])
  const themeReport = useMemo<ThemeMappingReport | undefined>(() => {
    try {
      const theme = loadDesignMd(brandGuide, { name: 'vizual-studio-live', apply: true })
      return theme._mappingReport
    } catch (error) {
      console.warn('Failed to apply brand theme', error)
      return undefined
    }
  }, [brandGuide])
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

  function createDeckFromTemplate(templateId: string) {
    const next = patchSlidesForTemplate(templateId)
    setProjectTitle(next.title)
    setSlides(next.slides)
    setComments([])
    setRevisions([
      {
        id: `r${Date.now()}`,
        target: '整份演示',
        summary: `已从「${templates.find((item) => item.id === templateId)?.title ?? '模板'}」创建新项目。`,
        status: 'accepted',
      },
    ])
    setAgentMessages([
      {
        id: `m${Date.now()}`,
        role: 'agent',
        text: `我已经按「${next.title}」建立一版可编辑 PPT。你可以直接改文字，也可以选中图表、图片或整页提交修改要求。`,
      },
    ])
    setActiveSlideId(next.slides[0].id)
    setSelectedTarget('整页')
    setView('editor')
  }

  function applyAgentAction(action: StudioAgentAction) {
    if (action.type === 'navigate') {
      setView(action.view)
      return
    }

    if (action.type === 'createFromTemplate') {
      createDeckFromTemplate(action.templateId)
      return
    }

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

  function submitAgentRequest() {
    if (!collabDraft.trim()) return
    const prompt = collabDraft.trim()
    const comment: ReviewComment = {
      id: `c${Date.now()}`,
      slideId: activeSlide.id,
      target: selectedTarget,
      request: prompt,
      status: 'open',
    }
    setComments((current) => [comment, ...current])
    setAgentMessages((current) => [
      ...current,
      { id: `m${Date.now()}`, role: 'user', text: `修改【${comment.target}】：${comment.request}` },
      {
        id: `m${Date.now() + 1}`,
        role: 'agent',
        text: '已收到这条带对象定位的修改要求。我会把它作为修订任务处理，不会静默覆盖你的内容。',
      },
    ])
    window.dispatchEvent(new CustomEvent('vizual-studio:comment-added', { detail: comment }))
    setCollabDraft('')
  }

  function resolveOpenComments() {
    const pending = comments.filter((comment) => comment.status === 'open')
    if (!pending.length) return

    pending.forEach((comment) => {
      if (comment.target === '图表') {
        updateSlide(comment.slideId, { visual: 'combo', status: 'review', visualHeight: 320 })
      }
      if (comment.target === '标题' && /不换行|不要换行|单行|一行/.test(comment.request)) {
        updateSlide(comment.slideId, { titleWrap: 'nowrap', titleWidth: 92, titleSize: 32, status: 'review' })
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
      if (comment.target === '图片') {
        updateSlide(comment.slideId, { imageTone: 'mono', imageZoom: 112, status: 'review' })
      }
      if (comment.target === '整页') {
        updateSlide(comment.slideId, { status: 'review', bodyWidth: 82 })
      }
    })

    setComments((current) => current.map((comment) => (comment.status === 'open' ? { ...comment, status: 'resolved' } : comment)))
    addRevision(`Agent 已处理 ${pending.length} 条带对象定位的修改要求。`, '协作待办', 'accepted')
    setAgentMessages((current) => [...current, { id: `m${Date.now()}`, role: 'agent', text: `我处理了 ${pending.length} 条待办，并生成了可审阅的修订记录。` }])
  }

  function setRevisionStatus(id: string, status: Revision['status']) {
    setRevisions((current) => current.map((revision) => (revision.id === id ? { ...revision, status } : revision)))
  }

  function exportHtml() {
    downloadText('vizual-studio-deck.html', createStandaloneHtml(slides, brandGuide, designControls, projectTitle))
  }

  function resetDemo() {
    window.localStorage.removeItem(STORAGE_KEY)
    setView('home')
    setProjectTitle('2026 Q1 经营分析汇报')
    setDesignControls(initialDesign)
    setSlides(initialSlides)
    setComments(initialComments)
    setRevisions(initialRevisions)
    setAgentMessages(initialAgentMessages)
    setActiveSlideId(initialSlides[0].id)
    setSelectedTarget('整页')
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--studio-bg', designControls.background)
    document.documentElement.style.setProperty('--studio-surface', designControls.surface)
    document.documentElement.style.setProperty('--studio-text', designControls.text)
    document.documentElement.style.setProperty('--studio-heading', designControls.text)
    document.documentElement.style.setProperty('--studio-muted', designControls.muted)
    document.documentElement.style.setProperty('--studio-accent', designControls.accent)
    document.documentElement.style.setProperty('--studio-radius', `${designControls.radius}px`)
  }, [designControls])

  useEffect(() => {
    const project: StoredProject = { view, projectTitle, designControls, slides, comments, revisions, agentMessages }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  }, [view, projectTitle, designControls, slides, comments, revisions, agentMessages])

  // The bridge intentionally mirrors the latest React state for browser-controlled agents.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.VizualStudio = {
      snapshot: () => ({
        view,
        projectTitle,
        activeSlideId,
        selectedTarget,
        slides,
        comments,
        revisions,
        designControls,
        mappingReport: themeReport,
      }),
      getOpenComments: () => comments.filter((comment) => comment.status === 'open'),
      applyAgentAction,
      addAgentMessage: (text: string) => applyAgentAction({ type: 'addAgentMessage', text }),
      createFromTemplate: createDeckFromTemplate,
      navigate: setView,
    }
  })

  return (
    <div className="studio-app">
      <header className="appbar">
        <button className="app-brand" type="button" onClick={() => setView('home')}>
          <span className="brand-mark">V</span>
          <span>
            <strong>Vizual Studio</strong>
            <small>AI PPT 协作平台</small>
          </span>
        </button>

        <nav className="app-nav" aria-label="主导航">
          {[
            ['home', '首页'],
            ['editor', 'PPT 编辑'],
            ['design', '品牌风格'],
          ].map(([key, label]) => (
            <button className={view === key ? 'active' : ''} key={key} type="button" onClick={() => setView(key as AppView)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="project-title">
          <span>当前项目</span>
          <strong>{projectTitle}</strong>
        </div>

        <div className="app-actions">
          <span>内部预览版</span>
          <button type="button" onClick={resetDemo}>
            重置
          </button>
          <button type="button" onClick={() => window.print()}>
            导出 PDF
          </button>
          <button type="button" onClick={exportHtml}>
            导出 HTML
          </button>
        </div>
      </header>

      {view === 'home' && (
        <main className="home-page">
          <section className="home-hero">
            <div>
              <p className="eyebrow">面向 AI Agent 的商业演示工作台</p>
              <h1>从一句需求到可批注、可修改、可交付的专业 PPT。</h1>
              <p>
                选择模板开始，或让 Agent 读取你的数据和目标受众，生成一份真正能被业务团队继续打磨的 HTML 演示文稿。
              </p>
              <div className="hero-actions">
                <button type="button" onClick={() => createDeckFromTemplate('monthly')}>
                  从月报开始
                </button>
                <button type="button" onClick={() => setView('editor')}>
                  打开当前项目
                </button>
              </div>
            </div>
            <div className="hero-preview" aria-hidden>
              <div className="hero-slide">
                <span />
                <strong>经营分析汇报</strong>
                <p>趋势 · 风险 · 行动</p>
                <div className="hero-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </section>

          <section className="home-section">
            <div className="section-head">
              <div>
                <span>快速开始</span>
                <h2>选择一个报告模板</h2>
              </div>
              <button type="button" onClick={() => setView('design')}>
                先调整品牌风格
              </button>
            </div>
            <div className="template-grid">
              {templates.map((template) => (
                <button className="template-card" key={template.id} type="button" onClick={() => createDeckFromTemplate(template.id)}>
                  <span>{template.tone}</span>
                  <strong>{template.title}</strong>
                  <p>{template.subtitle}</p>
                  <small>{template.slides} 页建议结构</small>
                </button>
              ))}
            </div>
          </section>

          <section className="home-section two-column">
            <div>
              <div className="section-head compact">
                <div>
                  <span>最近项目</span>
                  <h2>继续已有工作</h2>
                </div>
              </div>
              <div className="recent-list">
                {recentProjects.map((project) => (
                  <button className="recent-row" key={project.title} type="button" onClick={() => setView('editor')}>
                    <strong>{project.title}</strong>
                    <span>{project.status}</span>
                    <small>{project.updated}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="home-agent-card">
              <span>Agent 接入</span>
              <h2>右侧协作面板会把批注变成修订任务</h2>
              <p>
                内部版通过浏览器桥暴露 `window.VizualStudio`，Agent 可以读取当前页面、批注、修订和品牌风格，再写回可审阅的修改。
              </p>
              <button type="button" onClick={() => setView('editor')}>
                体验协作流
              </button>
            </div>
          </section>
        </main>
      )}

      {view === 'design' && (
        <main className="design-page">
          <section className="design-controls">
            <div className="panel-title">
              <span>品牌风格</span>
              <h1>把组织的视觉规范变成可复用的演示风格</h1>
              <p>这里调整的颜色、圆角、密度和动效会实时应用到 PPT 画布和 Vizual 图表组件。</p>
            </div>

            <label>
              品牌名称
              <input value={designControls.brandName} onChange={(event) => updateControl('brandName', event.target.value)} />
            </label>
            <div className="color-grid">
              <label>
                主色
                <input type="color" value={designControls.accent} onChange={(event) => updateControl('accent', event.target.value)} />
              </label>
              <label>
                背景
                <input type="color" value={designControls.background} onChange={(event) => updateControl('background', event.target.value)} />
              </label>
              <label>
                版面
                <input type="color" value={designControls.surface} onChange={(event) => updateControl('surface', event.target.value)} />
              </label>
              <label>
                文字
                <input type="color" value={designControls.text} onChange={(event) => updateControl('text', event.target.value)} />
              </label>
            </div>
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
              <select value={designControls.density} onChange={(event) => updateControl('density', event.target.value as DesignControls['density'])}>
                <option value="executive">{densityLabels.executive}</option>
                <option value="analytical">{densityLabels.analytical}</option>
                <option value="board">{densityLabels.board}</option>
              </select>
            </label>
            <label>
              动效强度
              <select value={designControls.motion} onChange={(event) => updateControl('motion', event.target.value as DesignControls['motion'])}>
                <option value="none">{motionLabels.none}</option>
                <option value="subtle">{motionLabels.subtle}</option>
                <option value="cinematic">{motionLabels.cinematic}</option>
              </select>
            </label>
          </section>

          <section className="design-preview">
            <div className="section-head">
              <div>
                <span>实时预览</span>
                <h2>同一套风格覆盖页面、图表、表格和按钮</h2>
              </div>
              <div className="mapping-pill">
                标准映射 {themeReport?.mappedCount ?? 0}/{themeReport?.tokenCount ?? 0} · {themeReport?.qualityScore ?? 0}分
              </div>
            </div>
            <div className="design-slide-preview">
              <div>
                <p className="eyebrow">{designControls.brandName}</p>
                <h2>品牌一致的经营汇报页面</h2>
                <p>图表、按钮、卡片和文字都会跟随同一份标准风格源变化。</p>
                <button type="button">主要行动</button>
              </div>
              <div className="preview-viz">
                <VizualRenderer spec={buildVizualSpec({ ...activeSlide, visual: 'combo', visualHeight: 260 })} />
              </div>
            </div>
            <div className="token-strip">
              {[
                ['主色', designControls.accent],
                ['背景', designControls.background],
                ['版面', designControls.surface],
                ['文字', designControls.text],
                ['辅助文字', designControls.muted],
              ].map(([label, value]) => (
                <div key={label}>
                  <i style={{ background: value }} />
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {view === 'editor' && (
        <div className="product-layout">
          <main className="content-workspace">
            <aside className="slide-rail">
              <div className="rail-head">
                <strong>页面</strong>
                <button type="button" onClick={() => setSlides((current) => [...current, { ...initialSlides[1], id: `slide-${Date.now()}`, status: 'draft' }])}>
                  新增
                </button>
              </div>
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
                  <strong>{slide.title.replace('\n', ' ')}</strong>
                  <small>{statusLabels[slide.status]}</small>
                </button>
              ))}
            </aside>

            <section className="canvas-workspace">
              <div className="canvas-toolbar">
                <div className="target-switcher">
                  {(['整页', '标题', '正文', '图表', '图片'] as SelectedTarget[]).map((target) => (
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
                  <span>{deckProgress}% 已确认</span>
                </div>
              </div>

              <div className={`slide-canvas slide-${activeSlide.layout}`} onClick={() => setSelectedTarget('整页')}>
                <div className="slide-copy">
                  <p className="eyebrow">{activeSlide.kicker}</p>
                  <h1
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                      width: `${activeSlide.titleWidth}%`,
                      fontSize: `${activeSlide.titleSize}px`,
                      whiteSpace: activeSlide.titleWrap === 'nowrap' ? 'nowrap' : 'pre-wrap',
                      overflowWrap: activeSlide.titleWrap === 'nowrap' ? 'normal' : 'anywhere',
                      wordBreak: activeSlide.titleWrap === 'nowrap' ? 'keep-all' : 'break-all',
                    }}
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
                    style={{
                      width: `${activeSlide.bodyWidth}%`,
                      fontSize: `${activeSlide.bodySize}px`,
                      whiteSpace: activeSlide.bodyWrap === 'nowrap' ? 'nowrap' : 'normal',
                      overflowWrap: activeSlide.bodyWrap === 'nowrap' ? 'normal' : 'anywhere',
                      wordBreak: activeSlide.bodyWrap === 'nowrap' ? 'keep-all' : 'break-all',
                    }}
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
                  <div className="slide-media-grid">
                    <button
                      className={selectedTarget === '图片' ? `image-block tone-${activeSlide.imageTone} selected` : `image-block tone-${activeSlide.imageTone}`}
                      style={{ backgroundPosition: `${activeSlide.imageX}% ${activeSlide.imageY}%`, backgroundSize: `${activeSlide.imageZoom}%` }}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedTarget('图片')
                      }}
                    >
                      <span>业务场景图</span>
                    </button>
                    <div
                      className={selectedTarget === '图表' ? 'slide-viz selected' : 'slide-viz'}
                      style={{ minHeight: activeSlide.visualHeight }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedTarget('图表')
                      }}
                    >
                      <VizualRenderer spec={activeSpec} />
                    </div>
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
                处理待办
              </button>
            </div>

            <div className="agent-tabs">
              {[
                ['chat', '协作'],
                ['tweak', '微调'],
                ['review', '修订'],
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
                  {openComments.map((comment) => (
                    <article className="message task" key={comment.id}>
                      <strong>{comment.slideId} · {comment.target}</strong>
                      <span>{comment.request}</span>
                    </article>
                  ))}
                  {agentMessages.map((message) => (
                    <article className={`message ${message.role}`} key={message.id}>
                      {message.text}
                    </article>
                  ))}
                </div>
                <div className="chat-box">
                  <span>提交给 Agent 修改：{selectedTarget}</span>
                  <textarea
                    value={collabDraft}
                    onChange={(event) => setCollabDraft(event.target.value)}
                    placeholder="例如：这个标题不要换行；这张图改成组合图并强调拐点；这张图片裁得更紧凑"
                    rows={3}
                  />
                  <button type="button" onClick={submitAgentRequest}>
                    提交给 Agent
                  </button>
                </div>
              </section>
            )}

            {agentTab === 'tweak' && (
              <section className="agent-section tweak-section">
                <div className="tweak-target">当前微调对象：{selectedTarget}</div>
                {selectedTarget === '图表' && (
                  <>
                    <label>
                      视觉类型
                      <select value={activeSlide.visual} onChange={(event) => updateSlide(activeSlide.id, { visual: event.target.value as SlideVisual })}>
                        <option value="kpi">{visualLabels.kpi}</option>
                        <option value="combo">{visualLabels.combo}</option>
                        <option value="line">{visualLabels.line}</option>
                        <option value="table">{visualLabels.table}</option>
                      </select>
                    </label>
                    <label>
                      图表高度 {activeSlide.visualHeight}px
                      <input
                        type="range"
                        min="180"
                        max="440"
                        value={activeSlide.visualHeight}
                        onChange={(event) => updateSlide(activeSlide.id, { visualHeight: Number(event.target.value) })}
                      />
                    </label>
                  </>
                )}
                {selectedTarget === '图片' && (
                  <>
                    <label>
                      图片风格
                      <select value={activeSlide.imageTone} onChange={(event) => updateSlide(activeSlide.id, { imageTone: event.target.value as ImageTone })}>
                        <option value="business">商务蓝灰</option>
                        <option value="warm">暖色纸感</option>
                        <option value="mono">黑白高级</option>
                      </select>
                    </label>
                    <label>
                      缩放 {activeSlide.imageZoom}%
                      <input
                        type="range"
                        min="90"
                        max="150"
                        value={activeSlide.imageZoom}
                        onChange={(event) => updateSlide(activeSlide.id, { imageZoom: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      横向位置 {activeSlide.imageX}%
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={activeSlide.imageX}
                        onChange={(event) => updateSlide(activeSlide.id, { imageX: Number(event.target.value) })}
                      />
                    </label>
                  </>
                )}
                {selectedTarget === '标题' && (
                  <>
                    <label>
                      标题文本框宽度 {activeSlide.titleWidth}%
                      <input
                        type="range"
                        min="35"
                        max="100"
                        value={activeSlide.titleWidth}
                        onChange={(event) => updateSlide(activeSlide.id, { titleWidth: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      标题字号 {activeSlide.titleSize}px
                      <input
                        type="range"
                        min="24"
                        max="82"
                        value={activeSlide.titleSize}
                        onChange={(event) => updateSlide(activeSlide.id, { titleSize: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      标题换行
                      <select value={activeSlide.titleWrap} onChange={(event) => updateSlide(activeSlide.id, { titleWrap: event.target.value as Slide['titleWrap'] })}>
                        <option value="wrap">允许换行</option>
                        <option value="nowrap">保持单行</option>
                      </select>
                    </label>
                  </>
                )}
                {selectedTarget === '正文' && (
                  <>
                    <label>
                      正文文本框宽度 {activeSlide.bodyWidth}%
                      <input
                        type="range"
                        min="35"
                        max="100"
                        value={activeSlide.bodyWidth}
                        onChange={(event) => updateSlide(activeSlide.id, { bodyWidth: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      正文字号 {activeSlide.bodySize}px
                      <input
                        type="range"
                        min="14"
                        max="32"
                        value={activeSlide.bodySize}
                        onChange={(event) => updateSlide(activeSlide.id, { bodySize: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      正文换行
                      <select value={activeSlide.bodyWrap} onChange={(event) => updateSlide(activeSlide.id, { bodyWrap: event.target.value as Slide['bodyWrap'] })}>
                        <option value="wrap">允许换行</option>
                        <option value="nowrap">保持单行</option>
                      </select>
                    </label>
                  </>
                )}
                {selectedTarget === '整页' && (
                  <>
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
                      <select value={designControls.density} onChange={(event) => updateControl('density', event.target.value as DesignControls['density'])}>
                        <option value="executive">{densityLabels.executive}</option>
                        <option value="analytical">{densityLabels.analytical}</option>
                        <option value="board">{densityLabels.board}</option>
                      </select>
                    </label>
                  </>
                )}
              </section>
            )}

            {agentTab === 'review' && (
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
      )}
    </div>
  )
}

export default App
