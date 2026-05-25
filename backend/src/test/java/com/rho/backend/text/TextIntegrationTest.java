package com.rho.backend.text;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rho.backend.dto.auth.request.AuthRequestDTO;
import com.rho.backend.dto.auth.request.RegisterRequestDTO;
import com.rho.backend.dto.text.request.TextRequestDTO;
import com.rho.backend.dto.text.request.TextUpdateRequestDTO;
import com.rho.backend.enums.AuthProvider;
import com.rho.backend.model.Role;
import com.rho.backend.model.User;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.h2.engine.UserBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private String userTextsURL = "/api/v1/texts/user-texts";
    private String createTextURL = "/api/v1/texts/text";
    private String createCustomTextURL = "/api/v1/texts/custom-text";
    private String signUpURL = "/api/v1/auth/signup";
    private String logInURL = "/api/v1/auth/login";

    private RegisterRequestDTO validRegister = new RegisterRequestDTO(
            "james", "John", "Doe", "james@gmail.com", "Test12345", "PH"
    );

    private RegisterRequestDTO adminRegister = new RegisterRequestDTO(
            "admin", "Admin", "User", "admin@gmail.com", "Test12345", "PH"
    );
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp(){
        roleRepository.deleteAll();
        userRepository.deleteAll();
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
        String responseBody = mockMvc.perform(post(signUpURL)
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

    private Map<String, String> loginUserAdmin() throws Exception {
        userRepository.save(User.builder()
                        .username("admin")
                        .firstName("Admin")
                        .lastName("user")
                        .country("PH")
                        .email("admin1@gmail.com")
                        .password(passwordEncoder.encode("Test13245"))
                        .isActive(Boolean.TRUE)
                        .provider(AuthProvider.LOCAL)
                        .role(roleRepository.getRoleByName("ADMIN"))
                .build());

        AuthRequestDTO adminLogin = new AuthRequestDTO(
                "admin1@gmail.com",
                "Test13245"
        );

        String responseBody = mockMvc.perform(post(logInURL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(adminLogin)))
                .andDo(print())
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String accessToken = objectMapper.readTree(responseBody).get("accessToken").asText();
        String refreshToken = objectMapper.readTree(responseBody).get("refreshToken").asText();
        return Map.of("accessToken", accessToken, "refreshToken", refreshToken);
    }

    @Nested
    class GetPresetTextsTest {
        @DisplayName("Should return preset texts")
        @Test
        void testGetPresetTexts() throws Exception {
            String accessToken = createUser(validRegister).get("accessToken");

            mockMvc.perform(get(presetTextsURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken))
                    .andDo(print())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray());
        }

        @DisplayName("Should return unauthorized without token")
        @Test
        void testGetPresetTextsWithoutToken() throws Exception {
            mockMvc.perform(get(presetTextsURL)
                    .contentType(MediaType.APPLICATION_JSON))
                    .andDo(print())
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    class GetUserTextsTest {
        @DisplayName("Should return user texts")
        @Test
        void testGetUserTexts() throws Exception {
            String accessToken = createUser(validRegister).get("accessToken");

            mockMvc.perform(get(userTextsURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken))
                    .andDo(print())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray());
        }

        @DisplayName("Should return unauthorized without token")
        @Test
        void testGetUserTextsWithoutToken() throws Exception {
            mockMvc.perform(get(userTextsURL)
                    .contentType(MediaType.APPLICATION_JSON))
                    .andDo(print())
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    class CreateTextTest {
        private TextRequestDTO validTextRequest;

        @BeforeEach
        void setUp(){
            validTextRequest = new TextRequestDTO(
                    "Sample Title",
                    "Sample Author",
                    "Sample Source",
                    "English",
                    "This is sample text content for testing purposes."
            );
        }

        @DisplayName("Should create text as ADMIN")
        @Test
        void testCreateTextAsAdmin() throws Exception {
            // Create admin user first
            String adminAccessToken = loginUserAdmin().get("accessToken");

            mockMvc.perform(post(createTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + adminAccessToken)
                    .content(objectMapper.writeValueAsString(validTextRequest)))
                    .andDo(print())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Sample Title"))
                    .andExpect(jsonPath("$.author").value("Sample Author"));
        }

        @DisplayName("Should return forbidden for non-ADMIN user")
        @Test
        void testCreateTextAsNonAdmin() throws Exception {
            String userAccessToken = createUser(validRegister).get("accessToken");

            mockMvc.perform(post(createTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + userAccessToken)
                    .content(objectMapper.writeValueAsString(validTextRequest)))
                    .andDo(print())
                    .andExpect(status().isForbidden());
        }

        @DisplayName("Should return bad request for missing required fields")
        @Test
        void testCreateTextWithMissingFields() throws Exception {
            String adminAccessToken = createUser(adminRegister).get("accessToken");

            TextRequestDTO invalidRequest = new TextRequestDTO(
                    "",
                    "Sample Author",
                    "Sample Source",
                    "English",
                    "Sample content"
            );

            mockMvc.perform(post(createTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + adminAccessToken)
                    .content(objectMapper.writeValueAsString(invalidRequest)))
                    .andDo(print())
                    .andExpect(status().isBadRequest());
        }

        @DisplayName("Should return bad request for title exceeding max length")
        @Test
        void testCreateTextWithTitleExceedingMaxLength() throws Exception {
            String adminAccessToken = createUser(adminRegister).get("accessToken");

            TextRequestDTO invalidRequest = new TextRequestDTO(
                    "a".repeat(101),
                    "Sample Author",
                    "Sample Source",
                    "English",
                    "Sample content"
            );

            mockMvc.perform(post(createTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + adminAccessToken)
                    .content(objectMapper.writeValueAsString(invalidRequest)))
                    .andDo(print())
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    class CreateCustomTextTest {
        private TextRequestDTO validTextRequest;

        @BeforeEach
        void setUp(){
            validTextRequest = new TextRequestDTO(
                    "My Custom Text",
                    "Me",
                    "My Source",
                    "English",
                    "This is my custom text content for practice."
            );
        }

        @DisplayName("Should create custom text as authenticated user")
        @Test
        void testCreateCustomText() throws Exception {
            String accessToken = createUser(validRegister).get("accessToken");

            mockMvc.perform(post(createCustomTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken)
                    .content(objectMapper.writeValueAsString(validTextRequest)))
                    .andDo(print())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("My Custom Text"))
                    .andExpect(jsonPath("$.author").value("Me"));
        }

        @DisplayName("Should return unauthorized without token")
        @Test
        void testCreateCustomTextWithoutToken() throws Exception {
            mockMvc.perform(post(createCustomTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validTextRequest)))
                    .andDo(print())
                    .andExpect(status().isUnauthorized());
        }

        @DisplayName("Should return bad request for missing required fields")
        @Test
        void testCreateCustomTextWithMissingFields() throws Exception {
            String accessToken = createUser(validRegister).get("accessToken");

            TextRequestDTO invalidRequest = new TextRequestDTO(
                    null,
                    "Me",
                    "My Source",
                    "English",
                    "Sample content"
            );

            mockMvc.perform(post(createCustomTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken)
                    .content(objectMapper.writeValueAsString(invalidRequest)))
                    .andDo(print())
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    class ModifyTextTest {
        private TextRequestDTO validTextRequest;
        private TextUpdateRequestDTO updateTextRequest;

        @BeforeEach
        void setUp(){
            validTextRequest = new TextRequestDTO(
                    "Original Title",
                    "Original Author",
                    "Original Source",
                    "English",
                    "Original content for text."
            );

            updateTextRequest = new TextUpdateRequestDTO(
                    "Updated Title",
                    "Updated Author",
                    "Updated Source",
                    "English",
                    "Updated content for text."
            );
        }

        @DisplayName("Should modify custom text")
        @Test
        void testModifyCustomText() throws Exception {
            String accessToken = createUser(validRegister).get("accessToken");

            // Create custom text first
            String responseBody = mockMvc.perform(post(createCustomTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken)
                    .content(objectMapper.writeValueAsString(validTextRequest)))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            System.out.println(responseBody);
            long textId = objectMapper.readTree(responseBody).get("textId").asLong();

            // Modify the text
            mockMvc.perform(post("/api/v1/texts/" + textId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken)
                    .content(objectMapper.writeValueAsString(updateTextRequest)))
                    .andDo(print())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Updated Title"))
                    .andExpect(jsonPath("$.author").value("Updated Author"));
        }

        @DisplayName("Should return unauthorized without token")
        @Test
        void testModifyTextWithoutToken() throws Exception {
            mockMvc.perform(post("/api/v1/texts/1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(updateTextRequest)))
                    .andDo(print())
                    .andExpect(status().isUnauthorized());
        }

        @DisplayName("Should return bad request for invalid update")
        @Test
        void testModifyTextWithInvalidData() throws Exception {
            String accessToken = createUser(validRegister).get("accessToken");

            // Create custom text first
            String responseBody = mockMvc.perform(post(createCustomTextURL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken)
                    .content(objectMapper.writeValueAsString(validTextRequest)))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            long textId = objectMapper.readTree(responseBody).get("textId").asLong();

            // Try to update with title exceeding max length
            TextUpdateRequestDTO invalidUpdate = new TextUpdateRequestDTO(
                    "a".repeat(101),
                    "Updated Author",
                    "Updated Source",
                    "English",
                    "Updated content"
            );

            mockMvc.perform(post("/api/v1/texts/" + textId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken)
                    .content(objectMapper.writeValueAsString(invalidUpdate)))
                    .andDo(print())
                    .andExpect(status().isBadRequest());
        }
    }
}
