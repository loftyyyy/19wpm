package com.rho.backend.config;


import io.lettuce.core.ClientOptions;
import io.lettuce.core.SslOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

import java.net.URI;
import java.time.Duration;

@Configuration
@Profile("prod")
public class RedisKeyConfig {

    @Bean
    public LettuceConnectionFactory redisConnectionFactory() throws Exception {
        String redisUrl = System.getenv("REDIS_URL");
        URI uri = new URI(redisUrl);

        RedisStandaloneConfiguration redisConfig = new RedisStandaloneConfiguration();
        redisConfig.setHostName(uri.getHost());
        redisConfig.setPort(uri.getPort());
        if (uri.getUserInfo() != null) {
            String[] userInfo = uri.getUserInfo().split(":", 2);
            if (userInfo.length > 1 && !userInfo[1].isEmpty()) {
                redisConfig.setPassword(userInfo[1]);
            }
        }

        SslOptions sslOptions = SslOptions.builder().build();
        ClientOptions clientOptions = ClientOptions.builder().sslOptions(sslOptions).build();

        LettuceClientConfiguration clientConfig = LettuceClientConfiguration.builder()
                .useSsl()
                .disablePeerVerification()
                .and()
                .clientOptions(clientOptions)
                .commandTimeout(Duration.ofSeconds(5))
                .build();

        return new LettuceConnectionFactory(redisConfig, clientConfig);
    }
}
