package com.rho.backend.exception.user;

public class DuplicateCredentialException extends RuntimeException {
    public DuplicateCredentialException(String message) {
        super(message);
    }
}
