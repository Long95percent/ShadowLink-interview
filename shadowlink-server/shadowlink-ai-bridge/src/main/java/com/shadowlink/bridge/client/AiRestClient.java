package com.shadowlink.bridge.client;

import com.shadowlink.bridge.config.AiBridgeProperties;
import com.shadowlink.bridge.dto.AgentChatRequest;
import com.shadowlink.bridge.dto.AgentEventDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

/**
 * REST fallback client for the Python AI service.
 * Used when gRPC is unavailable or for debugging.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiRestClient {

    @Qualifier("aiWebClient")
    private final WebClient webClient;
    private final AiBridgeProperties properties;

    public Flux<AgentEventDTO> streamChat(AgentChatRequest request) {
        return webClient.post()
                .uri("/v1/agent/chat")
                .bodyValue(request)
                .retrieve()
                .bodyToFlux(AgentEventDTO.class)
                .doOnError(e -> log.error("REST agent call failed: {}", e.getMessage()));
    }
}
