package com.rho.backend.content;

import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.dto.word.response.WordResponseDTO;
import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.enums.TextType;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.model.Text;
import com.rho.backend.model.Word;
import com.rho.backend.repository.TextRepository;
import com.rho.backend.repository.WordRepository;
import com.rho.backend.service.TextService;
import com.rho.backend.service.WordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
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

    @BeforeEach
    void setUp() {
        wordRepository.deleteAll();
        textRepository.deleteAll();

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
}
