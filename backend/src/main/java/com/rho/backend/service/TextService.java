package com.rho.backend.service;

import com.rho.backend.config.CacheConfig;
import com.rho.backend.dto.text.request.TextRequestDTO;
import com.rho.backend.dto.text.request.TextUpdateRequestDTO;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.enums.TextType;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.exception.UnauthorizedResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.Text;
import com.rho.backend.model.User;
import com.rho.backend.repository.TextRepository;
import com.rho.backend.repository.UserRepository;
import io.micrometer.observation.annotation.Observed;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class TextService {

    private final TextRepository textRepository;
    private final UserRepository userRepository;

    public TextService(TextRepository textRepository, UserRepository userRepository){
        this.textRepository = textRepository;
        this.userRepository = userRepository;
    }

    @CacheEvict(cacheNames = CacheConfig.TEXT_CATALOGUE, allEntries = true)
    public TextResponseDTO saveText(TextRequestDTO textRequestDTO, Long id){
        User user = userRepository.findByIdWithRole(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if(!user.getRole().getName().equals("ADMIN")){
            throw new UnauthorizedResourceException("You cannot perform this action");
        }

        return buildAndSaveText(textRequestDTO, id, false);
    }

    @CacheEvict(cacheNames = CacheConfig.TEXT_CATALOGUE, allEntries = true)
    public TextResponseDTO saveCustomText(TextRequestDTO textRequestDTO, Long id){
        return buildAndSaveText(textRequestDTO, id, true);
    }

    private TextResponseDTO buildAndSaveText(TextRequestDTO textRequestDTO, Long id, boolean isCustom){
        if(textRequestDTO.content() == null || textRequestDTO.content().isBlank()){
            throw new InvalidResourceException("Content cannot be empty");
        }
        if(textRequestDTO.title() == null || textRequestDTO.title().isBlank()){
            throw new InvalidResourceException("Title cannot be empty");
        }
        if(textRequestDTO.language() == null || textRequestDTO.language().isBlank()){
            throw new InvalidResourceException("Language cannot be empty");
        }

        String content = textRequestDTO.content();
        int wordCount = wordCountCalculator(content);

        Text text = Text.builder()
                .isCustom(isCustom)
                .createdBy(id)
                .title(textRequestDTO.title())
                .author(textRequestDTO.author())
                .source(textRequestDTO.source())
                .language(textRequestDTO.language())
                .content(content)
                .wordCount(wordCount)
                .charLength(content.length())
                .type(determineType(content.length()))
                .build();

        return new TextResponseDTO(textRepository.save(text));
    }

    @CacheEvict(cacheNames = CacheConfig.TEXT_CATALOGUE, allEntries = true)
    public TextResponseDTO modifyText(TextUpdateRequestDTO textUpdateRequestDTO, Long id, Long textId){
        Text text = textRepository.findById(textId).orElseThrow(() -> new ResourceNotFoundException("Text not found"));

        if(text.getCreatedBy() == null || !text.getCreatedBy().equals(id)){
            throw new UnauthorizedResourceException("You do not own this text!");
        }

        if(textUpdateRequestDTO.title() != null && textUpdateRequestDTO.title().isBlank()){
            throw new InvalidResourceException("Title cannot be empty");
        }
        if(textUpdateRequestDTO.language() != null && textUpdateRequestDTO.language().isBlank()){
            throw new InvalidResourceException("Language cannot be empty");
        }
        if(textUpdateRequestDTO.content() != null && textUpdateRequestDTO.content().isBlank()){
            throw new InvalidResourceException("Content cannot be empty");
        }

        if(textUpdateRequestDTO.title() != null){
            text.setTitle(textUpdateRequestDTO.title());
        }
        if(textUpdateRequestDTO.author() != null){
            text.setAuthor(textUpdateRequestDTO.author());
        }
        if(textUpdateRequestDTO.source() != null){
            text.setSource(textUpdateRequestDTO.source());
        }
        if(textUpdateRequestDTO.language() != null){
            text.setLanguage(textUpdateRequestDTO.language());
        }
        if(textUpdateRequestDTO.content() != null){
            String content = textUpdateRequestDTO.content();
            int wordCount = wordCountCalculator(content);

            text.setContent(content);
            text.setWordCount(wordCount);
            text.setCharLength(content.length());
            text.setType(determineType(content.length()));
        }

        return new TextResponseDTO(textRepository.save(text));
    }


    @Observed(name = "texts.random.batch")
    public List<TextResponseDTO> getRandomTexts(String language, TextType textType , int count){
        if(language == null || language.isBlank()){
            throw new InvalidResourceException("Language cannot be empty");
        }
        if(textType == null){
            throw new InvalidResourceException("Text type cannot be null");
        }
        if(count <= 0){
            throw new InvalidResourceException("Count must be greater than 0");
        }

        String normalizedLanguage = language.trim().toLowerCase();
        long total = textRepository.countByLanguageAndType(normalizedLanguage, textType);

        if(total == 0){
            throw new ResourceNotFoundException("No texts found for language: " + language + " and type: " + textType);
        }
        if(count > total){
            throw new InvalidResourceException("Count exceeds available texts");
        }

        long offset = ThreadLocalRandom.current().nextLong(total - count + 1);
        List<Text> texts = textRepository.findPageByLanguageAndType(
                normalizedLanguage, textType.name(), count, offset);

        return texts.stream()
                .map(TextResponseDTO::new)
                .toList();
    }

    /**
     * Samples {@code count} preset-free texts across every available {@link TextType} instead of a
     * single type. A uniform draw over the whole catalogue is biased by pool size (the longest
     * texts dominate), so the sample round-robins one indexed probe per type and then shuffles the
     * result. Every query stays a count/offset index range scan, so the "all" type is as cheap as a
     * single-type batch.
     */
    @Observed(name = "texts.random.batch.all")
    public List<TextResponseDTO> getRandomTexts(String language, int count) {
        if(language == null || language.isBlank()){
            throw new InvalidResourceException("Language cannot be empty");
        }
        if(count <= 0){
            throw new InvalidResourceException("Count must be greater than 0");
        }

        String normalizedLanguage = language.trim().toLowerCase();
        long total = textRepository.countByLanguage(normalizedLanguage);
        if(total == 0){
            throw new ResourceNotFoundException("No texts found for language: " + language);
        }
        if(count > total){
            throw new InvalidResourceException("Count exceeds available texts");
        }

        List<TextType> availableTypes = Arrays.stream(TextType.values())
                .filter(type -> textRepository.countByLanguageAndType(normalizedLanguage, type) > 0)
                .toList();

        List<Text> selected = new ArrayList<>(count);
        Set<Long> selectedIds = new HashSet<>();
        int maxAttempts = count * availableTypes.size() * 4;
        int attempts = 0;
        while(selected.size() < count && attempts < maxAttempts){
            boolean progressed = false;
            for(TextType type : availableTypes){
                if(selected.size() >= count){
                    break;
                }
                attempts++;
                Text candidate = sampleOne(normalizedLanguage, type);
                if(candidate != null && selectedIds.add(candidate.getTextId())){
                    selected.add(candidate);
                    progressed = true;
                }
            }
            if(!progressed){
                break;
            }
        }

        Collections.shuffle(selected);
        return selected.stream()
                .map(TextResponseDTO::new)
                .toList();
    }

    private Text sampleOne(String language, TextType type){
        long total = textRepository.countByLanguageAndType(language, type);
        if(total == 0){
            return null;
        }
        long offset = ThreadLocalRandom.current().nextLong(total);
        List<Text> texts = textRepository.findPageByLanguageAndType(language, type.name(), 1, offset);
        return texts.isEmpty() ? null : texts.get(0);
    }

    @Observed(name = "texts.by.id")
    public TextResponseDTO getTextById(Long textId, Long id){
        Text text = textRepository.findById(textId).orElseThrow(() -> new ResourceNotFoundException("Text not found"));

        // Preset texts are accessible to all authenticated users
        if (!text.isCustom()) {
            return new TextResponseDTO(text);
        }

        // Custom texts are only accessible to their owner
        if (text.getCreatedBy() == null || !text.getCreatedBy().equals(id)) {
            throw new UnauthorizedResourceException("You do not own this text!");
        }

        return new TextResponseDTO(text);
    }

    @Observed(name = "texts.preset")
    @Cacheable(cacheNames = CacheConfig.TEXT_CATALOGUE, key = "'preset'")
    public List<TextResponseDTO> getPresetTexts(){
        List<Text> texts = textRepository.findByIsCustomFalse();
        return texts.stream().map(TextResponseDTO::new).toList();
    }

    public List<TextResponseDTO> getUserTexts(Long id){
        userRepository.findByIdWithRole(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        List<Text> texts = textRepository.findByCreatedBy(id);
        return texts.stream().map(TextResponseDTO::new).toList();
    }

    public List<TextResponseDTO> getTextsByLanguage(String language){
        if(language == null || language.isBlank()){
            throw new InvalidResourceException("Language cannot be empty");
        }
        List<Text> texts = textRepository.findByLanguage(language);
        return texts.stream().map(TextResponseDTO::new).toList();
    }

    @Observed(name = "texts.random.type")
    public TextResponseDTO getRandomTextByType(TextType type) {
        if(type == null){
            throw new InvalidResourceException("Type cannot be null");
        }

        long total = textRepository.countByIsCustomFalseAndType(type);
        if(total == 0){
            throw new ResourceNotFoundException("No texts found for type: " + type);
        }

        long offset = ThreadLocalRandom.current().nextLong(total);
        List<Text> texts = textRepository.findPresetPageByType(type.name(), 1, offset);

        return new TextResponseDTO(texts.get(0));
    }

    @Cacheable(cacheNames = CacheConfig.TEXT_CATALOGUE, key = "'short'")
    @Observed(name = "texts.short")
    public List<TextResponseDTO> getShortTexts(){
        List<Text> smallTexts = textRepository.findByType(TextType.SHORT);
        return smallTexts.stream().map(TextResponseDTO::new).toList();
    }

    @Cacheable(cacheNames = CacheConfig.TEXT_CATALOGUE, key = "'medium'")
    @Observed(name = "texts.medium")
    public List<TextResponseDTO> getMediumTexts(){
        List<Text> mediumTexts = textRepository.findByType(TextType.MEDIUM);
        return mediumTexts.stream().map(TextResponseDTO::new).toList();
    }

    @Cacheable(cacheNames = CacheConfig.TEXT_CATALOGUE, key = "'long'")
    @Observed(name = "texts.long")
    public List<TextResponseDTO> getLongTexts(){
        List<Text> longTexts = textRepository.findByType(TextType.LONG);
        return longTexts.stream().map(TextResponseDTO::new).toList();
    }

    @Cacheable(cacheNames = CacheConfig.TEXT_CATALOGUE, key = "'thicc'")
    @Observed(name = "texts.thicc")
    public List<TextResponseDTO> getThiccTexts(){
        List<Text> thiccTexts = textRepository.findByType(TextType.THICC);
        return thiccTexts.stream().map(TextResponseDTO::new).toList();
    }

    @Observed(name = "texts.random")
    public TextResponseDTO getRandomText() {
        long total = textRepository.countByIsCustomFalse();
        if(total == 0){
            throw new ResourceNotFoundException("No preset texts found");
        }

        long offset = ThreadLocalRandom.current().nextLong(total);
        List<Text> texts = textRepository.findPresetPage(1, offset);

        return new TextResponseDTO(texts.get(0));
    }

    private TextType determineType(int charLength){
        if(charLength < 100){
            return TextType.SHORT;
        }else if(charLength >= 100 && charLength < 300){
            return TextType.MEDIUM;
        }else if(charLength >= 300 && charLength < 600){
            return TextType.LONG;
        }
        return TextType.THICC;
    }

    private int wordCountCalculator(String content){
        if(content == null || content.isBlank()){
            return 0;
        }
        return content.trim().split("\\s+").length;
    }
}
