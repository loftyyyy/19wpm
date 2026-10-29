package com.rho.backend.service;

import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.TextType;
import com.rho.backend.model.Text;
import com.rho.backend.repository.TextRepository;
import com.rho.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TextServiceAllTypesSamplingTest {

    private static final Map<TextType, Long> POOL_SIZES = Map.of(
            TextType.SHORT, 100L,
            TextType.MEDIUM, 40L,
            TextType.LONG, 5L,
            TextType.THICC, 300L);

    @Mock
    private TextRepository textRepository;

    @Mock
    private UserRepository userRepository;

    private final AtomicLong sequence = new AtomicLong();

    private TextService textService;

    @BeforeEach
    void setUp() {
        textService = new TextService(textRepository, userRepository);
    }

    @Test
    void samplesEveryAvailableTypeEvenWhenOnePoolDominates() {
        when(textRepository.countByLanguage("en")).thenReturn(445L);
        when(textRepository.countByLanguageAndType(eq("en"), any(TextType.class)))
                .thenAnswer(invocation -> POOL_SIZES.get(invocation.getArgument(1)));
        when(textRepository.findPageByLanguageAndType(eq("en"), anyString(), eq(1), anyLong()))
                .thenAnswer(invocation -> List.of(textOf("en", invocation.getArgument(1))));

        List<TextResponseDTO> texts = textService.getRandomTexts("en", 4);

        assertThat(texts).hasSize(4);
        assertThat(texts).extracting(TextResponseDTO::textId).doesNotHaveDuplicates();
        // A round-robin probe guarantees every available type is represented regardless of the
        // fact that the THICC pool is far larger than the others.
        assertThat(texts)
                .extracting(text -> typeOf(text.charLength()))
                .containsExactlyInAnyOrder(TextType.SHORT, TextType.MEDIUM, TextType.LONG, TextType.THICC);
    }

    @Test
    void returnsRequestedCountWhenFewerTypesThanCount() {
        when(textRepository.countByLanguage("en")).thenReturn(4L);
        when(textRepository.countByLanguageAndType(eq("en"), any(TextType.class)))
                .thenAnswer(invocation -> {
                    TextType type = invocation.getArgument(1);
                    return (type == TextType.SHORT || type == TextType.MEDIUM) ? 2L : 0L;
                });
        when(textRepository.findPageByLanguageAndType(eq("en"), anyString(), eq(1), anyLong()))
                .thenAnswer(invocation -> List.of(textOf("en", invocation.getArgument(1))));

        List<TextResponseDTO> texts = textService.getRandomTexts("en", 3);

        assertThat(texts).hasSize(3);
        assertThat(texts).extracting(TextResponseDTO::textId).doesNotHaveDuplicates();
    }

    private Text textOf(String language, String typeName) {
        TextType type = TextType.valueOf(typeName);
        return Text.builder()
                .textId(sequence.incrementAndGet())
                .isCustom(false)
                .title(typeName.toLowerCase())
                .author("author")
                .source("source")
                .language(language)
                .content(typeName)
                .wordCount(1)
                .charLength(charLengthFor(type))
                .type(type)
                .build();
    }

    private int charLengthFor(TextType type) {
        return switch (type) {
            case SHORT -> 80;
            case MEDIUM -> 200;
            case LONG -> 400;
            case THICC -> 800;
        };
    }

    private TextType typeOf(int charLength) {
        if (charLength < 100) return TextType.SHORT;
        if (charLength < 300) return TextType.MEDIUM;
        if (charLength < 600) return TextType.LONG;
        return TextType.THICC;
    }
}
