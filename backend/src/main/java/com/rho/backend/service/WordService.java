package com.rho.backend.service;

import com.rho.backend.config.CacheConfig;
import com.rho.backend.dto.word.request.WordRequestDTO;
import com.rho.backend.dto.word.response.WordResponseDTO;
import com.rho.backend.enums.TextDifficulty;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.exception.UnauthorizedResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.User;
import com.rho.backend.model.Word;
import com.rho.backend.repository.UserRepository;
import com.rho.backend.repository.WordRepository;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class WordService {

    private static final int MAX_CACHED_WORDS = 5_000;

    private final WordRepository wordRepository;
    private final UserRepository userRepository;
    private final Cache wordPoolCache;

    public WordService(WordRepository wordRepository, UserRepository userRepository, CacheManager cacheManager){
        this.wordRepository = wordRepository;
        this.userRepository = userRepository;
        this.wordPoolCache = Objects.requireNonNull(
                cacheManager.getCache(CacheConfig.WORD_POOLS), "wordPools cache is not configured");
    }

    @CacheEvict(cacheNames = CacheConfig.WORD_POOLS, allEntries = true)
    public WordResponseDTO saveWord(WordRequestDTO wordRequestDTO, long userId){
        assertAdmin(userId);

        if(wordRequestDTO.word() == null || wordRequestDTO.word().isBlank()){
            throw new InvalidResourceException("Word cannot be empty");
        }
        if(wordRequestDTO.language() == null || wordRequestDTO.language().isBlank()){
            throw new InvalidResourceException("Language cannot be empty");
        }
        if(wordRequestDTO.difficulty() == null){
            throw new InvalidResourceException("Difficulty cannot be null");
        }

        Word word = Word.builder()
                .word(wordRequestDTO.word())
                .language(wordRequestDTO.language())
                .difficulty(wordRequestDTO.difficulty())
                .build();

        return new WordResponseDTO(wordRepository.save(word));
    }

    @CacheEvict(cacheNames = CacheConfig.WORD_POOLS, allEntries = true)
    public void saveWords(List<WordRequestDTO> wordRequestDTOs, long userId){
        assertAdmin(userId);

        if(wordRequestDTOs == null || wordRequestDTOs.isEmpty()){
            throw new InvalidResourceException("Word list cannot be empty");
        }

        List<Word> words = wordRequestDTOs.stream()
                .filter(dto -> dto.word() != null && !dto.word().isBlank())
                .map(dto -> Word.builder()
                        .word(dto.word())
                        .language(dto.language())
                        .difficulty(dto.difficulty())
                        .build())
                .toList();

        wordRepository.saveAll(words);
    }

    public List<WordResponseDTO> getRandomWords(String language, TextDifficulty difficulty, int count){
        if(language == null || language.isBlank()){
            throw new InvalidResourceException("Language cannot be empty");
        }
        if(difficulty == null){
            throw new InvalidResourceException("Difficulty cannot be null");
        }
        if(count <= 0){
            throw new InvalidResourceException("Count must be greater than 0");
        }

        String normalizedLanguage = language.trim().toLowerCase();
        WordPool pool = getWordPool(normalizedLanguage, difficulty);

        if(count > pool.total()){
            throw new InvalidResourceException("Count exceeds available words");
        }
        if(count > pool.words().size()){
            long offset = ThreadLocalRandom.current().nextLong(pool.total() - count + 1);
            return wordRepository.findPageByLanguageAndDifficulty(
                            normalizedLanguage, difficulty.name(), count, offset)
                    .stream()
                    .map(WordResponseDTO::new)
                    .toList();
        }

        List<WordResponseDTO> shuffled = new ArrayList<>(pool.words());
        Collections.shuffle(shuffled, ThreadLocalRandom.current());
        return List.copyOf(shuffled.subList(0, count));
    }

    @CacheEvict(cacheNames = CacheConfig.WORD_POOLS, allEntries = true)
    public void deleteWord(Long wordId, long userId){
        assertAdmin(userId);

        wordRepository.findById(wordId)
                .orElseThrow(() -> new ResourceNotFoundException("Word not found"));

        wordRepository.deleteById(wordId);
    }

    private WordPool getWordPool(String language, TextDifficulty difficulty){
        String cacheKey = language + ':' + difficulty.name();
        WordPool cached = wordPoolCache.get(cacheKey, WordPool.class);
        if(cached != null){
            return cached;
        }

        long total = wordRepository.countByLanguageAndDifficulty(language, difficulty);
        if(total == 0){
            throw new ResourceNotFoundException(
                    "No words found for language: " + language + " and difficulty: " + difficulty);
        }

        int poolSize = (int) Math.min(total, MAX_CACHED_WORDS);
        long offset = total > MAX_CACHED_WORDS
                ? ThreadLocalRandom.current().nextLong(total - MAX_CACHED_WORDS + 1)
                : 0;
        List<WordResponseDTO> words = wordRepository.findPageByLanguageAndDifficulty(
                        language, difficulty.name(), poolSize, offset)
                .stream()
                .map(WordResponseDTO::new)
                .toList();

        WordPool pool = new WordPool(total, List.copyOf(words));
        wordPoolCache.put(cacheKey, pool);
        return pool;
    }

    private record WordPool(long total, List<WordResponseDTO> words) {
    }

    private void assertAdmin(long userId){
        User user = userRepository.findByIdWithRole(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found!"));
        if(!user.getRole().getName().equals("ADMIN")){
            throw new UnauthorizedResourceException("You cannot perform this action");
        }
    }
}
