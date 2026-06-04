package com.rho.backend.controller;


import com.rho.backend.config.CustomUserDetails;
import com.rho.backend.dto.userStat.response.UserStatResponseDTO;
import com.rho.backend.service.UserStatService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stats")
public class UserStatController {

    private final UserStatService userStatService;

    public UserStatController(UserStatService userStatService){
        this.userStatService = userStatService;
    }

    @GetMapping
    public ResponseEntity<UserStatResponseDTO> getStat(@AuthenticationPrincipal CustomUserDetails customUserDetails){
        return ResponseEntity.ok(userStatService.getStat(customUserDetails.getUserId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserStatResponseDTO> getUserStat(@PathVariable long id){
        return ResponseEntity.ok(userStatService.getStat(id));
    }

}
