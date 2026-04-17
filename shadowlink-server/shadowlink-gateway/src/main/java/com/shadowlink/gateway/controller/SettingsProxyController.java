package com.shadowlink.gateway.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Proxy for settings-related requests (e.g., API connectivity tests) to Python backend.
 */
@Slf4j
@Tag(name = "Settings Proxy", description = "Proxy settings requests to Python AI service")
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsProxyController {

    @Qualifier("aiWebClient")
    private final WebClient webClient;

    @Operation(summary = "Test LLM provider connectivity (proxy to Python)")
    @PostMapping("/providers/test")
    public String testProvider(@RequestBody String rawBody) {
        log.info("Forwarding connectivity test request to Python...");
        return webClient.post()
                .uri("/v1/settings/providers/test")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(rawBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }
}
