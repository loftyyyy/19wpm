package com.rho.backend.telemetry;

import com.rho.backend.service.TextService;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationHandler;
import io.micrometer.observation.ObservationRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class TelemetryContextTest {

    @Autowired
    private TextService textService;

    @Autowired
    private ObservationRegistry observationRegistry;

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
    }

    @Test
    void acceptsPublicWebVitalsBeacon() throws Exception {
        mockMvc.perform(post("/api/v1/telemetry/web-vitals")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "LCP",
                                  "value": 1234.5,
                                  "rating": "good",
                                  "navigationType": "navigate",
                                  "path": "/solo"
                                }
                                """))
                .andExpect(status().isAccepted());
    }

    @Test
    void rejectsUnsupportedWebVital() throws Exception {
        mockMvc.perform(post("/api/v1/telemetry/web-vitals")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "unknown",
                                  "value": 1,
                                  "rating": "good",
                                  "navigationType": "navigate",
                                  "path": "/"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

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
