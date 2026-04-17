import type { AmbientTheme } from '@/types'

/** Paper reading theme — warm, relaxed, sepia-tinted for long reading sessions */
export const paperReadingTheme: AmbientTheme = {
  id: 'paper-reading',
  name: 'Paper & Reading',
  icon: 'BookOpen',
  description: 'Comfortable reading mode for papers, docs, and research',
  colors: {
    primary: '#d97706',
    primaryLight: '#f59e0b',
    primaryDark: '#b45309',
    background: '#1a1410',
    surface: '#231e17',
    surfaceSecondary: '#2d261d',
    surfaceTertiary: '#3a3126',
    text: '#e7e0d6',
    textMuted: '#a89f93',
    accent: '#fbbf24',
    gradient: ['#d97706', '#dc2626'] as [string, string],
  },
  typography: {
    fontFamily: 'Georgia',
    codeFont: 'Fira Code',
  },
  ambient: {
    type: 'fireflies',
    backgroundEffect: 'gradient_shift',
    transitionDuration: 800,
  },
  layout: {
    sidebarWidth: 240,
    panelRatio: [4, 6] as [number, number],
  },
}
