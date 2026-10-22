package com.rho.backend.config;

import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class RepositoryObservationAspect {

    private final ObservationRegistry observationRegistry;

    public RepositoryObservationAspect(ObservationRegistry observationRegistry) {
        this.observationRegistry = observationRegistry;
    }

    @Around("execution(* com.rho.backend.repository..*(..))")
    public Object observeRepositoryCall(ProceedingJoinPoint joinPoint) throws Throwable {
        String repository = joinPoint.getSignature().getDeclaringType().getSimpleName()
                .replace("Repository", "");
        String operation = joinPoint.getSignature().getName();

        Observation observation = Observation.createNotStarted("db.repository", observationRegistry)
                .contextualName(repository + "." + operation)
                .lowCardinalityKeyValue("repository", repository)
                .lowCardinalityKeyValue("operation", operation)
                .start();

        try (Observation.Scope ignored = observation.openScope()) {
            return joinPoint.proceed();
        } catch (Throwable throwable) {
            observation.error(throwable);
            throw throwable;
        } finally {
            observation.stop();
        }
    }
}
