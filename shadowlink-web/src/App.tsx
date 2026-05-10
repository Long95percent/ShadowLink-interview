import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout'
import { AmbientProvider } from '@/components/ambient'
import { ChatPage, InterviewLearningPage, KnowledgePage, ReadingPage, SettingsPage } from '@/pages'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AmbientProvider>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<ChatPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="interview" element={<InterviewLearningPage />} />
              <Route path="reading" element={<ReadingPage />} />
              <Route path="knowledge" element={<KnowledgePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AmbientProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
