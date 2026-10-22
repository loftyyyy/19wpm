package com.rho.backend.controller;

import com.rho.backend.dto.telemetry.WebVitalsRequestDTO;
import com.rho.backend.service.WebVitalsService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/telemetry")
public class TelemetryController {

    private final WebVitalsService webVitalsService;

    public TelemetryController(WebVitalsService webVitalsService) {
        this.webVitalsService = webVitalsService;
    }

    @PostMapping("/web-vitals")
    public ResponseEntity<Void> ingestWebVitals(
            @Valid @RequestBody WebVitalsRequestDTO request) {
        webVitalsService.record(request);
        return ResponseEntity.accepted().build();
    }
}
