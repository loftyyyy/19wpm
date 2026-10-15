package com.rho.backend.dto.common;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Stable, framework-agnostic envelope for a page of results.
 *
 * <p>Returning this instead of a raw {@link Page} keeps the JSON contract
 * independent of Spring Data's serialization details and lets a page of
 * entities be mapped to DTOs in one step.
 */
public record PageResponseDTO<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last
) {
    public static <S, T> PageResponseDTO<T> of(Page<S> page, Function<S, T> mapper) {
        return new PageResponseDTO<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast());
    }
}
