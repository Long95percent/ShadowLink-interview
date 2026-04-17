package com.shadowlink.gateway.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shadowlink.session.service.SessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

/**
 * Transparent SSE proxy from frontend to Python AI service with persistence.
 */
@Slf4j
@Tag(name = "AI Proxy", description = "SSE proxy with message persistence")
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class ChatProxyController {

    @Qualifier("aiWebClient")
    private final WebClient webClient;
    private final SessionService sessionService;
    private final ObjectMapper objectMapper;

    private static final long SSE_TIMEOUT = 600_000L; // 10 minutes

    @Operation(summary = "Stream agent chat via SSE (proxy to Python)")
    @PostMapping(value = "/agent/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAgent(@RequestBody String rawBody) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        
        // Extract context for persistence
        String sessionId = null;
        String userMessage = null;
        try {
            JsonNode node = objectMapper.readTree(rawBody);
            sessionId = node.path("session_id").asText();
            userMessage = node.path("message").asText();
            
            if (sessionId != null && !sessionId.isEmpty() && userMessage != null && !userMessage.isEmpty()) {
                sessionService.saveMessage(sessionId, "user", userMessage);
            }
        } catch (Exception e) {
            log.warn("Failed to parse request for persistence: {}", e.getMessage());
        }

        final String finalSessionId = sessionId;
        final StringBuilder aiResponseBuilder = new StringBuilder();

        log.info("Forwarding SSE request to Python (Session: {})...", sessionId);

        webClient.post()
                .uri("/v1/agent/stream")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(rawBody)
                .retrieve()
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                .subscribe(
                        sse -> {
                            try {
                                SseEmitter.SseEventBuilder builder = SseEmitter.event();
                                if (sse.event() != null) {
                                    builder.name(sse.event());
                                }
                                
                                if (sse.data() != null) {
                                    try {
                                        JsonNode dataNode = objectMapper.readTree(sse.data());
                                        
                                        // Collect tokens for persistence
                                        if ("token".equals(sse.event())) {
                                            String content = dataNode.path("data").path("content").asText("");
                                            aiResponseBuilder.append(content);
                                        }
                                        builder.data(dataNode);
                                    } catch (Exception e) {
                                        // If data is not JSON, send it as raw string to avoid breaking the stream
                                        builder.data(sse.data());
                                    }
                                }
                                
                                emitter.send(builder);
                            } catch (Exception e) {
                                log.warn("SSE send failed: {}", e.getMessage());
                            }
                        },
                        error -> {
                            log.error("Python AI stream error: ", error);
                            try {
                                String errorMsg = error.getMessage() != null ? error.getMessage().replace("\"", "\\\"").replace("\n", "\\n") : "Unknown Error";
                                emitter.send(SseEmitter.event()
                                        .name("error")
                                        .data("{\"event\":\"error\",\"data\":{\"content\":\"" + errorMsg + "\"}}"));
                            } catch (IOException ignored) {}
                            emitter.completeWithError(error);
                        },
                        () -> {
                            log.info("Python AI stream completed. Saving assistant message...");
                            if (finalSessionId != null && aiResponseBuilder.length() > 0) {
                                try {
                                    sessionService.saveMessage(finalSessionId, "assistant", aiResponseBuilder.toString());
                                } catch (Exception e) {
                                    log.error("Failed to save assistant message: {}", e.getMessage());
                                }
                            }
                            emitter.complete();
                        }
                );

        emitter.onTimeout(() -> {
            log.warn("SSE connection timed out");
            emitter.complete();
        });
        emitter.onCompletion(() -> log.debug("SSE connection closed"));

        return emitter;
    }

    @Operation(summary = "Non-streaming agent chat (proxy to Python)")
    @PostMapping(value = "/agent/chat", produces = MediaType.APPLICATION_JSON_VALUE)
    public String chatAgent(@RequestBody String rawBody) {
        // Simple non-streaming persistence could be added here too
        return webClient.post()
                .uri("/v1/agent/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(rawBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }
}
