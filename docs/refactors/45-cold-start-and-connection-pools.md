# CR-9.1 - Bound cold-start connection setup and pin the deployment to one replica

**Area:** Production deployment (`deploy/container-app.yaml`), HikariCP, Lettuce Redis client
**Architecture pattern:** Bounded resource pools with fail-fast timeouts; explicit capacity constraint
**Status:** Done

## Bottleneck / anti-pattern (before)

The backend had useful pool limits on paper, but the first request after a cold start could still
wait on slow downstream negotiation:

- Hikari's `connection-timeout` was 30 seconds, so a cold PostgreSQL endpoint could hold a request
  for most of a browser timeout before failing.
- Redis used `LettuceConnectionFactory` without pooling. Every command created new connection setup
  work, and there was no pool cap or wait bound.
- No deployment manifest existed. Nothing prevented scale-to-zero, which turns every idle period into
  a full JVM start plus Flyway validation, Hibernate startup, and first-connection setup.

A cold start is acceptable once; a request-triggered cold start is not. The deployment also cannot
scale horizontally yet: live race rooms are process-local and STOMP uses a simple broker.

## Solution / enhancement (after)

### Connection pools and fail-fast timeouts

The production profile (`application-prod.properties`) now uses environment-tunable startup and
health bounds. The local `application.properties` is intentionally untracked and mirrors the same
defaults, but it is not part of the committed configuration:

| Setting | Value | Environment variable |
|---|---|---|
| `connection-timeout` | 5 s | `DB_CONNECTION_TIMEOUT_MS` |
| `validation-timeout` | 2 s | `DB_VALIDATION_TIMEOUT_MS` |
| `keepalive-time` | 120 s | `DB_KEEPALIVE_MS` |
| `maximum-pool-size` | 10 | `DB_POOL_MAX` |
| `minimum-idle` | 2 | `DB_POOL_MIN` |
| `max-lifetime` | 30 min | fixed |

Redis now uses `LettucePoolingClientConfiguration` with command and socket timeouts:

| Setting | Value | Property / environment variable |
|---|---|---|
| command timeout | 2 s | `spring.data.redis.timeout` |
| connect timeout | 2 s | `spring.data.redis.connect-timeout` |
| pool max active | 8 | `REDIS_POOL_MAX` |
| pool max idle | 8 | `REDIS_POOL_MAX_IDLE` |
| pool min idle | 1 | `REDIS_POOL_MIN_IDLE` |
| pool max wait | 2 s | fixed |

The production profile keeps TLS enabled through `.useSsl()` on the pooling client builder. The
non-production profile still connects to a plain local Redis.

### Deployment manifest

`deploy/container-app.yaml` is an Azure Container Apps template with placeholders for environment
specific values. It sets:

- `minReplicas: 1` so an idle app never scale-to-zero and pay a JVM cold start on the next request.
- `maxReplicas: 1` because race-room state and STOMP subscriptions are instance-local.
- External HTTPS ingress on port 8080, 1 CPU, and 2 GiB of memory.
- Secret references for the database password, Redis password, JWT secret, and OAuth client secrets.

`deploy/render.ps1` substitutes `${NAME}` placeholders from the current environment and fails if a
required value is missing. The rendered file is ignored by Git so secrets are not committed.

## Deployment

1. Build and push the backend image, then set `BACKEND_IMAGE` to the full registry reference.
2. Export the placeholders used by the template. Connection and OAuth names match
   `backend/.env` (`SPRING_DATASOURCE_*`, `SPRING_DATA_REDIS_*`, `GITHUB_*`, `GOOGLE_*`,
   `JWT_SECRET`, `FRONTEND_URL`); the Azure-specific names are `AZURE_LOCATION`, `APP_NAME`,
   `AZURE_CONTAINERAPPS_ENVIRONMENT_ID`, `AZURE_RESOURCE_GROUP`, and `BACKEND_IMAGE`.
3. Render the template:

   ```powershell
   .\deploy\render.ps1
   ```

4. Create the container app on the first deployment:

   ```powershell
   az containerapp create `
     --name $env:APP_NAME `
     --resource-group $env:AZURE_RESOURCE_GROUP `
     --yaml deploy/container-app.rendered.yaml
   ```

   Use `az containerapp update` with the same arguments for later deployments.

5. Confirm the scale bounds and revision state:

   ```powershell
   az containerapp show `
     --name $env:APP_NAME `
     --resource-group $env:AZURE_RESOURCE_GROUP `
     --query "properties.template.scale"
   ```

## Impact

- A cold start no longer waits 30 seconds for PostgreSQL; unhealthy dependencies fail in seconds.
- Redis commands reuse pooled connections and cannot accumulate unbounded connection attempts.
- The deployment encodes the single-replica constraint that the race-room audit already documented.
- Compile verification: `.\mvnw.cmd -q -DskipTests compile` (green).
- Context smoke: `BackendApplicationTests` passed with `SPRING_PROFILES_ACTIVE=test` and dummy
  JWT/OAuth environment values. This exercises construction of the pooled Redis client but does not
  open a Redis connection.

## Limitations

- The timeout and pool values are reasoned bounds, not load-test results. Local backend, Redis, and
  PostgreSQL services were unavailable when this change was made, so the k6 baseline was not rerun.
- `maxReplicas: 1` is intentional. Raising it requires Redis-backed room state, cross-instance STOMP
  fan-out, a distributed countdown transition, and distributed matchmaking coordination.
- The manifest is a template, not a complete Azure provisioning stack. The Container Apps
  environment, registry credentials, database, Redis instance, and DNS are provisioned separately.

## Rollback

Revert this commit to restore the previous timeouts and remove the deployment template. Resetting
`minReplicas` to 0 alone reintroduces request-triggered cold starts.
