package com.rho.backend.text;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.model.Role;
import com.rho.backend.repository.RoleRepository;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
@Transactional // rolls back DB changes after each test
public class TextIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    @Autowired
    private RoleRepository roleRepository;

    private String presetTextsURL = "/api/v1/texts/preset-texts";


    private RegisterRequestDTO validRegister = new RegisterRequestDTO(
            "james", "John", "Doe", "james@gmail.com", "Test12345", "PH"
    );

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
    }

    private Map<String, String> createUser(RegisterRequestDTO registerRequestDTO) throws Exception{
        String responseBody = mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequestDTO)))
                .andDo(print())
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String refreshToken = objectMapper.readTree(responseBody).get("refreshToken").asText();
        String accessToken =  objectMapper.readTree(responseBody).get("accessToken").asText();

        return Map.of("accessToken", accessToken, "refreshToken", refreshToken);
    }

    @DisplayName("Should return preset texts")
    @Test
    void getPresetTexts() throws Exception{
        String accessToken = createUser(validRegister).get("accessToken");

        mockMvc.perform(get(presetTextsURL)
                .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + accessToken))
                .andDo(print())
                .andExpect(status().isOk());
    }

}
