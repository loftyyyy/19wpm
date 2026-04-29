package com.rho.backend.controller;

import com.rho.backend.service.TypingResultService;
import org.springframework.web.bind.annotation.RestController;

@RestController("/api/v1/result")
public class TypingResultController {

    private final TypingResultService typingResultService;

    public TypingResultController(TypingResultService typingResultService){
        this.typingResultService = typingResultService;
    }





}
