import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from 'react'
import { VizualRenderer, loadDesignMd, type ThemeMappingReport, type VizualSpec } from 'vizual'
import './App.css'

type AppView = 'home' | 'editor' | 'design'
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
}

type DesignStyle = {
  id: string
  title: string
  description: string
  source: 'preset' | 'custom' | 'agent'
  updatedAt: string
  controls: DesignControls
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
  targetRef: string
  target: SelectedTarget
  request: string
  status: 'open' | 'resolved'
  mode?: 'chat' | 'draw' | 'click'
  bbox?: DrawRect
}

type BlockTarget = {
  id: string
  slideId: string
  target: SelectedTarget
  label: string
  stableRef: string
}

type RevisionPatch = {
  slideId?: string
  slide?: Partial<Slide>
  design?: Partial<DesignControls>
}

type Revision = {
  id: string
  target: string
  summary: string
  status: 'pending' | 'accepted' | 'rejected'
  sourceCommentId?: string
  patch?: RevisionPatch
  createdAt?: string
}

type AgentMessage = {
  id: string
  role: 'user' | 'agent'
  text: string
}

type StoredProject = {
  view: AppView
  projectTitle: string
  designControls?: DesignControls
  designStyles?: DesignStyle[]
  activeDesignStyleId?: string
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
  | { type: 'applyDesignStyle'; patch?: Partial<DesignControls>; styleId?: string; summary?: string }
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
        targetRefs: BlockTarget[]
        designControls: DesignControls
        designStyles: DesignStyle[]
        activeDesignStyleId: string
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
let idCounter = 0

function createId(prefix: string) {
  idCounter += 1
  return `${prefix}${idCounter}`
}

const initialDesign: DesignControls = {
  styleName: '招商经营分析',
  accent: '#c8152d',
  background: '#f6f2ea',
  surface: '#ffffff',
  text: '#1c2430',
  muted: '#697386',
  radius: 10,
  density: 'executive',
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
    targetRef: targetRefFor('growth-quality', '正文'),
    target: '正文',
    request: '把“筛选效应”和“不能直接因果归因”讲得更明确。',
    status: 'open',
  },
  {
    id: 'c2',
    slideId: 'revenue-trend',
    targetRef: targetRefFor('revenue-trend', '图表'),
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
    patch: { slideId: 'revenue-trend', slide: { visual: 'combo', visualHeight: 320, status: 'review' } },
    createdAt: 'demo-seed',
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

const densityDescriptions: Record<DesignControls['density'], string> = {
  executive: '大字号、大留白、突出结论',
  analytical: '更紧凑、更多指标和表格信息',
  board: '克制留白、适合正式汇报',
}

function buildBrandGuide(controls: DesignControls) {
  const densityText = {
    executive: 'High-level executive rhythm: fewer objects, stronger hierarchy, one decision per slide.',
    analytical: 'Analytical rhythm: denser tables and charts are allowed when they support auditability.',
    board: 'Board rhythm: restrained, high-contrast pages with strong source traceability.',
  }[controls.density]

  return `# ${controls.styleName} Design System

## Color Palette & Roles
### Primary
- Primary Accent (${controls.accent}): primary action, active state, chart-1, focus ring, high-priority callout.

### Surface & Background
- Background (${controls.background}): main page canvas and slide backdrop.
- Surface (${controls.surface}): slide panels, cards, control surfaces, data containers.
- Card (${controls.surface}): KPI cards, chart containers, table panels.

### Text
- Text Primary (${controls.text}): headings, body text, table values.
- Text Muted (${controls.muted}): captions, metadata, helper copy, axis labels.

### Chart Palette
- Chart 1 (${controls.accent}): primary data series.
- Chart 2 (${controls.muted}): secondary data series.
- Chart 3 (${controls.text}): emphasis data series.

### Semantic Colors
- Success (#16a34a): positive status.
- Warning (#f59e0b): caution status.
- Error (#dc2626): risk or destructive state.

## Typography Rules
- Primary font: Inter, Microsoft YaHei, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
- Display headings: 40px to 60px, weight 700, tight line-height.
- Slide body: 17px to 22px, weight 400, readable line-height.
- UI labels: 12px to 14px, weight 650.

## Component Stylings
- Cards use ${controls.radius}px radius.
- Buttons use ${Math.max(controls.radius * 2, 12)}px radius.
- KPI cards use Surface background, Text Primary values, Text Muted labels, and Primary Accent for trend emphasis.
- Tables use Surface background, Text Primary body, Text Muted headers, and subtle borders.
- Chart panels use Surface background, Chart Palette series, and Text Muted axes.
- Buttons use Primary Accent for primary actions and Surface for secondary actions.

## Layout Principles
- Use a 16:9 slide canvas for presentation pages.
- ${densityText}
- Keep all design tokens scoped to the deck content. Product chrome and editor controls must not inherit deck styling.

`
}

function buildDeckThemeStyle(controls: DesignControls): CSSProperties {
  const densityVars = {
    executive: {
      padding: 'clamp(30px, 4.2vw, 56px)',
      gap: '18px',
      titleScale: 1,
      bodyScale: 1,
      cardPadding: '16px',
      chartMin: '228px',
    },
    analytical: {
      padding: 'clamp(18px, 2.4vw, 34px)',
      gap: '10px',
      titleScale: 0.82,
      bodyScale: 0.9,
      cardPadding: '10px',
      chartMin: '252px',
    },
    board: {
      padding: 'clamp(24px, 3.2vw, 46px)',
      gap: '14px',
      titleScale: 0.92,
      bodyScale: 0.96,
      cardPadding: '14px',
      chartMin: '220px',
    },
  }[controls.density]

  return {
    '--studio-bg': controls.background,
    '--studio-surface': controls.surface,
    '--studio-text': controls.text,
    '--studio-heading': controls.text,
    '--studio-muted': controls.muted,
    '--studio-accent': controls.accent,
    '--studio-radius': `${controls.radius}px`,
    '--deck-slide-padding': densityVars.padding,
    '--deck-gap': densityVars.gap,
    '--deck-title-scale': String(densityVars.titleScale),
    '--deck-body-scale': String(densityVars.bodyScale),
    '--deck-card-padding': densityVars.cardPadding,
    '--deck-chart-min': densityVars.chartMin,
  } as CSSProperties
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

function presetToDesignStyle(
  preset: { id: string; title: string; description: string; controls: DesignControls },
  source: DesignStyle['source'] = 'preset',
): DesignStyle {
  return {
    id: preset.id,
    title: preset.title,
    description: preset.description,
    source,
    updatedAt: 'preset',
    controls: normalizeDesignControls(preset.controls),
  }
}

function normalizeDesignStyle(input: Partial<DesignStyle>, index: number): DesignStyle {
  const controls = normalizeDesignControls(input.controls ?? (input as Partial<DesignControls> & { brandName?: string }))
  return {
    id: input.id || `style-${index + 1}`,
    title: input.title || controls.styleName || `设计风格 ${index + 1}`,
    description: input.description || '从项目数据恢复的设计风格。',
    source: input.source ?? 'custom',
    updatedAt: input.updatedAt || new Date().toISOString(),
    controls,
  }
}

function normalizeDesignStyles(input?: DesignStyle[] | null, fallbackControls?: Partial<DesignControls> | null): DesignStyle[] {
  if (input?.length) {
    return input.map((style, index) => normalizeDesignStyle(style, index))
  }

  const presets = designPresets.map((preset) => presetToDesignStyle(preset))
  if (!fallbackControls) return presets

  const fallback = normalizeDesignControls(fallbackControls)
  const exists = presets.some((style) => style.controls.styleName === fallback.styleName && style.controls.accent === fallback.accent)
  if (exists) return presets

  return [
    {
      id: 'restored',
      title: fallback.styleName,
      description: '从历史项目恢复的当前设计风格。',
      source: 'custom',
      updatedAt: new Date().toISOString(),
      controls: fallback,
    },
    ...presets,
  ]
}

function targetRefFor(slideId: string, target: SelectedTarget) {
  return `${slideId}:${targetToStyleKey(target)}`
}

function buildTargetRefs(slide: Slide): BlockTarget[] {
  const targets: SelectedTarget[] = ['整页', '标题', '正文', '图表', '图片']
  return targets.map((target) => ({
    id: targetRefFor(slide.id, target),
    slideId: slide.id,
    target,
    label: `${slide.title.replace(/\s+/g, ' ').slice(0, 18)} · ${target}`,
    stableRef: targetRefFor(slide.id, target),
  }))
}

function normalizeComments(input?: ReviewComment[] | null): ReviewComment[] {
  if (!input?.length) return initialComments
  return input.map((comment) => ({
    ...comment,
    targetRef: comment.targetRef || targetRefFor(comment.slideId, comment.target),
  }))
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
  const initialDesignState = useMemo(() => {
    const styles = normalizeDesignStyles(stored.designStyles, stored.designControls)
    const activeId =
      stored.activeDesignStyleId && styles.some((style) => style.id === stored.activeDesignStyleId)
        ? stored.activeDesignStyleId
        : styles[0].id
    return { styles, activeId }
  }, [stored.activeDesignStyleId, stored.designControls, stored.designStyles])
  const [view, setView] = useState<AppView>(stored.view ?? 'home')
  const [projectTitle, setProjectTitle] = useState(stored.projectTitle ?? '2026 Q1 经营分析汇报')
  const [designStyles, setDesignStyles] = useState<DesignStyle[]>(initialDesignState.styles)
  const [activeDesignStyleId, setActiveDesignStyleId] = useState(initialDesignState.activeId)
  const [slides, setSlides] = useState(stored.slides ?? initialSlides)
  const [comments, setComments] = useState(() => normalizeComments(stored.comments))
  const [revisions, setRevisions] = useState(stored.revisions ?? initialRevisions)
  const [agentMessages, setAgentMessages] = useState(() =>
    (stored.agentMessages ?? initialAgentMessages).map((message) => ({
      ...message,
      text: message.text.replace(/待办/g, '修改意见').replace('转换成了修订提案', '生成了修订提案'),
    })),
  )
  const [activeSlideId, setActiveSlideId] = useState(slides[0].id)
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>('整页')
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('select')
  const [collabDraft, setCollabDraft] = useState('')
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [targetDraft, setTargetDraft] = useState('')
  const [targetPopupOpen, setTargetPopupOpen] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null)
  const [homePrompt, setHomePrompt] = useState('')
  const messageListRef = useRef<HTMLDivElement | null>(null)

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0]
  const activeSlideIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlide.id))
  const activeDesignStyle = designStyles.find((style) => style.id === activeDesignStyleId) ?? designStyles[0] ?? presetToDesignStyle(designPresets[0])
  const designControls = activeDesignStyle.controls
  const targetRefs = useMemo(() => slides.flatMap((slide) => buildTargetRefs(slide)), [slides])
  const activeScreenLabel = `${String(activeSlideIndex + 1).padStart(2, '0')} ${activeSlide.title.replace(/\s+/g, ' ').slice(0, 42)}`
  const deckThemeStyle = useMemo(() => buildDeckThemeStyle(designControls), [designControls])
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
  const deckProgress = Math.round((slides.filter((slide) => slide.status === 'approved').length / slides.length) * 100)

  function updateSlide(id: string, patch: Partial<Slide>) {
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)))
  }

  function updateActiveDesignStyle(patch: Partial<DesignStyle>) {
    setDesignStyles((current) =>
      current.map((style) =>
        style.id === activeDesignStyleId
          ? {
              ...style,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : style,
      ),
    )
  }

  function updateActiveDesignControls(patch: Partial<DesignControls>) {
    setDesignStyles((current) =>
      current.map((style) =>
        style.id === activeDesignStyleId
          ? {
              ...style,
              title: patch.styleName ?? style.title,
              updatedAt: new Date().toISOString(),
              controls: { ...style.controls, ...patch },
            }
          : style,
      ),
    )
  }

  function updateControl<K extends keyof DesignControls>(key: K, value: DesignControls[K]) {
    updateActiveDesignControls({ [key]: value } as Partial<DesignControls>)
  }

  function createDesignStyleFromCurrent() {
    const id = createId('style-')
    const next: DesignStyle = {
      id,
      title: '新的设计风格',
      description: '基于当前 PPT 风格创建，可继续通过手动控件或 AI 调整。',
      source: 'custom',
      updatedAt: new Date().toISOString(),
      controls: {
        ...designControls,
        styleName: '新的设计风格',
      },
    }
    setDesignStyles((current) => [next, ...current])
    setActiveDesignStyleId(id)
    addRevision('已创建一套新的设计风格，并绑定到当前 PPT。', '设计风格', 'accepted')
  }

  function duplicateDesignStyle() {
    const id = createId('style-')
    const next: DesignStyle = {
      ...activeDesignStyle,
      id,
      title: `${activeDesignStyle.title} 副本`,
      description: activeDesignStyle.description || '复制当前设计风格后继续调整。',
      source: 'custom',
      updatedAt: new Date().toISOString(),
      controls: {
        ...designControls,
        styleName: `${designControls.styleName} 副本`,
      },
    }
    setDesignStyles((current) => [next, ...current])
    setActiveDesignStyleId(id)
    addRevision(`已复制「${activeDesignStyle.title}」并绑定到当前 PPT。`, '设计风格', 'accepted')
  }

  function deleteActiveDesignStyle() {
    if (designStyles.length <= 1) return
    const remaining = designStyles.filter((style) => style.id !== activeDesignStyleId)
    setDesignStyles(remaining)
    setActiveDesignStyleId(remaining[0].id)
    addRevision(`已删除「${activeDesignStyle.title}」，当前 PPT 改用「${remaining[0].title}」。`, '设计风格', 'accepted')
  }

  function activateDesignStyle(id: string) {
    const style = designStyles.find((item) => item.id === id)
    if (!style) return
    setActiveDesignStyleId(id)
    addRevision(`当前 PPT 已套用「${style.title}」设计风格。`, '设计风格', 'accepted')
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
    setTargetPopupOpen(false)
    if (nextMode !== 'draw') {
      setAnnotationDraft('')
    }
  }

  function handleTargetSelect(target: SelectedTarget) {
    setSelectedTarget(target)
    if (canvasMode !== 'edit' && target !== '整页') {
      setTargetPopupOpen(true)
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
    if (drawRect && (drawRect.width > 1 || drawRect.height > 1)) {
      setTargetPopupOpen(true)
    }
  }

  function addRevision(summary: string, target = `${activeSlide.id} / ${selectedTarget}`, status: Revision['status'] = 'pending') {
    setRevisions((current) => [
      {
        id: createId('r'),
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
    setRevisions([
      {
        id: createId('r'),
        target: '整份演示',
        summary: `已从「${templates.find((item) => item.id === templateId)?.title ?? '模板'}」创建新项目。`,
        status: 'accepted',
      },
    ])
    setAgentMessages([
      {
        id: createId('m'),
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
      id: createId('slide-'),
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

  function duplicateSlide(id: string) {
    const source = slides.find((slide) => slide.id === id) ?? activeSlide
    const index = slides.findIndex((slide) => slide.id === source.id)
    const copy: Slide = {
      ...source,
      id: `${source.id}-copy-${createId('slide')}`,
      title: `${source.title.replace('\n', ' ')} 副本`,
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

  function deleteSlide(id: string) {
    if (slides.length <= 1) return
    const index = slides.findIndex((slide) => slide.id === id)
    const nextSlides = slides.filter((slide) => slide.id !== id)
    setSlides(nextSlides)
    if (activeSlide.id === id) {
      setActiveSlideId(nextSlides[Math.max(0, index - 1)].id)
    }
    setSelectedTarget('整页')
  }

  function moveSlide(id: string, direction: -1 | 1) {
    const index = slides.findIndex((slide) => slide.id === id)
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
    const nextStyle = presetToDesignStyle(preset)
    setDesignStyles((current) => {
      const exists = current.some((style) => style.id === id)
      return exists ? current.map((style) => (style.id === id ? { ...style, ...nextStyle } : style)) : [nextStyle, ...current]
    })
    setActiveDesignStyleId(id)
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
      if (action.type === 'applyDesignStyle' && action.styleId) {
        const style = designStyles.find((item) => item.id === action.styleId)
        if (style) setActiveDesignStyleId(style.id)
      }
      if (action.patch) {
        updateActiveDesignControls(action.patch)
      }
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
      setAgentMessages((current) => [...current, { id: createId('m'), role: 'agent', text: action.text }])
    }
  }

  function handleInlineText(key: 'title' | 'body', event: FormEvent<HTMLElement>) {
    updateSlide(activeSlide.id, { [key]: event.currentTarget.textContent ?? '' })
  }

  function submitRevisionRequest(request: string, target: SelectedTarget, mode: ReviewComment['mode'] = 'chat', bbox?: DrawRect) {
    const prompt = request.trim()
    if (!prompt) return
    const comment: ReviewComment = {
      id: createId('c'),
      slideId: activeSlide.id,
      targetRef: targetRefFor(activeSlide.id, target),
      target,
      request: prompt,
      status: 'resolved',
      mode,
      bbox,
    }
    const proposal = buildRevisionFromComment(comment)
    setComments((current) => [comment, ...current])
    setRevisions((current) => [proposal, ...current])
    setAgentMessages((current) => [
      ...current,
      { id: createId('m'), role: 'user', text: `修改【${comment.target}】：${comment.request}` },
      {
        id: createId('m'),
        role: 'agent',
        text: `我已根据「${comment.target}」生成一条可确认的修订提案。接受前不会覆盖画布。`,
      },
    ])
    window.dispatchEvent(new CustomEvent('vizual-studio:comment-added', { detail: comment }))
  }

  function submitTargetPopup() {
    const target = canvasMode === 'draw' ? '手绘区域' : selectedTarget
    const text = (canvasMode === 'draw' ? annotationDraft : targetDraft).trim()
    submitRevisionRequest(text, target, canvasMode === 'draw' ? 'draw' : 'click', canvasMode === 'draw' && drawRect ? drawRect : undefined)
    setAnnotationDraft('')
    setTargetDraft('')
    setTargetPopupOpen(false)
    setDrawRect(null)
  }

  function submitAgentRequest() {
    const prompt = collabDraft.trim()
    if (!prompt) return
    submitRevisionRequest(prompt, selectedTarget)
    setCollabDraft('')
  }

  function buildRevisionFromComment(comment: ReviewComment): Revision {
    const targetSlide = slides.find((slide) => slide.id === comment.slideId)
    const patch: RevisionPatch = { slideId: comment.slideId, slide: { status: 'review' } }
    let summary = `根据「${comment.target}」批注生成修改提案：${comment.request}`

    if (comment.target === '图表') {
      patch.slide = { ...patch.slide, visual: 'combo', visualHeight: 320 }
      summary = `建议把 ${comment.slideId} 的图表改为组合图，并提高图表高度以突出趋势。`
    }
    if (comment.target === '标题' && /不换行|不要换行|单行|一行/.test(comment.request)) {
      patch.slide = { ...patch.slide, titleWrap: 'nowrap', titleWidth: 92, titleSize: 32 }
      summary = `建议将 ${comment.slideId} 的标题设为单行约束，并自动缩小字号避免换行。`
    }
    if (comment.target === '正文' && targetSlide) {
      patch.slide = {
        ...patch.slide,
        body: `${targetSlide.body} 这里需要明确区分相关性和因果性，后续建议通过对照实验验证。`,
      }
      summary = `建议补充正文，明确区分相关性、因果性和后续验证动作。`
    }
    if (comment.target === '图片') {
      patch.slide = { ...patch.slide, imageTone: 'mono', imageZoom: 112 }
      summary = `建议将 ${comment.slideId} 的图片调整为黑白高级风格，并轻微放大裁切。`
    }
    if (comment.target === '整页') {
      patch.slide = { ...patch.slide, bodyWidth: 82 }
      summary = `建议放宽 ${comment.slideId} 的正文宽度，并把该页标记为待审。`
    }
    if (comment.target === '手绘区域') {
      summary = comment.bbox
        ? `建议按手绘区域处理：x ${comment.bbox.x.toFixed(1)}%、y ${comment.bbox.y.toFixed(1)}%、w ${comment.bbox.width.toFixed(1)}%、h ${comment.bbox.height.toFixed(1)}%。说明：${comment.request}`
        : `建议按手绘标注处理：${comment.request}`
    }

    return {
      id: `${createId('r')}-${comment.id}`,
      target: comment.targetRef,
      summary,
      status: 'pending',
      sourceCommentId: comment.id,
      patch,
      createdAt: new Date().toISOString(),
    }
  }

  function setRevisionStatus(id: string, status: Revision['status']) {
    const revision = revisions.find((item) => item.id === id)
    if (status === 'accepted' && revision?.patch) {
      if (revision.patch.slideId && revision.patch.slide) {
        updateSlide(revision.patch.slideId, revision.patch.slide)
      }
      if (revision.patch.design) {
        updateActiveDesignControls(revision.patch.design)
      }
    }
    setRevisions((current) => current.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  function resetDemo() {
    window.localStorage.removeItem(STORAGE_KEY)
    setView('home')
    setProjectTitle('2026 Q1 经营分析汇报')
    const styles = normalizeDesignStyles(null, initialDesign)
    setDesignStyles(styles)
    setActiveDesignStyleId(styles[0].id)
    setSlides(initialSlides)
    setComments(initialComments)
    setRevisions(initialRevisions)
    setAgentMessages(initialAgentMessages)
    setActiveSlideId(initialSlides[0].id)
    setSelectedTarget('整页')
  }

  useEffect(() => {
    const project: StoredProject = {
      view,
      projectTitle,
      designControls,
      designStyles,
      activeDesignStyleId,
      slides,
      comments,
      revisions,
      agentMessages,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  }, [view, projectTitle, designControls, designStyles, activeDesignStyleId, slides, comments, revisions, agentMessages])

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

  useEffect(() => {
    const node = messageListRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [agentMessages, revisions])

  // The bridge intentionally mirrors the latest React state for browser-controlled agents.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
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
        targetRefs,
        designControls,
        designStyles,
        activeDesignStyleId,
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
                {slides.length} 页 · {activeDesignStyle.title} · {deckProgress}% 已确认
              </small>
            </div>
            <div className="context-actions editor-context-actions">
              <button type="button" onClick={() => setView('design')}>
                设计风格
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
              <strong>{activeDesignStyle.title}</strong>
              <small>当前 PPT 已绑定这套设计风格</small>
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
                用户选中页面、标题、正文、图表或图片后，直接把修改意见提交给 AI。AI 会在右侧对话里给出可确认提案，用户可以接受、拒绝或继续追问。
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
              <h1>为 PPT 建立可复用的设计风格库</h1>
              <p>每个 PPT 绑定一套当前风格，也可以在项目内保存多套风格，用于不同受众、场景和汇报语气。</p>
            </div>

            <div className="style-library-actions">
              <button type="button" onClick={createDesignStyleFromCurrent}>
                新建风格
              </button>
              <button type="button" onClick={duplicateDesignStyle}>
                复制当前
              </button>
              <button type="button" onClick={deleteActiveDesignStyle} disabled={designStyles.length <= 1}>
                删除
              </button>
            </div>

            <div className="style-preset-list">
              {designStyles.map((style) => (
                <button
                  className={style.id === activeDesignStyleId ? 'active' : ''}
                  key={style.id}
                  type="button"
                  onClick={() => activateDesignStyle(style.id)}
                >
                  <i style={{ background: style.controls.accent }} />
                  <span>
                    <strong>{style.title}</strong>
                    <small>{style.description}</small>
                    <em>{style.source === 'preset' ? '内置' : style.source === 'agent' ? 'AI 生成' : '自定义'}</em>
                  </span>
                </button>
              ))}
            </div>

            <div className="preset-shortcuts">
              <span>内置模板</span>
              {designPresets.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyDesignPreset(preset.id)}>
                  {preset.title}
                </button>
              ))}
            </div>

            <label>
              风格标题
              <input
                value={activeDesignStyle.title}
                onChange={(event) => {
                  updateActiveDesignStyle({ title: event.target.value })
                  updateActiveDesignControls({ styleName: event.target.value })
                }}
              />
            </label>
            <label>
              使用说明
              <textarea
                value={activeDesignStyle.description}
                onChange={(event) => updateActiveDesignStyle({ description: event.target.value })}
                rows={3}
              />
            </label>
            <label>
              风格名称
              <input value={designControls.styleName} onChange={(event) => updateControl('styleName', event.target.value)} />
            </label>
            <div className="color-grid">
              <label>
                主色
                <input
                  type="color"
                  value={designControls.accent}
                  onInput={(event) => updateControl('accent', event.currentTarget.value)}
                  onChange={(event) => updateControl('accent', event.target.value)}
                />
              </label>
              <label>
                背景
                <input
                  type="color"
                  value={designControls.background}
                  onInput={(event) => updateControl('background', event.currentTarget.value)}
                  onChange={(event) => updateControl('background', event.target.value)}
                />
              </label>
              <label>
                版面
                <input
                  type="color"
                  value={designControls.surface}
                  onInput={(event) => updateControl('surface', event.currentTarget.value)}
                  onChange={(event) => updateControl('surface', event.target.value)}
                />
              </label>
              <label>
                文字
                <input
                  type="color"
                  value={designControls.text}
                  onInput={(event) => updateControl('text', event.currentTarget.value)}
                  onChange={(event) => updateControl('text', event.target.value)}
                />
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
              版面密度
              <select value={designControls.density} onChange={(event) => updateControl('density', event.target.value as DesignControls['density'])}>
                <option value="executive">{densityLabels.executive}</option>
                <option value="analytical">{densityLabels.analytical}</option>
                <option value="board">{densityLabels.board}</option>
              </select>
              <small>{densityDescriptions[designControls.density]}</small>
            </label>
          </section>

          <section className="design-preview">
            <div className="section-head">
              <div>
                <span>实时预览</span>
                <h2>同一套风格覆盖页面、图表、表格和按钮</h2>
              </div>
              <div className="preview-status-pill">当前风格实时应用</div>
            </div>
            <div className="design-preview-board" style={deckThemeStyle}>
              <section className="design-element-lab">
                <div className="element-lab-head">
                  <div>
                    <p className="eyebrow">{designControls.styleName}</p>
                    <h2>品牌调性与基础元素总览</h2>
                    <p>先验基础元素，再看真实 PPT 页面。这里会同时检查标题、正文、按钮、输入框、指标卡、表格、图表和提示块。</p>
                  </div>
                  <div className="tone-tags">
                    <span>{densityLabels[designControls.density]}</span>
                    <span>{densityDescriptions[designControls.density]}</span>
                    <span>圆角 {designControls.radius}px</span>
                  </div>
                </div>

                <div className="element-lab-grid">
                  <article className="lab-block lab-type">
                    <span>标题 / 正文</span>
                    <h3>增长质量开始分化</h3>
                    <p>用于检查字体层级、正文可读性、字距、行距和品牌主色在长文本中的稳定性。</p>
                  </article>
                  <article className="lab-block lab-controls">
                    <span>操作控件</span>
                    <button type="button">主要按钮</button>
                    <button type="button">次要按钮</button>
                    <input readOnly value="筛选：华东区 / 近 7 天" />
                  </article>
                  <article className="lab-block lab-kpis">
                    <span>指标卡</span>
                    <div>
                      <strong>1.16M</strong>
                      <small>收入 -4.8%</small>
                    </div>
                    <div>
                      <strong>46k</strong>
                      <small>活跃用户 -16.4%</small>
                    </div>
                  </article>
                  <article className="lab-block lab-chart">
                    <span>图表</span>
                    <VizualRenderer spec={buildVizualSpec({ ...activeSlide, visual: 'combo', visualHeight: 170 })} />
                  </article>
                  <article className="lab-block lab-table">
                    <span>表格</span>
                    <table>
                      <tbody>
                        <tr>
                          <th>事项</th>
                          <th>优先级</th>
                          <th>负责人</th>
                        </tr>
                        <tr>
                          <td>A/B 实验</td>
                          <td>高</td>
                          <td>增长组</td>
                        </tr>
                        <tr>
                          <td>流失画像</td>
                          <td>中</td>
                          <td>数据组</td>
                        </tr>
                      </tbody>
                    </table>
                  </article>
                  <article className="lab-block lab-callout">
                    <span>提示块</span>
                    <strong>核心判断</strong>
                    <p>ARPPU 上升可能来自用户筛选效应，不能直接说明产品体验改善。</p>
                  </article>
                </div>
              </section>

              <div className="scenario-slide-stack">
                <article className="ppt-scenario-slide">
                  <div className="scenario-slide-canvas">
                    <div className="scenario-label">
                      <span>01</span>
                      <strong>封面页</strong>
                    </div>
                    <div className="scenario-cover-art">
                      <span>STRATEGY</span>
                      <i />
                    </div>
                    <h3>2026 年经营策略汇报</h3>
                    <p>用于检查大标题、导语、视觉留白和品牌主色是否足够有商业表达力。</p>
                  </div>
                </article>

                <article className="ppt-scenario-slide">
                  <div className="scenario-slide-canvas">
                    <div className="scenario-label">
                      <span>02</span>
                      <strong>数据分析页</strong>
                    </div>
                    <div className="scenario-kpi-mini">
                      {[
                        ['收入', '1.16M'],
                        ['活跃', '46k'],
                        ['ARPPU', '4.1'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="preview-viz compact">
                      <VizualRenderer spec={buildVizualSpec({ ...activeSlide, visual: 'combo', visualHeight: 220 })} />
                    </div>
                  </div>
                </article>

                <article className="ppt-scenario-slide">
                  <div className="scenario-slide-canvas">
                    <div className="scenario-label">
                      <span>03</span>
                      <strong>图文叙事页</strong>
                    </div>
                    <div className="story-layout-preview">
                      <div className="preview-image-card">
                        <span>业务场景图</span>
                      </div>
                      <div>
                        <h3>增长质量开始分化</h3>
                        <p>新用户增长没有同步转化为稳定活跃，需拆解渠道质量和新老用户留存。</p>
                        <ul>
                          <li>低价值用户流失更快</li>
                          <li>高价值用户贡献被动上升</li>
                          <li>需要按区域和客群拆分</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="ppt-scenario-slide">
                  <div className="scenario-slide-canvas">
                    <div className="scenario-label">
                      <span>04</span>
                      <strong>表格与行动页</strong>
                    </div>
                    <div className="action-slide-grid">
                      <table>
                        <tbody>
                          <tr>
                            <th>事项</th>
                            <th>优先级</th>
                            <th>负责人</th>
                          </tr>
                          <tr>
                            <td>A/B 实验</td>
                            <td>高</td>
                            <td>增长组</td>
                          </tr>
                          <tr>
                            <td>流失画像</td>
                            <td>中</td>
                            <td>数据组</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="preview-actions">
                        <strong>下一步行动</strong>
                        <p>先验证 30% 与 40% AI 内容占比，再决定是否扩大策略。</p>
                        <button type="button">生成行动页</button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
            <div className="token-strip" style={deckThemeStyle}>
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
                <article className={slide.id === activeSlide.id ? 'thumb active' : 'thumb'} key={slide.id}>
                  <button
                    className="thumb-main"
                    onClick={() => {
                      setActiveSlideId(slide.id)
                      setSelectedTarget('整页')
                      setTargetPopupOpen(false)
                    }}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{slide.title.replace('\n', ' ')}</strong>
                    <small>{statusLabels[slide.status]}</small>
                  </button>
                  <div className="thumb-actions" aria-label={`${slide.title.replace('\n', ' ')} 页面操作`}>
                    <button type="button" onClick={() => moveSlide(slide.id, -1)} disabled={index === 0} title="上移">
                      ↑
                    </button>
                    <button type="button" onClick={() => moveSlide(slide.id, 1)} disabled={index === slides.length - 1} title="下移">
                      ↓
                    </button>
                    <button type="button" onClick={() => duplicateSlide(slide.id)}>
                      复制
                    </button>
                    <button type="button" onClick={() => deleteSlide(slide.id)} disabled={slides.length <= 1}>
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </aside>

            <section className="canvas-workspace">
              <div className="canvas-toolbar">
                <div className="selection-context">
                  <span>当前选中</span>
                  <strong>{selectedTarget}</strong>
                  <small>
                    {canvasMode === 'edit'
                      ? '编辑模式：文字可直接在画布上改'
                      : canvasMode === 'draw'
                        ? '圈画模式：拖拽圈选区域并写修改说明'
                        : canvasMode === 'click'
                          ? '点选模式：点选元素并写修改说明'
                          : '点击画布中的标题、正文、图表或图片即可切换'}
                  </small>
                </div>
                <div className="canvas-meta">
                  <span>{activeSlide.kicker}</span>
                  <span>{statusLabels[activeSlide.status]}</span>
                  <span>{deckProgress}% 已确认</span>
                </div>
              </div>

              <div className="canvas-mode-dock" aria-label="画布模式">
                {[
                  ['select', '选择'],
                  ['edit', '编辑'],
                  ['draw', '圈画'],
                  ['click', '点选'],
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

              <div
                className={`slide-canvas slide-${activeSlide.layout} canvas-mode-${canvasMode}`}
                data-screen-label={activeScreenLabel}
                data-slide-id={activeSlide.id}
                data-target-ref={targetRefFor(activeSlide.id, '整页')}
                style={deckThemeStyle}
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
                    data-target-ref={targetRefFor(activeSlide.id, '标题')}
                    data-target-kind="title"
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
                    data-target-ref={targetRefFor(activeSlide.id, '正文')}
                    data-target-kind="body"
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
                      data-target-ref={targetRefFor(activeSlide.id, '图片')}
                      data-target-kind="image"
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
                      data-target-ref={targetRefFor(activeSlide.id, '图表')}
                      data-target-kind="visual"
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
                {targetPopupOpen && canvasMode !== 'edit' && selectedTarget !== '整页' && (
                  <div className="target-comment-popup" onClick={(event) => event.stopPropagation()}>
                    <div>
                      <strong>{canvasMode === 'draw' ? '圈画区域' : selectedTarget}</strong>
                      <button type="button" onClick={() => setTargetPopupOpen(false)}>
                        关闭
                      </button>
                    </div>
                    <textarea
                      value={canvasMode === 'draw' ? annotationDraft : targetDraft}
                      onChange={(event) => {
                        if (canvasMode === 'draw') {
                          setAnnotationDraft(event.target.value)
                        } else {
                          setTargetDraft(event.target.value)
                        }
                      }}
                      placeholder="写下你希望 AI 怎么改这里，例如：这里太挤了，改成更清晰的两列布局"
                      rows={2}
                    />
                    <button className="primary-action" type="button" onClick={submitTargetPopup}>
                      提交给 AI 修改
                    </button>
                  </div>
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

            </section>
          </main>

          <aside className="agent-panel">
            <div className="agent-header">
              <div>
                <strong>AI 协作</strong>
                <span>选中对象：{selectedTarget}</span>
              </div>
            </div>

            <section className="agent-section chat-section">
              <div className="message-list" ref={messageListRef}>
                {agentMessages.map((message) => (
                  <article className={`message ${message.role}`} key={message.id}>
                    {message.text}
                  </article>
                ))}
                {revisions
                  .filter((revision) => revision.status === 'pending')
                  .map((revision) => (
                    <article className="message proposal" key={revision.id}>
                      <strong>AI 修订提案</strong>
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

            <section className="agent-section tweak-section">
              <div className="tweak-target">
                <strong>手动微调 · {selectedTarget}</strong>
                <span>{canvasMode === 'edit' ? '编辑模式下可直接在画布打字，右侧负责精确样式。' : '手动微调只作用于当前选中对象。'}</span>
              </div>

                {(selectedTarget === '标题' || selectedTarget === '正文') && (
                  <div className="inspector-group">
                    <h3>文字排版</h3>
                    <label>
                      字体
                      <select value={selectedStyle.font} onChange={(event) => updateElementStyle(selectedTarget, { font: event.target.value })}>
                        <option value="Inter / Microsoft YaHei">Inter / 微软雅黑</option>
                        <option value="Noto Sans SC">Noto Sans SC</option>
                        <option value="Source Han Serif SC">思源宋体</option>
                        <option value="DIN Alternate">DIN Alternate</option>
                      </select>
                    </label>
                    <div className="field-grid">
                      <label>
                        字号
                        <input type="number" value={selectedStyle.size} onChange={(event) => updateElementStyle(selectedTarget, { size: Number(event.target.value) })} />
                      </label>
                      <label>
                        字重
                        <input type="number" step="50" value={selectedStyle.weight} onChange={(event) => updateElementStyle(selectedTarget, { weight: Number(event.target.value) })} />
                      </label>
                    </div>
                    <div className="field-grid">
                      <label>
                        颜色
                        <input
                          type="color"
                          value={selectedStyle.color}
                          onInput={(event) => updateElementStyle(selectedTarget, { color: event.currentTarget.value })}
                          onChange={(event) => updateElementStyle(selectedTarget, { color: event.target.value })}
                        />
                      </label>
                      <label>
                        对齐
                        <select value={selectedStyle.align} onChange={(event) => updateElementStyle(selectedTarget, { align: event.target.value as ElementStyle['align'] })}>
                          <option value="left">左对齐</option>
                          <option value="center">居中</option>
                          <option value="right">右对齐</option>
                        </select>
                      </label>
                    </div>
                    <div className="field-grid">
                      <label>
                        行距
                        <input type="number" min="0.8" max="2.4" step="0.02" value={selectedStyle.line} onChange={(event) => updateElementStyle(selectedTarget, { line: Number(event.target.value) })} />
                      </label>
                      <label>
                        字间距
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
                    <h3>图表</h3>
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
                    <h3>图片</h3>
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
                        缩放
                        <input type="number" value={activeSlide.imageZoom} onChange={(event) => updateSlide(activeSlide.id, { imageZoom: Number(event.target.value) })} />
                      </label>
                      <label>
                        水平位置
                        <input type="number" value={activeSlide.imageX} onChange={(event) => updateSlide(activeSlide.id, { imageX: Number(event.target.value) })} />
                      </label>
                    </div>
                  </div>
                )}

                {selectedTarget === '整页' && (
                  <div className="inspector-group">
                    <h3>设计风格</h3>
                    <label>
                      设计主色
                      <input
                        type="color"
                        value={designControls.accent}
                        onInput={(event) => updateControl('accent', event.currentTarget.value)}
                        onChange={(event) => updateControl('accent', event.target.value)}
                      />
                    </label>
                    <label>
                      背景色
                      <input
                        type="color"
                        value={designControls.background}
                        onInput={(event) => updateControl('background', event.currentTarget.value)}
                        onChange={(event) => updateControl('background', event.target.value)}
                      />
                    </label>
                    <label>
                      版面密度
                      <select value={designControls.density} onChange={(event) => updateControl('density', event.target.value as DesignControls['density'])}>
                        <option value="executive">{densityLabels.executive}</option>
                        <option value="analytical">{densityLabels.analytical}</option>
                        <option value="board">{densityLabels.board}</option>
                      </select>
                      <small>{densityDescriptions[designControls.density]}</small>
                    </label>
                  </div>
                )}

                <div className="inspector-group">
                  <h3>尺寸</h3>
                  <div className="field-grid">
                    <label>
                      宽度
                      <input type="number" value={selectedStyle.width} onChange={(event) => updateElementStyle(selectedTarget, { width: Number(event.target.value) })} />
                    </label>
                    <label>
                      高度
                      <input type="number" value={selectedStyle.height} onChange={(event) => updateElementStyle(selectedTarget, { height: Number(event.target.value) })} />
                    </label>
                  </div>
                </div>

                <div className="inspector-group">
                  <h3>容器</h3>
                  <div className="field-grid">
                    <label>
                      透明度
                      <input type="number" min="0" max="1" step="0.05" value={selectedStyle.opacity} onChange={(event) => updateElementStyle(selectedTarget, { opacity: Number(event.target.value) })} />
                    </label>
                    <label>
                      内边距
                      <input type="number" value={selectedStyle.padding} onChange={(event) => updateElementStyle(selectedTarget, { padding: Number(event.target.value) })} />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      外边距
                      <input type="number" value={selectedStyle.margin} onChange={(event) => updateElementStyle(selectedTarget, { margin: Number(event.target.value) })} />
                    </label>
                    <label>
                      边框
                      <input type="number" value={selectedStyle.border} onChange={(event) => updateElementStyle(selectedTarget, { border: Number(event.target.value) })} />
                    </label>
                  </div>
                  <label>
                    圆角
                    <input type="number" value={selectedStyle.radius} onChange={(event) => updateElementStyle(selectedTarget, { radius: Number(event.target.value) })} />
                  </label>
                </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}

export default App
