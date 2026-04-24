package com.rho.backend.service;

import com.rho.backend.dto.text.request.TextRequestDTO;
import com.rho.backend.dto.text.request.TextUpdateRequestDTO;
import com.rho.backend.dto.text.response.TextResponseDTO;
import com.rho.backend.exception.InvalidResourceException;
import com.rho.backend.exception.UnauthorizedResourceException;
import com.rho.backend.exception.user.ResourceNotFoundException;
import com.rho.backend.model.Text;
import com.rho.backend.model.User;
import com.rho.backend.repository.TextRepository;
import com.rho.backend.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.stereotype.Service;

@Service
public class TextService {

    private final TextRepository textRepository;
    private final UserRepository userRepository;

    public TextService(TextRepository textRepository, UserRepository userRepository){
        this.textRepository = textRepository;
        this.userRepository = userRepository;
    }

    public TextResponseDTO saveText(TextRequestDTO textRequestDTO, Long id){
        User user = userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if(!user.getRole().getName().equals("ADMIN")){
            throw new UnauthorizedResourceException("You cannot perform this action");
        }

        Text text = Text.builder()
                .isCustom(false)
                .createdBy(id)
                .title(textRequestDTO.title())
                .author(textRequestDTO.author())
                .source(textRequestDTO.source())
                .language(textRequestDTO.language())
                .content(textRequestDTO.content())
                .wordCount(textRequestDTO.content().trim().split("\\s+").length)
                .charLength(textRequestDTO.content().length())
                .build();

        return new TextResponseDTO(textRepository.save(text));
    }
    public TextResponseDTO saveCustomText(TextRequestDTO textRequestDTO, Long id){
        Text text = Text.builder()
                .isCustom(true)
                .createdBy(id)
                .title(textRequestDTO.title())
                .author(textRequestDTO.author())
                .source(textRequestDTO.source())
                .language(textRequestDTO.language())
                .content(textRequestDTO.content())
                .wordCount(textRequestDTO.content().trim().split("\\s+").length)
                .charLength(textRequestDTO.content().length())
                .build();

        return new TextResponseDTO(textRepository.save(text));
    }

    public TextResponseDTO modifyText(TextUpdateRequestDTO textUpdateRequestDTO, Long id, Long textId){
        Text text = textRepository.findById(textId).orElseThrow(() -> new ResourceNotFoundException("Text not found"));

        if(text.getCreatedBy() == null || !text.getCreatedBy().equals(id)){
            throw new UnauthorizedResourceException("You do not own this text!");
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

            text.setContent(content);
            text.setWordCount(content.trim().split("\\s+").length);
            text.setCharLength(content.length());
        }

        return new TextResponseDTO(textRepository.save(text));
    }

    public TextResponseDTO getTextById(Long textId, Long id){
        Text text = textRepository.findById(textId).orElseThrow(() -> new ResourceNotFoundException("Text not found"));

        if(text.getCreatedBy() == null || !text.getCreatedBy().equals(id)){
            throw new UnauthorizedResourceException("You do not own this text!");
        }

        return new TextResponseDTO(text);
    }



}
