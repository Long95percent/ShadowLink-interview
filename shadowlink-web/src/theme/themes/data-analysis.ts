import type { AmbientTheme } from '@/types'

/** Data analysis theme — crisp, analytical, chart-friendly color palette */
export const dataAnalysisTheme: AmbientTheme = {
  id: 'data-analysis',
  name: 'Data Analysis',
  icon: 'BarChart3',
  description: 'Precision workspace for data exploration and visualization',
  colors: {
    primary: '#0ea5e9',
    primaryLight: '#38bdf8',
    primaryDark: '#0284c7',
    background: '#0c1222',
    surface: '#131c2e',
    surfaceSecondary: '#1c2740',
    surfaceTertiary: '#243352',
    text: '#e0f2fe',
    textMuted: '#7dd3fc',
    accent: '#2dd4bf',
    gradient: ['#0ea5e9', '#6366f1'] as [string, string],
  },
  typography: {
    fontFamily: 'Inter',
    codeFont: 'JetBrains Mono',
  },
  ambient: {
    type: 'particles',
    backgroundEffect: 'static',
    transitionDuration: 500,
  },
  layout: {
    sidebarWidth: 300,
    panelRatio: [5, 5] as [number, number],
  },
}
