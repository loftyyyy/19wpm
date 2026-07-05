package com.rho.backend.dto.race;

import com.rho.backend.enums.TextType;

public record CreateRoomRequestDTO(
        TextType textType,
        Boolean isPrivate
) {}
