package com.rho.backend.exception;

public class InvalidResourceException extends RuntimeException {
    public InvalidResourceException(String message) {
        super(message);
    }
}
