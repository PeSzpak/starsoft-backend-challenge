# Cinema Ticket API - NestJS

API para reserva e venda de ingressos de cinema com foco em controle de concorrência e consistência de dados.

Objetivos da implementação:
- evitar venda dupla do mesmo assento;
- expirar reservas em 30 segundos quando não confirmadas;
- processar expiração de forma assíncrona;
- garantir publicação confiável de eventos.

## Stack
- NestJS
- PostgreSQL
- Redis
- RabbitMQ
- TypeORM
- Swagger/OpenAPI

## Arquitetura e Decisões
- `PostgreSQL` para persistência transacional e integridade relacional.
- `Redis` para lock distribuído por assento no fluxo de reserva.
- `RabbitMQ` para mensageria de expiração e eventos de domínio.
- `Outbox Pattern` para consistência entre commit no banco e publish no broker.
- `AuthGuard` global com API key para autenticação.
- `RolesGuard` global para autorização por perfil (`ADMIN` e `USER`).
- `priceCents` em vez de float para valores monetários.
- `FOR UPDATE SKIP LOCKED` no publisher do outbox para coordenação entre múltiplas instâncias.

## Como Executar
### Pré-requisitos
- Node.js 20+
- npm
- Docker + Docker Compose

### 1) Configurar ambiente
```bash
cp .env.example .env
```

### 2) Subir aplicação + infraestrutura com Docker
```bash
docker compose up -d --build
```

API:
- `http://localhost:3001`

Swagger:
- `http://localhost:3001/api-docs`

RabbitMQ Management:
- `http://localhost:15672` (user: `cinema`, pass: `cinema`)

### 3) Rodar localmente (opcional)
Se preferir rodar a API fora do container:
```bash
npm install
npm run start:dev
```
Mantenha Postgres, Redis e RabbitMQ ativos no Docker.

## Autenticação e Autorização
Modelo adotado:
- Header `x-api-key` (ou `Authorization: Bearer <api-key>`).
- Perfis:
- `ADMIN`: gerencia sessões e endpoints admin do outbox.
- `USER`: faz reserva, confirma pagamento e consulta próprio histórico.

Variáveis de ambiente:
- `AUTH_ENABLED=true`
- `AUTH_ADMIN_API_KEY=admin-secret`
- `AUTH_USER_API_KEY=user-secret`
- `AUTH_ADMIN_USER_ID=admin-1`
- `AUTH_DEFAULT_USER_ID=user-1`

Regras de autorização:
- Sessões:
- `POST/PATCH/DELETE /sessions` -> `ADMIN`
- `GET /sessions*` -> `USER` ou `ADMIN`
- Reservas:
- `POST /reservations` -> `USER`/`ADMIN` (usuário comum só pode reservar para o próprio `userId`)
- `POST /reservations/:id/confirm-payment` -> `USER`/`ADMIN`
- `GET /reservations/users/:userId/purchases` -> `USER`/`ADMIN` (usuário comum só acessa o próprio histórico)
- Outbox:
- `/admin/outbox/*` -> `ADMIN`
- Públicos:
- `GET /` e `GET /health`

## Endpoints
### Aplicação
- `GET /`
- `GET /health`

### Sessions
- `POST /sessions`
- `GET /sessions`
- `GET /sessions/:id`
- `GET /sessions/:id/availability`
- `PATCH /sessions/:id`
- `DELETE /sessions/:id`

### Reservations
- `POST /reservations`
- `POST /reservations/:id/confirm-payment`
- `GET /reservations/users/:userId/purchases`

### Outbox Admin
- `GET /admin/outbox/metrics`
- `POST /admin/outbox/retry-failed`

## Eventos de Domínio
- `reservation.created`
- `reservation.expire`
- `reservation.expired`
- `seat.released`
- `payment.confirmed`

## Testes
### Teste de concorrência
```bash
API_URL=http://localhost:3001 npm run test:concurrency
```
Esperado: apenas 1 requisição reserva o assento com sucesso; as demais retornam `409`.

### Postman
Arquivos prontos para importação:
- `postman/Cinema-Ticket-API.postman_collection.json`
- `postman/Cinema-Ticket-API.local.postman_environment.json`

A collection já envia `x-api-key` automaticamente:
- endpoints de usuário usam `{{userApiKey}}`
- endpoints administrativos usam `{{adminApiKey}}`

## Requisitos Obrigatórios
- `NestJS` + `Docker` + `PostgreSQL` + `Redis` + `RabbitMQ`.
- Reserva de assentos com expiração de 30 segundos.
- Proteção contra concorrência na reserva.
- Fluxo principal de sessão, reserva e confirmação de pagamento.
- API documentada via Swagger.

## Requisitos Opcionais
- Histórico de compras por usuário (`GET /reservations/users/:userId/purchases`).
- Endpoints administrativos do outbox para métricas e reprocessamento.

## Pontos Extras
- Outbox Pattern com polling e retry.
- Correlation ID propagado de HTTP para mensageria.
- Script de teste de concorrência para validação prática.

## Limitações Atuais
- Sem suíte completa de testes unitários e integração.
- Sem CDC (ex.: Debezium) para o outbox (atualmente polling).
- Sem dashboard dedicado de observabilidade do outbox.

## Motivo das Limitações Restantes
- Testes unitários/integração completos:
- foco do desafio foi provar o fluxo crítico de concorrência e consistência distribuída; foi priorizado teste funcional (Postman + script de concorrência) para validar comportamento fim a fim.
- CDC para outbox:
- exige infraestrutura adicional (Kafka + Connect + Debezium) e operação mais complexa; polling foi escolhido por simplicidade e menor custo operacional para o escopo do desafio.
- Dashboard de observabilidade:
- foi entregue endpoint de métricas (`/admin/outbox/metrics`) como base; dashboard/alertas exigem stack extra (Prometheus/Grafana/ELK), fora do escopo principal de implementação.

## Melhorias Futuras
- JWT + RBAC.
- Migrations versionadas para produção.
- Idempotency keys no `confirm-payment`.
- Monitoramento e alertas para saúde do outbox.
