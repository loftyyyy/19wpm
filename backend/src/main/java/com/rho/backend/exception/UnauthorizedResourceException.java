package com.rho.backend.exception;

public class UnauthorizedResourceException extends RuntimeException {
    public UnauthorizedResourceException(String message) {
        super(message);
    }
}
