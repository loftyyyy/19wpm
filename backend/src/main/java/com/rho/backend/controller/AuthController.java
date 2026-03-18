package com.rho.backend.controller;

import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.response.AuthResponseDTO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @RequestMapping("/login")
    public ResponseEntity<AuthResponseDTO> login(@Valid @RequestBody AuthRequestDTO authRequestDTO, HttpServletRequest request){


    }

    @RequestMapping("/signup")
    public ResponseEntity<AuthRequestDTO> signup(@Valid @RequestBody HttpServletRequest httpServletRequest){


    }

    @RequestMapping("/logout")
    public ResponseEntity<?> logout(){

    }

}


