package com.rho.backend.service;

import com.rho.backend.model.User;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import io.jsonwebtoken.Jwts;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {

    private final static Logger logger = LoggerFactory.getLogger(JwtService.class);
    private static final String CLAIM_TOKEN_TYPE = "type";
    private static final String CLAIM_ROLE       = "role";
    private static final String CLAIM_PROVIDER   = "provider";
    private static final String TYPE_ACCESS  = "ACCESS";
    private static final String TYPE_REFRESH = "REFRESH";

    private final SecretKey secretKey;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;

    public JwtService(@Value("${jwt.secret.key}") String secret, @Value("${jwt.access-token.expiration-ms}") long accessTokenExpirationMs, @Value("${jwt.refresh-token.expiration-ms}") long refreshTokenExpirationMs ){
        this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    public String generateAccessToken(User user){
        logger.debug("Generating access token for {}", user.getEmail());
        return buildToken(user.getEmail(), accessTokenExpirationMs, TYPE_ACCESS, Map.of(CLAIM_ROLE, user.getRole(), CLAIM_PROVIDER, user.getProvider().name()));
    }

    public String refreshAccessToken(User user){
        logger.debug("Generating refresh token for {}", user.getEmail());
        return buildToken(user.getEmail(), accessTokenExpirationMs, TYPE_REFRESH, Map.of());
    }

    public String buildToken(String subject, long expirationMs, String tokenType, Map<String, Object> extraClaims){
        long now = System.currentTimeMillis();
        var builder = Jwts.builder()
                .subject(subject)
                .claim(CLAIM_TOKEN_TYPE, tokenType)
                .issuedAt(new Date(now))
                .expiration(new Date(now + expirationMs))
                .signWith(secretKey);

        extraClaims.forEach(builder::claim);
        return builder.compact();
    }



}
