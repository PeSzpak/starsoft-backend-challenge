# Cinema Ticket API - NestJS

## 1. Visao Geral
API para venda/reserva de ingressos de cinema com foco em concorrencia e consistencia.

Objetivos principais desta implementacao:
- evitar venda dupla de assento;
- reservar assentos por 30 segundos;
- expirar reserva de forma assincrona;
- publicar eventos de dominio de forma confiavel.

## 2. Tecnologias e Motivacao
- NestJS: estrutura modular com DI e separacao clara de camadas.
- PostgreSQL: persistencia transacional e integridade relacional.
- Redis: lock distribuido por assento para reduzir race condition entre instancias.
- RabbitMQ: processamento assincrono de expiracao e eventos de negocio.
- Outbox Pattern (PostgreSQL + worker): publicacao de eventos confiavel apos commit.

## 3. Como Executar
### 3.1 Pre-requisitos
- Node.js 20+
- Docker e Docker Compose
- npm

### 3.2 Subir aplicacao + infraestrutura
```bash
docker compose up -d
```

### 3.3 Configurar ambiente
```bash
cp .env.example .env
```

Sugestao para evitar conflito local de porta:
```env
PORT=3001
DB_PORT=5433
```

### 3.4 Instalar dependencias
```bash
npm install
```

### 3.5 Checar saude
```bash
curl http://localhost:3001/health
```

### 3.6 Swagger
- URL: `http://localhost:3001/api-docs`

## 4. Fluxo de Teste Rapido
### 4.1 Criar sessao
```bash
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "movieTitle":"Filme X",
    "roomName":"Sala 1",
    "startsAt":"2026-02-11T22:00:00Z",
    "priceCents":2500,
    "totalSeats":16
  }'
```

### 4.2 Ver disponibilidade
```bash
curl http://localhost:3001/sessions/1/availability
```

### 4.3 Criar reserva (30s)
```bash
curl -X POST http://localhost:3001/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":1,
    "userId":"user-1",
    "seatNumbers":["A1"]
  }'
```

### 4.4 Confirmar pagamento
```bash
curl -X POST http://localhost:3001/reservations/<reservation-id>/confirm-payment
```

### 4.5 Teste de concorrencia
```bash
API_URL=http://localhost:3001 npm run test:concurrency
```

Esperado: sucesso unico para o mesmo assento e demais requisicoes com `409`.

## 5. Estrategias Implementadas
### 5.1 Race condition
- lock distribuido no Redis por assento: `lock:session:{sessionId}:seat:{seatNumber}`;
- aquisicao ordenada de locks para reduzir risco de deadlock;
- transacao no banco para reserva/links/atualizacao de status.

### 5.2 Coordenacao entre multiplas instancias
- Redis lock no caminho critico de reserva;
- outbox publisher com claim de lote usando `FOR UPDATE SKIP LOCKED`.

### 5.3 Expiracao assincrona da reserva
- evento `reservation.created` com payload incluindo `expiresAt`;
- fila delay com TTL de 30s + dead-letter para fila de processamento;
- consumidor marca reserva como `EXPIRED` e libera assentos se ainda estiver `PENDING`.

### 5.4 Publicacao confiavel de eventos
- outbox persistido na mesma transacao do dominio;
- worker publica para RabbitMQ com retry/backoff;
- endpoints admin para metricas/reprocessamento de falhas.

## 6. Endpoints da API
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

### Health
- `GET /health`

### Outbox Admin
- `GET /admin/outbox/metrics`
- `POST /admin/outbox/retry-failed`

### Purchase History
- `GET /reservations/users/:userId/purchases`

## 7. Eventos Publicados
- `reservation.created`
- `reservation.expire` (routing key de processamento da expiracao)
- `reservation.expired`
- `seat.released`
- `payment.confirmed`

## 8. Decisoes Tecnicas
- `synchronize=true` apenas para desenvolvimento local.
- `priceCents` para evitar erro de ponto flutuante em valores monetarios.
- status de assento (`AVAILABLE`, `RESERVED`, `SOLD`) para leitura rapida de disponibilidade.
- `correlationId` propagado de HTTP -> outbox -> RabbitMQ -> consumidor.

## 9. Limitações Conhecidas
- sem autenticacao/autorizacao.
- sem testes automatizados de unidade/integracao completos.
- sem Swagger/OpenAPI.
- sem classificacao mais refinada de erro transitivo vs permanente no outbox.
- sem historico de compras por usuario via endpoint dedicado.

## 10. Melhorias Futuras
- autenticação JWT + autorizacao por papel.
- suite de testes (unitarios, integracao e carga concorrente).
- outbox com DLQ logica e politicas por tipo de evento.
- dashboard de observabilidade (lag do outbox, failed count, oldest pending age).
- endpoint de historico de compras por usuario.
- idempotency keys para requests de pagamento.

## 11. Commits
Historico organizado em blocos funcionais:
- setup da aplicacao e docker
- modelagem de dados
- CRUD de sessoes
- reserva/pagamento/disponibilidade
- lock distribuido
- mensageria e expiracao assincrona
- outbox confiavel
- observabilidade e admin do outbox
