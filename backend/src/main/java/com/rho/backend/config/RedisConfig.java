package com.rho.backend.config;

import io.lettuce.core.ClientOptions;
import io.lettuce.core.SocketOptions;
import io.lettuce.core.api.StatefulConnection;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration.LettucePoolingClientConfigurationBuilder;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
public class RedisConfig {

    @Value("${spring.data.redis.host:localhost}")
    private String host;
    @Value("${spring.data.redis.port:6379}")
    private int port;
    @Value("${spring.data.redis.password:}")
    private String password;
    @Value("${spring.data.redis.timeout:2s}")
    private Duration commandTimeout;
    @Value("${spring.data.redis.connect-timeout:2s}")
    private Duration connectTimeout;
    @Value("${spring.data.redis.lettuce.pool.max-active:8}")
    private int poolMaxActive;
    @Value("${spring.data.redis.lettuce.pool.max-idle:8}")
    private int poolMaxIdle;
    @Value("${spring.data.redis.lettuce.pool.min-idle:1}")
    private int poolMinIdle;
    @Value("${spring.data.redis.lettuce.pool.max-wait:2s}")
    private Duration poolMaxWait;

    @Bean
    @Profile("!prod")
    public RedisConnectionFactory redisConnectionFactory() {
        return createConnectionFactory(false);
    }

    @Bean
    @Primary
    @Profile("prod")
    public RedisConnectionFactory prodRedisConnectionFactory() {
        return createConnectionFactory(true);
    }

    private RedisConnectionFactory createConnectionFactory(boolean ssl) {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(host, port);
        if (!password.isBlank()) {
            config.setPassword(password);
        }

        LettucePoolingClientConfigurationBuilder clientConfig = LettucePoolingClientConfiguration.builder();
        if (ssl) {
            clientConfig = clientConfig.useSsl().and();
        }

        GenericObjectPoolConfig<StatefulConnection<?, ?>> poolConfig = new GenericObjectPoolConfig<>();
        poolConfig.setMaxTotal(poolMaxActive);
        poolConfig.setMaxIdle(poolMaxIdle);
        poolConfig.setMinIdle(poolMinIdle);
        poolConfig.setMaxWait(poolMaxWait);

        clientConfig
                .commandTimeout(commandTimeout)
                .poolConfig(poolConfig)
                .clientOptions(ClientOptions.builder()
                        .socketOptions(SocketOptions.builder()
                                .connectTimeout(connectTimeout)
                                .keepAlive(true)
                                .build())
                        .build());

        return new LettuceConnectionFactory(config, clientConfig.build());
    }

    /**
     * String-to-String template - all our keys and values are plain strings.
     * Using StringRedisSerializer on both sides keeps Redis inspection human-readable:
     *   redis-cli> GET "blocklist:access:eyJhbGci..."  ->  "1"
     * Avoid GenericJackson2JsonRedisSerializer here - it adds type metadata
     * we don't need for simple token/counter storage.
     */
    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(RedisConnectionFactory factory) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        return container;
    }
}
