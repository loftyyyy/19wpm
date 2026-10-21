package com.rho.backend.content;

import com.rho.backend.config.CacheConfig;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.dto.word.request.WordRequestDTO;
import com.rho.backend.dto.word.response.WordResponseDTO;
import com.rho.backend.enums.AuthProvider;
import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.enums.TextType;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.model.Role;
import com.rho.backend.model.Text;
import com.rho.backend.model.User;
import com.rho.backend.model.Word;
import com.rho.backend.repository.RoleRepository;
import com.rho.backend.repository.TextRepository;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.repository.WordRepository;
import com.rho.backend.service.TextService;
import com.rho.backend.service.WordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
@Transactional
class RandomContentIntegrationTest {

    @Autowired
    private WordService wordService;

    @Autowired
    private TextService textService;

    @Autowired
    private WordRepository wordRepository;

    @Autowired
    private TextRepository textRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    private long adminId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        cacheManager.getCache(CacheConfig.WORD_POOLS).clear();
        userRepository.deleteAll();
        roleRepository.deleteAll();
        wordRepository.deleteAll();
        textRepository.deleteAll();

        Role adminRole = roleRepository.save(Role.builder().name("ADMIN").build());
        User admin = userRepository.save(User.builder()
                .username("admin")
                .firstName("Admin")
                .lastName("User")
                .country("PH")
                .email("admin@example.com")
                .isActive(true)
                .provider(AuthProvider.LOCAL)
                .timezone("UTC")
                .role(adminRole)
                .build());
        adminId = admin.getUserId();

        wordRepository.saveAll(IntStream.range(0, 5)
                .mapToObj(index -> Word.builder()
                        .word("word-" + index)
                        .language("en")
                        .difficulty(TextDifficulty.EASY)
                        .build())
                .toList());

        textRepository.saveAll(IntStream.range(0, 3)
                .mapToObj(index -> Text.builder()
                        .isCustom(false)
                        .title("title-" + index)
                        .author("author")
                        .source("source")
                        .language("en")
                        .content("content-" + index)
                        .wordCount(1)
                        .charLength(9)
                        .type(TextType.SHORT)
                        .build())
                .toList());
    }

    @Test
    void returnsRequestedNumberOfDistinctWords() {
        List<WordResponseDTO> words = wordService.getRandomWords("en", TextDifficulty.EASY, 3);

        assertThat(words).hasSize(3);
        assertThat(words).extracting(WordResponseDTO::word).doesNotHaveDuplicates();
    }

    @Test
    void rejectsWordCountAboveAvailablePool() {
        assertThatThrownBy(() -> wordService.getRandomWords("en", TextDifficulty.EASY, 6))
                .isInstanceOf(InvalidResourceException.class);
    }

    @Test
    void cachesWordPoolAndEvictsItWhenWordsChange() {
        wordService.getRandomWords("en", TextDifficulty.EASY, 3);
        var cache = cacheManager.getCache(CacheConfig.WORD_POOLS);
        assertThat(cache.get("en:EASY")).isNotNull();

        wordService.saveWord(new WordRequestDTO("fresh-word", "en", TextDifficulty.EASY), adminId);

        assertThat(cache.get("en:EASY")).isNull();
        assertThat(wordService.getRandomWords("en", TextDifficulty.EASY, 6)).hasSize(6);
    }

    @Test
    void returnsRequestedNumberOfDistinctTexts() {
        List<TextResponseDTO> texts = textService.getRandomTexts("en", TextType.SHORT, 2);

        assertThat(texts).hasSize(2);
        assertThat(texts).extracting(TextResponseDTO::textId).doesNotHaveDuplicates();
    }

    @Test
    void returnsSingleRandomTextFromPresetCatalogue() {
        TextResponseDTO text = textService.getRandomText();

        assertThat(text.textId()).isNotNull();
    }

    @Test
    void returnsSingleRandomTextByType() {
        TextResponseDTO text = textService.getRandomTextByType(TextType.SHORT);

        assertThat(text.textId()).isNotNull();
    }

    @Test
    void wordEndpointEmitsServerTimingHeader() throws Exception {
        String header = mockMvc.perform(get("/api/v1/words")
                        .param("language", "en")
                        .param("difficulty", "EASY")
                        .param("count", "3"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getHeader("Server-Timing");

        assertThat(header).matches("words;dur=\\d+");
    }

    @Test
    void textBatchEndpointEmitsServerTimingHeader() throws Exception {
        String header = mockMvc.perform(get("/api/v1/texts")
                        .param("language", "en")
                        .param("textType", "SHORT")
                        .param("count", "2"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getHeader("Server-Timing");

        assertThat(header).matches("texts;dur=\\d+");
    }
}
