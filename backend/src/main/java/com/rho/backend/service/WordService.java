package com.rho.backend.service;

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
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class WordService {
    private final WordRepository wordRepository;
    private final UserRepository userRepository;

    public WordService(WordRepository wordRepository, UserRepository userRepository){
        this.wordRepository = wordRepository;
        this.userRepository = userRepository;
    }

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

        Long maxId = wordRepository.findMaxIdByLanguageAndDifficulty(language, difficulty.name())
                .orElseThrow(() -> new ResourceNotFoundException("No words found for language: " + language + " and difficulty: " + difficulty));

        List<Word> results = new ArrayList<>();

        for(int i = 0; i < count; i++){
            Long randId = ThreadLocalRandom.current().nextLong(1, maxId + 1);
            List<Word> found = wordRepository.findFirstByIdGreaterThanEqualAndLanguageAndDifficulty(
                    randId, language, difficulty, PageRequest.of(0, 1));

            if(found.isEmpty()){
                found = wordRepository.findFirstByIdGreaterThanEqualAndLanguageAndDifficulty(
                        1L, language, difficulty, PageRequest.of(0, 1));
            }

            results.add(found.get(0));
        }

        return results.stream().map(WordResponseDTO::new).toList();
    }

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

    public void deleteWord(Long wordId, long userId){
        assertAdmin(userId);

        wordRepository.findById(wordId)
                .orElseThrow(() -> new ResourceNotFoundException("Word not found"));

        wordRepository.deleteById(wordId);
    }

    private void assertAdmin(long userId){
        User user = userRepository.findByIdWithRole(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found!"));
        if(!user.getRole().getName().equals("ADMIN")){
            throw new UnauthorizedResourceException("You cannot perform this action");
        }
    }
}
