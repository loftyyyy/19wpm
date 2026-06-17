package com.rho.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;


@Configuration
@Profile("prod")
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(System.getenv("JDBC_DATABASE_URL"));
        config.setUsername(System.getenv("JDBC_DATABASE_USERNAME"));
        config.setPassword(System.getenv("JDBC_DATABASE_PASSWORD"));
        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(8);
        config.setMinimumIdle(2);
        return new HikariDataSource(config);
    }
}
