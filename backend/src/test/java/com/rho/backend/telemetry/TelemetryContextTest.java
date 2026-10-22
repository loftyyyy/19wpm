package com.rho.backend.telemetry;

import com.rho.backend.service.TextService;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationHandler;
import io.micrometer.observation.ObservationRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class TelemetryContextTest {

    @Autowired
    private TextService textService;

    @Autowired
    private ObservationRegistry observationRegistry;

    @Test
    void recordsServiceAndRepositoryObservations() {
        List<String> stoppedObservations = new CopyOnWriteArrayList<>();
        observationRegistry.observationConfig().observationHandler(new ObservationHandler<Observation.Context>() {
            @Override
            public boolean supportsContext(Observation.Context context) {
                return true;
            }

            @Override
            public void onStop(Observation.Context context) {
                stoppedObservations.add(context.getName());
            }
        });

        textService.getPresetTexts();

        assertThat(stoppedObservations).contains("texts.preset", "db.repository");
    }
}
