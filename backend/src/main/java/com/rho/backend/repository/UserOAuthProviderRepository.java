package com.rho.backend.repository;

import com.rho.backend.enums.AuthProvider;
import com.rho.backend.model.User;
import com.rho.backend.model.UserOAuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserOAuthProviderRepository extends JpaRepository<UserOAuthProvider, Long> {

    Optional<UserOAuthProvider> findByProviderAndProviderId(AuthProvider provider, String providerId);
}
