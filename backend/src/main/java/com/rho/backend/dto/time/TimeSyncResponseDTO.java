package com.rho.backend.dto.time;

public record TimeSyncResponseDTO(long clientSentAt, long serverReceivedAt, long serverSentAt) {
}
