/**
 * useAgent — orchestrates agent execution via SSE streaming.
 * Bridges the SSE service with Zustand stores.
 */

import { useCallback, useRef } from 'react'
import { connectAgentSSE } from '@/services'
import { useAgentStore, useChatStore, useAmbientStore, useSettingsStore } from '@/stores'
import type { AgentStrategy, StreamEvent, PlanStep } from '@/types'

export function useAgent() {
  const connectionRef = useRef<{ close: () => void } | null>(null)
  const lastEventTimeRef = useRef<number>(0)
  const watchdogRef = useRef<number | null>(null)

  const startExecution = useAgentStore((s) => s.startExecution)
  const addStep = useAgentStore((s) => s.addStep)
  const setPlan = useAgentStore((s) => s.setPlan)
  const updatePlanStep = useAgentStore((s) => s.updatePlanStep)
  const setCurrentThought = useAgentStore((s) => s.setCurrentThought)
  const finishExecution = useAgentStore((s) => s.finishExecution)

  const addMessage = useChatStore((s) => s.addMessage)
  const appendToMessage = useChatStore((s) => s.appendToMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const setIsSending = useChatStore((s) => s.setIsSending)

  const activeModeId = useAmbientStore((s) => s.activeModeId)
  const activeLlmId = useSettingsStore((s) => s.activeLlmId)
  const llmConfigs = useSettingsStore((s) => s.llmConfigs)
  const llmConfig = llmConfigs.find(c => c.id === activeLlmId) || llmConfigs[0]
  const rootDirectory = useSettingsStore((s) => s.rootDirectory)

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      window.clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const execute = useCallback(
    (sessionId: string, message: string, strategyOverride?: AgentStrategy) => {
      // Create assistant placeholder message
      const assistantMsgId = `msg-${Date.now()}`
      addMessage({
        id: assistantMsgId,
        sessionId,
        role: 'assistant',
        content: '',
        tokenCount: 0,
        model: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      })

      setIsSending(true)
      startExecution(sessionId, strategyOverride || 'react')
      lastEventTimeRef.current = Date.now()

      // Start a frontend watchdog to alert user if nothing happens
      clearWatchdog()
      watchdogRef.current = window.setInterval(() => {
        const idleTime = Date.now() - lastEventTimeRef.current
        if (idleTime > 15000) { // 15 seconds
          setCurrentThought("Still waiting for model response... Check your API key or network connection.")
        }
      }, 5000)

      const activeMode = useAmbientStore.getState().modes.find(m => m.modeId === activeModeId)
      const useResources = useChatStore.getState().useResources
      
      const conn = connectAgentSSE(sessionId, activeModeId, message, llmConfig, {
        resources: useResources ? (activeMode?.resources || []) : [],
        system_prompt: activeMode?.systemPrompt || '',
        strategy: strategyOverride || (activeMode?.strategy !== 'auto' ? activeMode?.strategy : undefined),
        enabled_tools: activeMode?.enabledTools,
        root_directory: activeMode?.rootDirectory || rootDirectory,
      }, {
        onEvent: (event: StreamEvent) => {
          lastEventTimeRef.current = Date.now()
          const { data } = event

          switch (event.event) {
            case 'token':
              appendToMessage(assistantMsgId, (data.content as string) ?? '')
              break

            case 'thought':
              setCurrentThought((data.content as string) ?? '')
              break

            case 'action':
            case 'tool_call':
              addStep({
                stepType: 'tool_call',
                content: (data.content as string) ?? '',
                toolName: data.tool_name as string,
                toolInput: data.tool_input as Record<string, unknown>,
                tokenCount: (data.token_count as number) ?? 0,
                latencyMs: (data.latency_ms as number) ?? 0,
              })
              break

            case 'tool_result':
            case 'observation':
              addStep({
                stepType: 'observation',
                content: (data.content as string) ?? '',
                toolName: data.tool_name as string,
                toolOutput: data.output as string,
                tokenCount: 0,
                latencyMs: (data.latency_ms as number) ?? 0,
              })
              break

            case 'plan':
              setPlan((data.steps as PlanStep[]) ?? [])
              break

            case 'step_start':
              updatePlanStep((data.step_index as number) ?? (data.index as number) ?? 0, 'running')
              break

            case 'step_result':
              updatePlanStep(
                (data.step_index as number) ?? (data.index as number) ?? 0,
                (data.status as PlanStep['status']) ?? 'completed',
              )
              break

            case 'rag_context':
              addStep({
                stepType: 'rag',
                content: `Retrieved ${(data.chunk_count as number) ?? 0} chunks`,
                tokenCount: 0,
                latencyMs: (data.latency_ms as number) ?? 0,
              })
              break

            case 'done':
              updateMessage(assistantMsgId, {
                isStreaming: false,
                tokenCount: (data.token_count as number) ?? (data.total_tokens as number) ?? 0,
                model: (data.model as string) ?? '',
              })
              clearWatchdog()
              break

            case 'error':
              appendToMessage(assistantMsgId, `\n\n**Error:** ${(data.content as string) ?? (data.message as string) ?? 'Unknown error'}`)
              updateMessage(assistantMsgId, { isStreaming: false })
              clearWatchdog()
              break
          }
        },

        onError: (error) => {
          appendToMessage(assistantMsgId, `\n\n**Connection error:** ${error.message}`)
          updateMessage(assistantMsgId, { isStreaming: false })
          finishExecution()
          setIsSending(false)
          clearWatchdog()
        },

        onClose: () => {
          finishExecution()
          setIsSending(false)
          connectionRef.current = null
          clearWatchdog()
        },
      })

      connectionRef.current = conn
    },
    [
      activeModeId, addMessage, addStep, appendToMessage, finishExecution,
      setCurrentThought, setIsSending, setPlan, startExecution,
      updateMessage, updatePlanStep, llmConfig, clearWatchdog,
    ],
  )

  const cancel = useCallback(() => {
    connectionRef.current?.close()
    connectionRef.current = null
    finishExecution()
    setIsSending(false)
  }, [finishExecution, setIsSending])

  return { execute, cancel }
}
