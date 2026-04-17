import type { AmbientTheme } from '@/types'

/** Creative writing theme — dreamy, aurora-lit, imagination-forward */
export const creativeWritingTheme: AmbientTheme = {
  id: 'creative-writing',
  name: 'Creative Writing',
  icon: 'Pen',
  description: 'Inspiring workspace for writing, brainstorming, and storytelling',
  colors: {
    primary: '#ec4899',
    primaryLight: '#f472b6',
    primaryDark: '#db2777',
    background: '#0f0b15',
    surface: '#1a1425',
    surfaceSecondary: '#251d32',
    surfaceTertiary: '#312840',
    text: '#ede9fe',
    textMuted: '#a78bfa',
    accent: '#c084fc',
    gradient: ['#ec4899', '#8b5cf6'] as [string, string],
  },
  typography: {
    fontFamily: 'Merriweather',
    codeFont: 'Fira Code',
  },
  ambient: {
    type: 'aurora',
    backgroundEffect: 'mesh_gradient',
    transitionDuration: 1000,
  },
  layout: {
    sidebarWidth: 260,
    panelRatio: [4, 6] as [number, number],
  },
}
