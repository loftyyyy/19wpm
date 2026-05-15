package com.rho.backend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.model.Role;
import com.rho.backend.repository.RoleRepository;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
@Transactional // rolls back DB changes after each test
public class AuthenticationTest {
    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    @Autowired
    private RoleRepository roleRepository;

    @Nested
    class CreateUserTest {
        RegisterRequestDTO validRequest;
        String url = "/api/v1/auth/signup";

        @BeforeEach
        void setUp(){
            mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                    .apply(springSecurity())
                    .build();
            objectMapper = new ObjectMapper();

            roleRepository.saveAll(List.of(
                    Role.builder().name("ADMIN").build(),
                    Role.builder().name("USER").build()
            ));

            validRequest = new RegisterRequestDTO(
                    "james", "John", "Doe", "james@gmail.com", "Test132", "PH"
            );
        }

        @DisplayName("Should create new user")
        @Test
        void testSuccessfulRegister() throws Exception {
            mockMvc.perform(post(url)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(validRequest))
                    )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andDo(print());
        }

        @DisplayName("Should Return Duplicate Error")
        @Test
        void testDuplicateUserRegister() throws Exception {
            mockMvc.perform(post(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andDo(print());


            mockMvc.perform(post(url)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(validRequest)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Email already registered."))
                    .andDo(print());
        }

        @DisplayName("Should Return Missing field/s")
        @Test
        void testMissingFieldRegister() throws Exception {
            RegisterRequestDTO bad = new RegisterRequestDTO(
                    null, null, "Doe", "james1@gmail.com", "Test132", "PH"
            );
            mockMvc.perform(post(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(bad)))
                    .andExpect(status().isBadRequest())
                    .andDo(print());

        }



    }





}
