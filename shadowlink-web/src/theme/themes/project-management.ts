import type { AmbientTheme } from '@/types'

/** Project management theme — structured, professional, productivity-oriented */
export const projectManagementTheme: AmbientTheme = {
  id: 'project-management',
  name: 'Project Management',
  icon: 'KanbanSquare',
  description: 'Organized workspace for planning, tracking, and collaboration',
  colors: {
    primary: '#f97316',
    primaryLight: '#fb923c',
    primaryDark: '#ea580c',
    background: '#111318',
    surface: '#1a1c24',
    surfaceSecondary: '#242730',
    surfaceTertiary: '#2e3240',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    accent: '#facc15',
    gradient: ['#f97316', '#eab308'] as [string, string],
  },
  typography: {
    fontFamily: 'Inter',
    codeFont: 'JetBrains Mono',
  },
  ambient: {
    type: 'none',
    backgroundEffect: 'gradient_shift',
    transitionDuration: 400,
  },
  layout: {
    sidebarWidth: 300,
    panelRatio: [6, 4] as [number, number],
  },
}
