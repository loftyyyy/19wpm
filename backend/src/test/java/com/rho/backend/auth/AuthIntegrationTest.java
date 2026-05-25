package com.rho.backend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rho.backend.dto.auth.request.AuthRequestDTO;
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
public class AuthIntegrationTest {
    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    @Autowired
    private RoleRepository roleRepository;

    private String signUpURL = "/api/v1/auth/signup";
    private String logInURL = "/api/v1/auth/login";

    @Nested
    class CreateUserTest {
        RegisterRequestDTO validRegister;

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

            validRegister = new RegisterRequestDTO(
                    "james", "John", "Doe", "james@gmail.com", "Test12345", "PH"
            );
        }

        @DisplayName("Should create new user")
        @Test
        void testSuccessfulRegister() throws Exception {
            mockMvc.perform(post(signUpURL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(validRegister))
                    )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andDo(print());
        }

        @DisplayName("Should Return Duplicate Error")
        @Test
        void testDuplicateUserRegister() throws Exception {
            mockMvc.perform(post(signUpURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validRegister)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andDo(print());


            mockMvc.perform(post(signUpURL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(validRegister)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Email already registered."))
                    .andDo(print());
        }

        @DisplayName("Should Return Missing field/s")
        @Test
        void testMissingFieldRegister() throws Exception {
            RegisterRequestDTO bad = new RegisterRequestDTO(
                    null, null, "Doe", "james1@gmail.com", "Test12345", "PH"
            );
            mockMvc.perform(post(signUpURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(bad)))
                    .andExpect(status().isBadRequest())
                    .andDo(print());

        }
    }

    @Nested
    class LogUserTest {
        RegisterRequestDTO validRegister;

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

            validRegister = new RegisterRequestDTO(
                    "james", "John", "Doe", "james@gmail.com", "Test12345", "PH"
            );
        }

        private void registerUser(RegisterRequestDTO registerRequestDTO) throws Exception{
            mockMvc.perform(post(signUpURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(registerRequestDTO)))
                    .andExpect(status().isOk());

        }

        @DisplayName("Should log the user successfully")
        @Test
        void testSuccessfulLogin() throws Exception {
            registerUser(validRegister);

            AuthRequestDTO authRequestDTO = new AuthRequestDTO(
                    "james@gmail.com", "Test12345"
            );

            mockMvc.perform(post(logInURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(authRequestDTO)))
                    .andDo(print())
                    .andExpect(status().isOk());
        }

        @DisplayName("Should return invalid credentials")
        @Test
        void testIncorrectPasswordLogin() throws Exception {
            registerUser(validRegister);

            AuthRequestDTO authRequestDTO = new AuthRequestDTO(
                    "james@gmail.com", "Test123456"
            );

            mockMvc.perform(post(logInURL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(authRequestDTO)))
                    .andDo(print())
                    .andExpect(jsonPath("$.message").value("Invalid credentials"))
                    .andExpect(status().isUnauthorized());
        }

        @DisplayName("Should return invalid credentials")
        @Test
        void testIncorrectEmailLogin() throws Exception {
            registerUser(validRegister);

            AuthRequestDTO authRequestDTO = new AuthRequestDTO(
                    "james@gmail.com", "Test123456"
            );

            mockMvc.perform(post(logInURL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(authRequestDTO)))
                    .andDo(print())
                    .andExpect(jsonPath("$.message").value("Invalid credentials"))
                    .andExpect(status().isUnauthorized());
        }

        @DisplayName("Should return validation failed")
        @Test
        void testEmptyLoginField() throws Exception {
            registerUser(validRegister);

            AuthRequestDTO authRequestDTO = new AuthRequestDTO(
                    "", ""
            );

            mockMvc.perform(post(logInURL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(authRequestDTO)))
                    .andDo(print())
                    .andExpect(jsonPath("$.message").value("Validation Failed"))
                    .andExpect(status().isBadRequest());
        }

    }
}
