import { useEffect, useMemo, useState, type FormEvent, type PointerEvent } from 'react'
import { VizualRenderer, loadDesignMd, type ThemeMappingReport, type VizualSpec } from 'vizual'
import './App.css'

type AppView = 'home' | 'editor' | 'design'
type AgentTab = 'chat' | 'tweak' | 'review'
type CanvasMode = 'select' | 'edit' | 'draw' | 'click'
type SelectedTarget = '整页' | '标题' | '正文' | '图表' | '图片' | '手绘区域'
type StyleTargetKey = 'page' | 'title' | 'body' | 'visual' | 'image'

type ElementStyle = {
  font: string
  size: number
  weight: number
  color: string
  align: 'left' | 'center' | 'right'
  line: number
  tracking: number
  width: number
  height: number
  opacity: number
  padding: number
  margin: number
  border: number
  radius: number
  wrap: 'wrap' | 'nowrap'
}

type DrawRect = {
  x: number
  y: number
  width: number
  height: number
}

type DesignControls = {
  styleName: string
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
  styles?: Partial<Record<StyleTargetKey, Partial<ElementStyle>>>
}

type ReviewComment = {
  id: string
  slideId: string
  target: SelectedTarget
  request: string
  status: 'open' | 'resolved'
  mode?: 'chat' | 'draw' | 'click'
  bbox?: DrawRect
}

type AnnotationTask = {
  id: string
  slideId: string
  target: SelectedTarget
  mode: 'draw' | 'click'
  instruction: string
  bbox?: DrawRect
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
  annotationQueue?: AnnotationTask[]
}

type StudioAgentAction =
  | { type: 'navigate'; view: AppView }
  | { type: 'createFromTemplate'; templateId: string }
  | { type: 'updateSlide'; slideId?: string; patch: Partial<Slide>; summary?: string }
  | { type: 'replaceVisual'; slideId?: string; visual: SlideVisual; summary?: string }
  | { type: 'applyBrand'; patch: Partial<DesignControls>; summary?: string }
  | { type: 'applyDesignStyle'; patch: Partial<DesignControls>; summary?: string }
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
        canvasMode: CanvasMode
        slides: Slide[]
        comments: ReviewComment[]
        revisions: Revision[]
        annotationQueue: AnnotationTask[]
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
  styleName: '招商经营分析',
  accent: '#c8152d',
  background: '#f6f2ea',
  surface: '#ffffff',
  text: '#1c2430',
  muted: '#697386',
  radius: 10,
  density: 'executive',
  motion: 'subtle',
}

const designPresets: Array<{ id: string; title: string; description: string; controls: DesignControls }> = [
  {
    id: 'cmb',
    title: '企业红 · 经营汇报',
    description: '适合银行、管理层复盘、经营分析和风险汇报。',
    controls: initialDesign,
  },
  {
    id: 'ink',
    title: '黑白资讯 · 高密度',
    description: '适合战略洞察、行业研究、咨询报告。',
    controls: {
      styleName: '黑白战略研究',
      accent: '#057dbc',
      background: '#ffffff',
      surface: '#ffffff',
      text: '#111111',
      muted: '#6f6f6f',
      radius: 0,
      density: 'analytical',
      motion: 'none',
    },
  },
  {
    id: 'green',
    title: '暖绿零售 · 产品展示',
    description: '适合产品介绍、客户方案、品牌提案。',
    controls: {
      styleName: '暖绿产品叙事',
      accent: '#00754a',
      background: '#f2f0eb',
      surface: '#ffffff',
      text: '#1e3932',
      muted: '#5f6f68',
      radius: 18,
      density: 'executive',
      motion: 'subtle',
    },
  },
]

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

  return `# ${controls.styleName} Design System

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

function normalizeDesignControls(input?: (Partial<DesignControls> & { brandName?: string }) | null): DesignControls {
  if (!input) return initialDesign

  return {
    ...initialDesign,
    ...input,
    styleName: input.styleName ?? input.brandName ?? initialDesign.styleName,
  }
}

function targetToStyleKey(target: SelectedTarget): StyleTargetKey {
  if (target === '标题') return 'title'
  if (target === '正文') return 'body'
  if (target === '图表') return 'visual'
  if (target === '图片') return 'image'
  return 'page'
}

function defaultElementStyle(slide: Slide, target: SelectedTarget, controls: DesignControls): ElementStyle {
  if (target === '标题') {
    return {
      font: 'Inter / Microsoft YaHei',
      size: slide.titleSize,
      weight: 800,
      color: controls.text,
      align: 'left',
      line: 1.06,
      tracking: 0,
      width: slide.titleWidth,
      height: 0,
      opacity: 1,
      padding: 0,
      margin: 14,
      border: 0,
      radius: 0,
      wrap: slide.titleWrap,
    }
  }

  if (target === '正文') {
    return {
      font: 'Inter / Microsoft YaHei',
      size: slide.bodySize,
      weight: 420,
      color: controls.text,
      align: 'left',
      line: 1.42,
      tracking: 0,
      width: slide.bodyWidth,
      height: 0,
      opacity: 0.92,
      padding: 0,
      margin: 0,
      border: 0,
      radius: 0,
      wrap: slide.bodyWrap,
    }
  }

  if (target === '图表') {
    return {
      font: 'Inter / Microsoft YaHei',
      size: 16,
      weight: 500,
      color: controls.text,
      align: 'left',
      line: 1.2,
      tracking: 0,
      width: 100,
      height: slide.visualHeight,
      opacity: 1,
      padding: 0,
      margin: 0,
      border: 0,
      radius: controls.radius,
      wrap: 'wrap',
    }
  }

  if (target === '图片') {
    return {
      font: 'Inter / Microsoft YaHei',
      size: 14,
      weight: 700,
      color: controls.text,
      align: 'left',
      line: 1.2,
      tracking: 0,
      width: 42,
      height: 250,
      opacity: 1,
      padding: 18,
      margin: 0,
      border: 1,
      radius: controls.radius,
      wrap: 'wrap',
    }
  }

  return {
    font: 'Inter / Microsoft YaHei',
    size: 16,
    weight: 500,
    color: controls.text,
    align: 'left',
    line: 1.2,
    tracking: 0,
    width: 100,
    height: 0,
    opacity: 1,
    padding: 52,
    margin: 0,
    border: 1,
    radius: 0,
    wrap: 'wrap',
  }
}

function resolveElementStyle(slide: Slide, target: SelectedTarget, controls: DesignControls): ElementStyle {
  const key = targetToStyleKey(target)
  return {
    ...defaultElementStyle(slide, target, controls),
    ...(slide.styles?.[key] ?? {}),
  }
}

function getLocalPercent(event: PointerEvent<HTMLElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  }
}

function buildVizualSpec(slide: Slide): VizualSpec {
  const chartHeight = slide.styles?.visual?.height ?? slide.visualHeight

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
            height: chartHeight,
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
          height: chartHeight,
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
  <!-- Design style source:
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
  const [designControls, setDesignControls] = useState(() =>
    normalizeDesignControls(stored.designControls as Partial<DesignControls> & { brandName?: string }),
  )
  const [slides, setSlides] = useState(stored.slides ?? initialSlides)
  const [comments, setComments] = useState(stored.comments ?? initialComments)
  const [revisions, setRevisions] = useState(stored.revisions ?? initialRevisions)
  const [agentMessages, setAgentMessages] = useState(stored.agentMessages ?? initialAgentMessages)
  const [annotationQueue, setAnnotationQueue] = useState<AnnotationTask[]>(stored.annotationQueue ?? [])
  const [activeSlideId, setActiveSlideId] = useState(slides[0].id)
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>('整页')
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('select')
  const [collabDraft, setCollabDraft] = useState('')
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null)
  const [homePrompt, setHomePrompt] = useState('')

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0]
  const activeSpec = useMemo(() => buildVizualSpec(activeSlide), [activeSlide])
  const selectedStyle = useMemo(
    () => resolveElementStyle(activeSlide, selectedTarget, designControls),
    [activeSlide, selectedTarget, designControls],
  )
  const titleStyle = useMemo(() => resolveElementStyle(activeSlide, '标题', designControls), [activeSlide, designControls])
  const bodyStyle = useMemo(() => resolveElementStyle(activeSlide, '正文', designControls), [activeSlide, designControls])
  const visualStyle = useMemo(() => resolveElementStyle(activeSlide, '图表', designControls), [activeSlide, designControls])
  const imageStyle = useMemo(() => resolveElementStyle(activeSlide, '图片', designControls), [activeSlide, designControls])
  const brandGuide = useMemo(() => buildBrandGuide(designControls), [designControls])
  const themeReport = useMemo<ThemeMappingReport | undefined>(() => {
    try {
      const theme = loadDesignMd(brandGuide, { name: 'vizual-studio-live', apply: true })
      return theme._mappingReport
    } catch (error) {
      console.warn('Failed to apply design style', error)
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

  function updateElementStyle(target: SelectedTarget, patch: Partial<ElementStyle>) {
    const key = targetToStyleKey(target)
    updateSlide(activeSlide.id, {
      styles: {
        ...(activeSlide.styles ?? {}),
        [key]: {
          ...(activeSlide.styles?.[key] ?? {}),
          ...patch,
        },
      },
    })
  }

  function selectCanvasMode(nextMode: CanvasMode) {
    setCanvasMode(nextMode)
    setDrawStart(null)
    setDrawRect(null)
    if (nextMode === 'edit') {
      setAgentTab('tweak')
    }
    if (nextMode === 'draw' || nextMode === 'click') {
      setAgentTab('chat')
    }
  }

  function handleTargetSelect(target: SelectedTarget) {
    setSelectedTarget(target)
    if (canvasMode === 'edit') {
      setAgentTab('tweak')
    }
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (canvasMode !== 'draw') return
    const point = getLocalPercent(event)
    setSelectedTarget('手绘区域')
    setDrawStart(point)
    setDrawRect({ x: point.x, y: point.y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (canvasMode !== 'draw' || !drawStart) return
    const point = getLocalPercent(event)
    setDrawRect({
      x: Math.min(drawStart.x, point.x),
      y: Math.min(drawStart.y, point.y),
      width: Math.abs(point.x - drawStart.x),
      height: Math.abs(point.y - drawStart.y),
    })
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (canvasMode !== 'draw') return
    setDrawStart(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function queueAnnotation() {
    const instruction = annotationDraft.trim()
    if (!instruction) return
    const task: AnnotationTask = {
      id: `a${Date.now()}`,
      slideId: activeSlide.id,
      target: canvasMode === 'draw' ? '手绘区域' : selectedTarget,
      mode: canvasMode === 'draw' ? 'draw' : 'click',
      instruction,
      bbox: canvasMode === 'draw' && drawRect ? drawRect : undefined,
    }
    setAnnotationQueue((current) => [task, ...current])
    setAnnotationDraft('')
    setDrawRect(null)
  }

  function sendAnnotationQueue() {
    if (!annotationQueue.length) return
    const queuedComments: ReviewComment[] = annotationQueue.map((task) => ({
      id: `c${Date.now()}-${task.id}`,
      slideId: task.slideId,
      target: task.target,
      request: task.instruction,
      status: 'open',
      mode: task.mode,
      bbox: task.bbox,
    }))
    setComments((current) => [...queuedComments, ...current])
    setAgentMessages((current) => [
      ...current,
      {
        id: `m${Date.now()}`,
        role: 'user',
        text: `提交了 ${queuedComments.length} 条画布标注，请按目标逐条生成修订建议。`,
      },
      {
        id: `m${Date.now() + 1}`,
        role: 'agent',
        text: '已收到标注队列。每条标注都包含页面、目标、框选范围和说明，我会把它们作为可审阅修订处理。',
      },
    ])
    window.dispatchEvent(new CustomEvent('vizual-studio:annotation-queue-sent', { detail: queuedComments }))
    setAnnotationQueue([])
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

  function createDeckFromTemplate(templateId: string, prompt?: string) {
    const next = patchSlidesForTemplate(templateId)
    setProjectTitle(next.title)
    setSlides(next.slides)
    setComments([])
    setAnnotationQueue([])
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
        text: prompt
          ? `我已经根据你的需求「${prompt}」建立一版「${next.title}」。你可以直接改文字，也可以选中图表、图片或整页提交修改要求。`
          : `我已经按「${next.title}」建立一版可编辑 PPT。你可以直接改文字，也可以选中图表、图片或整页提交修改要求。`,
      },
    ])
    setActiveSlideId(next.slides[0].id)
    setSelectedTarget('整页')
    setView('editor')
  }

  function createDeckFromPrompt() {
    const prompt = homePrompt.trim() || '生成一份月度经营复盘，突出业务趋势、风险和行动建议'
    createDeckFromTemplate('monthly', prompt)
    setHomePrompt('')
  }

  function createNewSlide() {
    const nextSlide: Slide = {
      ...slideBase,
      id: `slide-${Date.now()}`,
      layout: 'insight',
      visual: 'combo',
      status: 'draft',
      kicker: '新增页面',
      title: '新的分析页面',
      body: '点击文字直接编辑内容，或选中图表提交给 AI 修改。',
      speakerNote: '补充讲稿或数据口径。',
    }
    setSlides((current) => [...current, nextSlide])
    setActiveSlideId(nextSlide.id)
    setSelectedTarget('整页')
  }

  function duplicateActiveSlide() {
    const index = slides.findIndex((slide) => slide.id === activeSlide.id)
    const copy: Slide = {
      ...activeSlide,
      id: `${activeSlide.id}-copy-${Date.now()}`,
      title: `${activeSlide.title.replace('\n', ' ')} 副本`,
      status: 'draft',
    }
    setSlides((current) => {
      const next = [...current]
      next.splice(index + 1, 0, copy)
      return next
    })
    setActiveSlideId(copy.id)
    setSelectedTarget('整页')
  }

  function deleteActiveSlide() {
    if (slides.length <= 1) return
    const index = slides.findIndex((slide) => slide.id === activeSlide.id)
    const nextSlides = slides.filter((slide) => slide.id !== activeSlide.id)
    setSlides(nextSlides)
    setActiveSlideId(nextSlides[Math.max(0, index - 1)].id)
    setSelectedTarget('整页')
  }

  function moveActiveSlide(direction: -1 | 1) {
    const index = slides.findIndex((slide) => slide.id === activeSlide.id)
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= slides.length) return
    setSlides((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  function applyDesignPreset(id: string) {
    const preset = designPresets.find((item) => item.id === id)
    if (!preset) return
    setDesignControls(preset.controls)
    addRevision(`已套用「${preset.title}」设计风格。`, '设计风格', 'accepted')
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

    if (action.type === 'applyBrand' || action.type === 'applyDesignStyle') {
      setDesignControls((current) => ({ ...current, ...action.patch }))
      addRevision(action.summary ?? 'Agent 已调整设计风格。', '设计风格', 'accepted')
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
      if (comment.target === '手绘区域') {
        updateSlide(comment.slideId, { status: 'review' })
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
    setAnnotationQueue([])
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
    const project: StoredProject = { view, projectTitle, designControls, slides, comments, revisions, agentMessages, annotationQueue }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  }, [view, projectTitle, designControls, slides, comments, revisions, agentMessages, annotationQueue])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey) return
      if (event.key === '1') {
        event.preventDefault()
        selectCanvasMode('draw')
      }
      if (event.key === '2') {
        event.preventDefault()
        selectCanvasMode('click')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // The bridge intentionally mirrors the latest React state for browser-controlled agents.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.VizualStudio = {
      snapshot: () => ({
        view,
        projectTitle,
        activeSlideId,
        selectedTarget,
        canvasMode,
        slides,
        comments,
        revisions,
        annotationQueue,
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
      <header className={`appbar appbar-${view}`}>
        <button className="app-brand" type="button" onClick={() => setView('home')}>
          <span className="brand-mark">V</span>
          <span>
            <strong>Vizual Studio</strong>
            <small>AI PPT 协作平台</small>
          </span>
        </button>

        {view === 'home' && (
          <>
            <div className="home-search" aria-label="搜索">
              <span>搜索项目、模板或设计风格</span>
            </div>
            <div className="context-actions">
              <button type="button" onClick={() => setView('design')}>
                设计风格库
              </button>
              <button className="primary-action" type="button" onClick={() => createDeckFromTemplate('monthly')}>
                新建 PPT
              </button>
            </div>
          </>
        )}

        {view === 'editor' && (
          <>
            <button className="back-link" type="button" onClick={() => setView('home')}>
              工作台
            </button>
            <div className="context-title">
              <span>PPT 编辑</span>
              <strong>{projectTitle}</strong>
              <small>
                {slides.length} 页 · {deckProgress}% 已确认 · {openComments.length} 条待处理
              </small>
            </div>
            <div className="context-actions editor-context-actions">
              <div className="mode-switch appbar-mode-switch" aria-label="画布模式">
                {[
                  ['select', '选择'],
                  ['edit', 'Edit'],
                  ['draw', 'Draw'],
                  ['click', 'Click'],
                ].map(([mode, label]) => (
                  <button
                    className={canvasMode === mode ? 'active' : ''}
                    key={mode}
                    type="button"
                    onClick={() => selectCanvasMode(mode as CanvasMode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setView('design')}>
                设计风格
              </button>
              <button type="button" onClick={() => window.print()}>
                导出 PDF
              </button>
              <button type="button" onClick={exportHtml}>
                导出 HTML
              </button>
            </div>
          </>
        )}

        {view === 'design' && (
          <>
            <button className="back-link" type="button" onClick={() => setView('home')}>
              工作台
            </button>
            <div className="context-title">
              <span>设计风格库</span>
              <strong>{designControls.styleName}</strong>
              <small>
                标准映射 {themeReport?.mappedCount ?? 0}/{themeReport?.tokenCount ?? 0} · {themeReport?.qualityScore ?? 0} 分
              </small>
            </div>
            <div className="context-actions">
              <button type="button" onClick={resetDemo}>
                重置演示数据
              </button>
              <button className="primary-action" type="button" onClick={() => setView('editor')}>
                应用并返回 PPT
              </button>
            </div>
          </>
        )}
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
              <textarea
                value={homePrompt}
                onChange={(event) => setHomePrompt(event.target.value)}
                placeholder="告诉 AI 你要做什么，例如：做一份华东区三月经营复盘，重点看收入、活跃用户、风险和下月行动。"
                rows={3}
              />
              <button type="button" onClick={createDeckFromPrompt}>
                让 AI 生成草稿
              </button>
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
                先选择设计风格
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
              <span>协作方式</span>
              <h2>右侧协作面板会把批注变成修订任务</h2>
              <p>
                用户选中页面、标题、正文、图表或图片后，直接把修改意见提交给 AI。AI 的修改会进入修订记录，用户可以继续确认、拒绝或再追问。
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
              <span>设计风格</span>
              <h1>为不同 PPT 保存多套可复用的设计风格</h1>
              <p>这里调整的颜色、圆角、密度和动效会实时应用到 PPT 画布和 Vizual 图表组件。</p>
            </div>

            <div className="style-preset-list">
              {designPresets.map((preset) => (
                <button
                  className={preset.controls.accent === designControls.accent && preset.controls.styleName === designControls.styleName ? 'active' : ''}
                  key={preset.id}
                  type="button"
                  onClick={() => applyDesignPreset(preset.id)}
                >
                  <i style={{ background: preset.controls.accent }} />
                  <span>
                    <strong>{preset.title}</strong>
                    <small>{preset.description}</small>
                  </span>
                </button>
              ))}
            </div>

            <label>
              风格名称
              <input value={designControls.styleName} onChange={(event) => updateControl('styleName', event.target.value)} />
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
                <p className="eyebrow">{designControls.styleName}</p>
                <h2>设计一致的经营汇报页面</h2>
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
                <button type="button" onClick={createNewSlide}>
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
                <div className="selection-context">
                  <span>当前选中</span>
                  <strong>{selectedTarget}</strong>
                  <small>
                    {canvasMode === 'edit'
                      ? 'Edit 模式：文字可直接在画布上改'
                      : canvasMode === 'draw'
                        ? 'Draw 模式：拖拽圈选区域并写修改说明'
                        : canvasMode === 'click'
                          ? 'Click 模式：点选元素并写修改说明'
                          : '点击画布中的标题、正文、图表或图片即可切换'}
                  </small>
                </div>
                <div className="canvas-meta">
                  <span>{activeSlide.kicker}</span>
                  <span>{statusLabels[activeSlide.status]}</span>
                  <span>{deckProgress}% 已确认</span>
                </div>
              </div>

              <div className="page-actions">
                <label>
                  项目名称
                  <input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} />
                </label>
                <button type="button" onClick={() => moveActiveSlide(-1)}>
                  上移
                </button>
                <button type="button" onClick={() => moveActiveSlide(1)}>
                  下移
                </button>
                <button type="button" onClick={duplicateActiveSlide}>
                  复制当前页
                </button>
              <button type="button" onClick={deleteActiveSlide} disabled={slides.length <= 1}>
                  删除当前页
                </button>
              </div>

              <div
                className={`slide-canvas slide-${activeSlide.layout} canvas-mode-${canvasMode}`}
                onClick={() => handleTargetSelect('整页')}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
              >
                <div className="slide-copy">
                  <p className="eyebrow">{activeSlide.kicker}</p>
                  <h1
                    className={selectedTarget === '标题' ? 'editable-title selected' : 'editable-title'}
                    contentEditable={canvasMode === 'edit'}
                    suppressContentEditableWarning
                    style={{
                      width: `${titleStyle.width}%`,
                      minHeight: titleStyle.height ? `${titleStyle.height}px` : undefined,
                      fontSize: `${titleStyle.size}px`,
                      fontWeight: titleStyle.weight,
                      color: titleStyle.color,
                      textAlign: titleStyle.align,
                      lineHeight: titleStyle.line,
                      letterSpacing: `${titleStyle.tracking}px`,
                      opacity: titleStyle.opacity,
                      padding: `${titleStyle.padding}px`,
                      marginBottom: `${titleStyle.margin}px`,
                      border: titleStyle.border ? `${titleStyle.border}px solid var(--studio-accent)` : undefined,
                      borderRadius: `${titleStyle.radius}px`,
                      whiteSpace: titleStyle.wrap === 'nowrap' ? 'nowrap' : 'pre-wrap',
                      overflowWrap: titleStyle.wrap === 'nowrap' ? 'normal' : 'anywhere',
                      wordBreak: titleStyle.wrap === 'nowrap' ? 'keep-all' : 'break-all',
                    }}
                    onBlur={(event) => handleInlineText('title', event)}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleTargetSelect('标题')
                    }}
                  >
                    {activeSlide.title}
                  </h1>
                  <p
                    className={selectedTarget === '正文' ? 'editable-body selected' : 'editable-body'}
                    contentEditable={canvasMode === 'edit'}
                    suppressContentEditableWarning
                    style={{
                      width: `${bodyStyle.width}%`,
                      minHeight: bodyStyle.height ? `${bodyStyle.height}px` : undefined,
                      fontSize: `${bodyStyle.size}px`,
                      fontWeight: bodyStyle.weight,
                      color: bodyStyle.color,
                      textAlign: bodyStyle.align,
                      lineHeight: bodyStyle.line,
                      letterSpacing: `${bodyStyle.tracking}px`,
                      opacity: bodyStyle.opacity,
                      padding: `${bodyStyle.padding}px`,
                      marginTop: `${bodyStyle.margin}px`,
                      border: bodyStyle.border ? `${bodyStyle.border}px solid var(--studio-accent)` : undefined,
                      borderRadius: `${bodyStyle.radius}px`,
                      whiteSpace: bodyStyle.wrap === 'nowrap' ? 'nowrap' : 'normal',
                      overflowWrap: bodyStyle.wrap === 'nowrap' ? 'normal' : 'anywhere',
                      wordBreak: bodyStyle.wrap === 'nowrap' ? 'keep-all' : 'break-all',
                    }}
                    onBlur={(event) => handleInlineText('body', event)}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleTargetSelect('正文')
                    }}
                  >
                    {activeSlide.body}
                  </p>
                </div>

                {activeSlide.layout !== 'cover' && (
                  <div className="slide-media-grid">
                    <button
                      className={selectedTarget === '图片' ? `image-block tone-${activeSlide.imageTone} selected` : `image-block tone-${activeSlide.imageTone}`}
                      style={{
                        minHeight: `${imageStyle.height}px`,
                        opacity: imageStyle.opacity,
                        padding: `${imageStyle.padding}px`,
                        borderWidth: `${imageStyle.border}px`,
                        borderRadius: `${imageStyle.radius}px`,
                        backgroundPosition: `${activeSlide.imageX}% ${activeSlide.imageY}%`,
                        backgroundSize: `${activeSlide.imageZoom}%`,
                      }}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleTargetSelect('图片')
                      }}
                    >
                      <span>业务场景图</span>
                    </button>
                    <div
                      className={selectedTarget === '图表' ? 'slide-viz selected' : 'slide-viz'}
                      style={{
                        minHeight: visualStyle.height,
                        opacity: visualStyle.opacity,
                        padding: `${visualStyle.padding}px`,
                        borderWidth: `${visualStyle.border}px`,
                        borderRadius: `${visualStyle.radius}px`,
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleTargetSelect('图表')
                      }}
                    >
                      <VizualRenderer spec={activeSpec} />
                    </div>
                  </div>
                )}
                {drawRect && (
                  <div
                    className="draw-rect"
                    style={{
                      left: `${drawRect.x}%`,
                      top: `${drawRect.y}%`,
                      width: `${drawRect.width}%`,
                      height: `${drawRect.height}%`,
                    }}
                  />
                )}
                <footer>
                  <span>{designControls.styleName}</span>
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

              {(canvasMode === 'draw' || canvasMode === 'click') && (
                <div className="annotation-composer">
                  <div className="annotation-mode-tabs">
                    <button className={canvasMode === 'draw' ? 'active' : ''} type="button" onClick={() => selectCanvasMode('draw')}>
                      Draw ⌘1
                    </button>
                    <button className={canvasMode === 'click' ? 'active' : ''} type="button" onClick={() => selectCanvasMode('click')}>
                      Click ⌘2
                    </button>
                  </div>
                  <textarea
                    value={annotationDraft}
                    onChange={(event) => setAnnotationDraft(event.target.value)}
                    placeholder={
                      canvasMode === 'draw'
                        ? '圈出区域后输入：删除这个按钮 / 这里太挤了 / 换一种更高级的版式'
                        : `当前指向「${selectedTarget}」，输入你希望 AI 怎么修改`
                    }
                    rows={2}
                  />
                  <div className="annotation-actions">
                    <button type="button" onClick={queueAnnotation}>
                      加入队列
                    </button>
                    <button className="primary-action" type="button" onClick={sendAnnotationQueue} disabled={!annotationQueue.length}>
                      发送给 AI
                    </button>
                  </div>
                  <div className="annotation-queue">
                    <strong>Queue {annotationQueue.length}</strong>
                    {annotationQueue.slice(0, 4).map((task) => (
                      <span key={task.id}>
                        {task.mode === 'draw' ? '手绘' : '点击'} · {task.target}：{task.instruction}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </main>

          <aside className="agent-panel">
            <div className="agent-header">
              <div>
                <strong>AI 协作</strong>
                <span>选中对象：{selectedTarget}</span>
              </div>
              <button type="button" onClick={resolveOpenComments}>
                处理待办
              </button>
            </div>

            <div className="agent-tabs">
              {[
                ['chat', 'AI 修改'],
                ['tweak', '手动微调'],
                ['review', '修订记录'],
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
                  <span>让 AI 修改当前{selectedTarget}</span>
                  <textarea
                    value={collabDraft}
                    onChange={(event) => setCollabDraft(event.target.value)}
                    placeholder="例如：这个标题不要换行；这张图改成组合图并强调拐点；这张图片裁得更紧凑"
                    rows={3}
                  />
                  <button type="button" onClick={submitAgentRequest}>
                    提交给 AI
                  </button>
                </div>
              </section>
            )}

            {agentTab === 'tweak' && (
              <section className="agent-section tweak-section">
                <div className="tweak-target">
                  <strong>{selectedTarget}</strong>
                  <span>{canvasMode === 'edit' ? 'Edit 模式下可直接在画布打字，右侧负责精确样式。' : '手动微调只作用于当前选中对象。'}</span>
                </div>

                {(selectedTarget === '标题' || selectedTarget === '正文') && (
                  <div className="inspector-group">
                    <h3>Typography</h3>
                    <label>
                      Font
                      <select value={selectedStyle.font} onChange={(event) => updateElementStyle(selectedTarget, { font: event.target.value })}>
                        <option value="Inter / Microsoft YaHei">Inter / 微软雅黑</option>
                        <option value="Noto Sans SC">Noto Sans SC</option>
                        <option value="Source Han Serif SC">思源宋体</option>
                        <option value="DIN Alternate">DIN Alternate</option>
                      </select>
                    </label>
                    <div className="field-grid">
                      <label>
                        Size
                        <input type="number" value={selectedStyle.size} onChange={(event) => updateElementStyle(selectedTarget, { size: Number(event.target.value) })} />
                      </label>
                      <label>
                        Weight
                        <input type="number" step="50" value={selectedStyle.weight} onChange={(event) => updateElementStyle(selectedTarget, { weight: Number(event.target.value) })} />
                      </label>
                    </div>
                    <div className="field-grid">
                      <label>
                        Color
                        <input type="color" value={selectedStyle.color} onChange={(event) => updateElementStyle(selectedTarget, { color: event.target.value })} />
                      </label>
                      <label>
                        Align
                        <select value={selectedStyle.align} onChange={(event) => updateElementStyle(selectedTarget, { align: event.target.value as ElementStyle['align'] })}>
                          <option value="left">left</option>
                          <option value="center">center</option>
                          <option value="right">right</option>
                        </select>
                      </label>
                    </div>
                    <div className="field-grid">
                      <label>
                        Line
                        <input type="number" min="0.8" max="2.4" step="0.02" value={selectedStyle.line} onChange={(event) => updateElementStyle(selectedTarget, { line: Number(event.target.value) })} />
                      </label>
                      <label>
                        Tracking
                        <input type="number" step="0.2" value={selectedStyle.tracking} onChange={(event) => updateElementStyle(selectedTarget, { tracking: Number(event.target.value) })} />
                      </label>
                    </div>
                    <label>
                      换行约束
                      <select value={selectedStyle.wrap} onChange={(event) => updateElementStyle(selectedTarget, { wrap: event.target.value as ElementStyle['wrap'] })}>
                        <option value="wrap">允许换行</option>
                        <option value="nowrap">保持单行</option>
                      </select>
                    </label>
                  </div>
                )}

                {selectedTarget === '图表' && (
                  <div className="inspector-group">
                    <h3>Chart</h3>
                    <label>
                      图表类型
                      <select value={activeSlide.visual} onChange={(event) => updateSlide(activeSlide.id, { visual: event.target.value as SlideVisual })}>
                        <option value="kpi">{visualLabels.kpi}</option>
                        <option value="combo">{visualLabels.combo}</option>
                        <option value="line">{visualLabels.line}</option>
                        <option value="table">{visualLabels.table}</option>
                      </select>
                    </label>
                    <p>图表的数据结构和表达方式建议通过 AI 修改；这里保留安全的展示参数。</p>
                  </div>
                )}

                {selectedTarget === '图片' && (
                  <div className="inspector-group">
                    <h3>Image</h3>
                    <label>
                      图片风格
                      <select value={activeSlide.imageTone} onChange={(event) => updateSlide(activeSlide.id, { imageTone: event.target.value as ImageTone })}>
                        <option value="business">商务蓝灰</option>
                        <option value="warm">暖色纸感</option>
                        <option value="mono">黑白高级</option>
                      </select>
                    </label>
                    <div className="field-grid">
                      <label>
                        Zoom
                        <input type="number" value={activeSlide.imageZoom} onChange={(event) => updateSlide(activeSlide.id, { imageZoom: Number(event.target.value) })} />
                      </label>
                      <label>
                        X
                        <input type="number" value={activeSlide.imageX} onChange={(event) => updateSlide(activeSlide.id, { imageX: Number(event.target.value) })} />
                      </label>
                    </div>
                  </div>
                )}

                {selectedTarget === '整页' && (
                  <div className="inspector-group">
                    <h3>Design Style</h3>
                    <label>
                      设计主色
                      <input type="color" value={designControls.accent} onChange={(event) => updateControl('accent', event.target.value)} />
                    </label>
                    <label>
                      背景色
                      <input type="color" value={designControls.background} onChange={(event) => updateControl('background', event.target.value)} />
                    </label>
                    <label>
                      信息密度
                      <select value={designControls.density} onChange={(event) => updateControl('density', event.target.value as DesignControls['density'])}>
                        <option value="executive">{densityLabels.executive}</option>
                        <option value="analytical">{densityLabels.analytical}</option>
                        <option value="board">{densityLabels.board}</option>
                      </select>
                    </label>
                  </div>
                )}

                <div className="inspector-group">
                  <h3>Size</h3>
                  <div className="field-grid">
                    <label>
                      Width
                      <input type="number" value={selectedStyle.width} onChange={(event) => updateElementStyle(selectedTarget, { width: Number(event.target.value) })} />
                    </label>
                    <label>
                      Height
                      <input type="number" value={selectedStyle.height} onChange={(event) => updateElementStyle(selectedTarget, { height: Number(event.target.value) })} />
                    </label>
                  </div>
                </div>

                <div className="inspector-group">
                  <h3>Box</h3>
                  <div className="field-grid">
                    <label>
                      Opacity
                      <input type="number" min="0" max="1" step="0.05" value={selectedStyle.opacity} onChange={(event) => updateElementStyle(selectedTarget, { opacity: Number(event.target.value) })} />
                    </label>
                    <label>
                      Padding
                      <input type="number" value={selectedStyle.padding} onChange={(event) => updateElementStyle(selectedTarget, { padding: Number(event.target.value) })} />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      Margin
                      <input type="number" value={selectedStyle.margin} onChange={(event) => updateElementStyle(selectedTarget, { margin: Number(event.target.value) })} />
                    </label>
                    <label>
                      Border
                      <input type="number" value={selectedStyle.border} onChange={(event) => updateElementStyle(selectedTarget, { border: Number(event.target.value) })} />
                    </label>
                  </div>
                  <label>
                    Radius
                    <input type="number" value={selectedStyle.radius} onChange={(event) => updateElementStyle(selectedTarget, { radius: Number(event.target.value) })} />
                  </label>
                </div>
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
