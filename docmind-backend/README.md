# DocMind Backend — Project Guide and Engineering Notes

DocMind is a Spring Boot document question-answering backend built around
retrieval-augmented generation (RAG). It accepts documents, extracts text,
splits that text into smaller chunks, creates vector embeddings, and stores
those vectors in PostgreSQL with pgvector. A user can then ask a question or
search for semantically similar passages. The backend retrieves relevant
chunks and supplies their text as context to a Gemini chat model.

This guide describes the backend as it is currently implemented. It is intended
as a study guide and as a reference for explaining the project in a technical
interview.

## Contents

1. [What the project does](#what-the-project-does)
2. [Technology stack](#technology-stack)
3. [Architecture and source layout](#architecture-and-source-layout)
4. [Document ingestion: upload to vector store](#document-ingestion-upload-to-vector-store)
5. [Question answering: query to grounded answer](#question-answering-query-to-grounded-answer)
6. [Semantic vector search](#semantic-vector-search)
7. [Data model and API response shapes](#data-model-and-api-response-shapes)
8. [REST API reference](#rest-api-reference)
9. [Run the backend locally](#run-the-backend-locally)
10. [Configuration explained](#configuration-explained)
11. [Errors, transactions, and operational behavior](#errors-transactions-and-operational-behavior)
12. [Security and production readiness](#security-and-production-readiness)
13. [Known implementation gaps to understand](#known-implementation-gaps-to-understand)
14. [How to explain this project in an interview](#how-to-explain-this-project-in-an-interview)
15. [A practical code-reading path](#a-practical-code-reading-path)

## What the project does

At a high level, the backend provides two connected capabilities:

- **Index documents:** receive files, parse their contents into Spring AI
  `Document` objects, split the text into chunks, enrich each chunk with
  metadata, and pass the chunks to a Spring AI `VectorStore`.
- **Use indexed knowledge:** embed a user's question, retrieve the most
  relevant chunks from pgvector, and either return those chunks as search
  results or send their text to a chat model as grounding context.

The two storage systems have different responsibilities:

| Store | What it stores | Main code |
| --- | --- | --- |
| PostgreSQL JPA table `document_metadata` | Document identity, filename, content type, file size, page/chunk counts, status, and timestamps | `DocumentMetadata`, `DocumentMetadataRepo` |
| PostgreSQL pgvector table `vector_store` | Chunk content, its metadata, and its numeric embedding vector | Spring AI `VectorStore`, configured in `application-dev.yml` |

The backend does **not** store the original uploaded file in a file-storage
service. It processes the multipart bytes and persists metadata plus extracted
chunk content/vectors.

## Technology stack

The versions and dependencies below are taken from the backend's `pom.xml`:

- Java 21
- Spring Boot 4.1.0
- Spring AI 2.0.1
- Spring Web MVC for REST endpoints
- Spring Data JPA and Hibernate for document metadata
- PostgreSQL JDBC driver
- PostgreSQL 16 with the pgvector extension
- Spring AI Google GenAI chat and embedding integrations
- Spring AI `VectorStore` / pgvector integration
- Spring AI PDF and Tika document readers
- Jakarta Bean Validation
- Springdoc OpenAPI / Swagger UI
- Lombok and ModelMapper
- Reactor `Flux` for token-stream responses

Spring AI is the abstraction layer connecting the application to model and
vector-store implementations. The business services use concepts such as
`ChatClient`, `Document`, `TokenTextSplitter`, `VectorStore`, and
`SearchRequest`, rather than manually creating embedding arrays or writing
the vector similarity SQL for normal retrieval.

## Architecture and source layout

```text
src/main/java/com/pm/docmindbackend/
├── DocmindBackendApplication.java
├── config/
│   ├── AppProperties.java
│   ├── CorsConfig.java
│   └── ProjectConfig.java
├── controller/
│   ├── ChatController.java
│   └── DocumentController.java
├── dto/
│   ├── ApiResponse.java
│   ├── ChatRequestDto.java
│   ├── ChatResponseDto.java
│   ├── CitationDto.java
│   ├── DocumentMetadataDto.java
│   ├── DocumentResponseDto.java
│   ├── SearchRequestDto.java
│   └── SearchResultDto.java
├── entity/
│   ├── DocumentMetadata.java
│   └── DocumentStatus.java
├── exception/
│   ├── DocumentProcessingException.java
│   ├── GlobalExceptionHandler.java
│   └── ResourceNotFoundException.java
├── repository/
│   └── DocumentMetadataRepo.java
└── service/
    ├── DocumentIngestionService.java
    ├── DocumentMetadataService.java
    ├── DocumentParserService.java
    └── RagService.java

src/main/resources/
├── application.properties
└── application-dev.yml

src/test/java/com/pm/docmindbackend/
└── DocmindBackendApplicationTests.java

docker-compose.yaml
init.sql
pom.xml
```

### Responsibility by layer

- **Controller:** HTTP mapping, request binding, validation entry point, and
  HTTP status / response-envelope construction.
- **DTO:** API input/output data shapes. These are not the JPA entity.
- **Service:** document parsing, ingestion, metadata management, retrieval,
  chat prompt assembly, and citation conversion.
- **Repository:** Spring Data JPA access to document metadata.
- **Entity:** persistent metadata model and document status enum.
- **Config:** Spring AI `ChatClient`, OpenAPI, ModelMapper, application
  properties, and CORS behavior.
- **Exception advice:** maps selected exceptions to consistent API error bodies.

The application starts from `DocmindBackendApplication`, which delegates
configuration and bean startup to `SpringApplication.run(...)`.

## Document ingestion: upload to vector store

The upload process is synchronous: the HTTP upload call remains open while the
file is parsed, split, embedded, and written to the vector store.

```text
POST multipart file
  → DocumentController
  → DocumentMetadataService
  → save metadata with UPLOADING status
  → DocumentParserService
  → Spring AI Document list (parsed pages/sections)
  → DocumentIngestionService
  → TokenTextSplitter
  → enrich each chunk with document metadata
  → VectorStore.add(chunks)
  → Gemini embedding model + pgvector storage
  → save INDEXED status, page count, and chunk count
  → return upload response
```

### Detailed steps

1. `DocumentController` binds either a single multipart field named `file` or
   multiple multipart fields named `files`.
2. `DocumentMetadataService.uploadAndProcess` creates and saves
   `DocumentMetadata` with `UPLOADING`, filename, content type, byte size, and
   creation time. This saved row supplies the UUID used to associate vector
   chunks with their source document.
3. `DocumentParserService.parse` copies the multipart bytes into a Spring
   `Resource`, preserving the original filename.
4. The parser chooses a reader based on filename/content type. The exact
   dispatch is described in [known implementation gaps](#known-implementation-gaps-to-understand).
5. The parser returns a list of Spring AI `Document` objects. The ingestion
   service treats the number of parsed objects as `totalPages`.
6. `DocumentIngestionService` sets the status to `PROCESSING` and applies
   Spring AI's `TokenTextSplitter`.
7. Each chunk receives metadata including:
   - `documentId`: the UUID from `document_metadata`
   - `fileName`
   - `contentType`
   - `chunkIndex`: zero-based index within this document's split output
   - `pageNumber`, when found as `page_number` or `pageNumber` on the parsed
     source document
   - any metadata already carried by the parsed chunk
8. The enriched chunks are passed to `VectorStore.add`. The pgvector integration
   obtains embeddings from the configured Gemini embedding model and writes
   the content, metadata, and vector to `vector_store`.
9. On success, metadata is saved with `INDEXED`, `totalChunks`, and cleared
   `errorMessage`.
10. The controller returns HTTP `201 Created` with a `DocumentResponseDto`.

### Chunking configuration

The active development profile sets `app.rag.chunk-size` to `700`. Other
`AppProperties.RagProperties` defaults include minimum chunk size characters
`350`, minimum chunk length to embed `5`, maximum chunks `10000`, default
retrieval `topK` `5`, and similarity threshold `0.0`. The YAML overrides
`top-k` to `5` and threshold to `0.0`; chunk overlap is commented out and is
not currently configured.

`TokenTextSplitter` is a token-aware text splitter, not a fixed character
substring operation. It produces passages small enough to embed and retrieve
independently. The implementation assigns chunk indexes after splitting; those
indexes identify this ingestion run's chunk order, not a stable page/section
identifier.

### What an embedding means here

An embedding is a numerical representation of text. Texts with related meaning
are expected to be nearby under the vector store's configured distance
function, even if they do not share the same exact words. During ingestion,
each chunk gets an embedding. During retrieval, a question/query gets embedded
in the same vector space, then compared against stored vectors.

The configured vector length is **1536 dimensions**, matching the YAML's
Gemini embedding setting. The embedding model, configured dimensions, and
already-created database vector column must agree. A mismatch (for example, a
model returning a different number of dimensions) prevents vector insertion
or querying.

## Question answering: query to grounded answer

The application performs explicit retrieval in `RagService` before asking the
chat model. It does not use a Spring AI vector-store advisor for this flow; the
advisor dependency is commented out in `pom.xml`.

```text
POST /api/v1/chat/query or /api/v1/chat/stream
  → validate ChatRequestDto.question
  → RagService.retrieveRelevantDocuments(question, optional documentId, topK, threshold)
  → pgvector similarity search
  → convert retrieved chunk metadata/text into citation/context
  → ChatClient with system instructions + {doc_context}
  → Gemini generates answer
  → JSON response or streamed token response
```

The shared `ChatClient` in `ProjectConfig` has a default system instruction:
DocMind should answer helpfully, use supplied document context when relevant,
and write structured Markdown. `MessageChatMemoryAdvisor` is also configured
with the injected Spring AI `ChatMemory` bean.

### Retrieval and grounding details

- `topK` limits the number of chunks retrieved. A missing or non-positive
  value falls back to `app.rag.top-k`.
- `documentId` is optional. When present, the search filters vector metadata
  by `documentId`, so results are restricted to that document.
- A positive similarity threshold is passed to Spring AI's search request.
  When the threshold is zero or negative, the code does not set a threshold.
- Retrieved chunks are combined into context entries in the form
  `[Source: fileName | Page: pageNumber]` followed by chunk text.
- The `ChatClient` system prompt includes this context via the `doc_context`
  template parameter. The user's question is sent as the user message.
- The response citations are created from the *retrieved chunks*, independently
  of the LLM's generated text.

This is retrieval-augmented generation: the language model generates natural
language, while retrieval supplies project-specific evidence at request time.
The model's answer is not guaranteed to be correct just because the context
was retrieved. Applications should still show citations and make it clear what
the sources support.

### Chat-memory behavior

The chat client has `MessageChatMemoryAdvisor`, and API requests can include
`conversationId`. Use the same conversation ID on successive calls if you want
the memory advisor to associate them with one conversation. No custom chat
memory repository or conversation database is defined in this project; the
actual memory bean/storage behavior comes from Spring AI auto-configuration
and the active dependencies.

The streaming method creates an ID when the request has none and sets it on the
DTO before it invokes the advisor. The non-streaming method currently does not
create the ID until it builds the response; it passes the request's original
ID (which may be null) to the advisor. For predictable multi-turn behavior,
clients should supply a stable conversation ID.

## Semantic vector search

`POST /api/v1/chat/search/similarity` uses the same retrieval method as chat,
but returns matching chunks rather than asking Gemini to synthesize an answer.
Each match can include the source filename, document UUID, chunk index, page
number, original snippet, similarity score, and metadata.

The retrieval method uses `VectorStore.similaritySearch(SearchRequest)`.
Spring AI handles query embedding and delegates nearest-neighbor retrieval to
the configured pgvector store. The development configuration specifies
cosine distance and an HNSW index.

The code converts pgvector/Spring AI metadata `distance` to a displayed
`similarityScore` using `1 - distance`. Interpret this as an application-level
score derived from the returned distance, not as a calibrated probability.

## Data model and API response shapes

### `DocumentMetadata`

JPA entity stored in `document_metadata`:

| Field | Meaning |
| --- | --- |
| `id` | Generated UUID |
| `filename` | Original uploaded filename |
| `contentType` | Multipart content type, or fallback value |
| `fileSize` | Uploaded size in bytes |
| `totalPages` | Number of parsed Spring AI documents (treated as pages) |
| `totalChunks` | Number of indexed chunks |
| `status` | `UPLOADING`, `PROCESSING`, `INDEXED`, or `FAILED` |
| `errorMessage` | Processing failure detail, up to 1000 characters |
| `createdAt` | Creation time |
| `updatedAt` | Present in the entity/DTO; update assignment is not visible in the current service flow |

`DocumentMetadataRepo` is a `JpaRepository<DocumentMetadata, UUID>` with
methods to list newest-first and filter by status. User ownership relations
are commented out; document records are currently global to the application.

### DTOs

- `ChatRequestDto`: `question` (required/non-blank), optional `documentId`,
  `topK`, `minSimilarity`, and `conversationId`.
- `ChatResponseDto`: `answer`, `conversationId`, `citations`, and
  `responseTimeMs`.
- `SearchRequestDto`: `query` (required/non-blank), optional `documentId`,
  `topK`, and `similaritySearch`.
- `SearchResultDto`: original/effective `query`, `totalMatches`, and `matches`.
- `CitationDto`: source document ID/name, chunk index, page, text snippet,
  similarity score, and metadata.
- `DocumentMetadataDto`: persisted document details for list/detail endpoints.
- `DocumentResponseDto`: upload result with file identity, size, status,
  chunks created, and a message.
- `ApiResponse<T>`: common envelope containing `success`, `message`, `data`,
  and `timestamp`.

Typical JSON response envelope:

```json
{
  "success": true,
  "message": "All documents is here",
  "data": [],
  "timestamp": "2026-10-12T10:00:00"
}
```

## REST API reference

The application listens on port `8081` by default.

### Documents

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| `POST` | `/api/v1/documents/upload` | Multipart field `file` | `201`, one `DocumentResponseDto` in `data` |
| `POST` | `/api/v1/documents/upload-multiple` | Multipart field `files` (repeat per file) | `201`, list of `DocumentResponseDto` objects in `data` |
| `GET` | `/api/v1/documents` | None | `200`, newest-first list of `DocumentMetadataDto` |
| `GET` | `/api/v1/documents/{id}` | UUID path variable | `200`, one `DocumentMetadataDto` |
| `DELETE` | `/api/v1/documents/{id}` | UUID path variable | `200`, envelope with null `data` |

Single upload:

```bash
curl -X POST http://localhost:8081/api/v1/documents/upload \
  -F "file=@./sample.pdf"
```

Multiple upload:

```bash
curl -X POST http://localhost:8081/api/v1/documents/upload-multiple \
  -F "files=@./first.pdf" \
  -F "files=@./second.pdf"
```

List documents:

```bash
curl http://localhost:8081/api/v1/documents
```

Get or delete a document:

```bash
curl http://localhost:8081/api/v1/documents/<DOCUMENT_UUID>

curl -X DELETE http://localhost:8081/api/v1/documents/<DOCUMENT_UUID>
```

### Chat

`POST /api/v1/chat/query` takes a JSON `ChatRequestDto` and responds with an
`ApiResponse<ChatResponseDto>`.

`POST /api/v1/chat/stream` takes the same JSON body and produces
`text/event-stream`. The service appends the `[DONE]` sentinel after the model
stream. Use an SSE-capable client that can POST a JSON body; the browser's
native `EventSource` API only supports GET and is not sufficient by itself for
this endpoint.

Example request:

```bash
curl -X POST http://localhost:8081/api/v1/chat/query \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "Summarize the main ideas in the Java guide",
    "documentId": null,
    "topK": 5,
    "minSimilarity": 0,
    "conversationId": "demo-conversation-001"
  }'
```

To scope to one document, set `"documentId"` to its UUID. `conversationId`
should remain the same across messages that belong to one conversation.

### Similarity search

`POST /api/v1/chat/search/similarity` accepts:

```json
{
  "query": "What are the rules for overriding equals and hashCode?",
  "documentId": null,
  "topK": 5,
  "similaritySearch": 0
}
```

Example:

```bash
curl -X POST http://localhost:8081/api/v1/chat/search/similarity \
  -H 'Content-Type: application/json' \
  -d '{"query":"database transaction isolation","documentId":null,"topK":5,"similaritySearch":0}'
```

### Swagger / OpenAPI

When the application is running, Springdoc normally serves Swagger UI at:

```text
http://localhost:8081/swagger-ui/index.html
```

The `ProjectConfig` OpenAPI bean declares the title, description, version, and
contact metadata.

## Run the backend locally

### Requirements

- JDK 21
- Docker with Docker Compose (for the provided PostgreSQL/pgvector service)
- A valid Google Gemini API key with access to the configured chat and
  embedding models

### 1. Start PostgreSQL with pgvector

From the backend project root:

```bash
docker compose up -d postgres
docker compose ps
```

The Compose service exposes PostgreSQL on host port `5434` and uses database
`docmind`. Its health check uses `pg_isready`. The named Docker volume
`vtpgdata` persists data between container restarts.

`init.sql` enables the `vector` and `uuid-ossp` extensions when PostgreSQL
initializes a fresh data volume. The Spring AI pgvector configuration is also
set to initialize its vector table.

### 2. Configure the Gemini key

Set the required environment variable in the shell that will start the
application:

```bash
export GEMINI_API_KEY='your-real-key'
```

Do not commit a real key to source control. `GEMINI_CHAT_MODEL` can override
the configured default chat model:

```bash
export GEMINI_CHAT_MODEL='a-model-available-to-your-project'
```

The configured default in this checkout is `gemini-3.8-flash`; make sure the
model name is currently available to your Google GenAI account/API.

### 3. Start Spring Boot

```bash
./mvnw spring-boot:run
```

The active profile is `dev`, loaded because `application.properties` sets
`spring.profiles.active=dev`. The server listens on port `8081`.

### 4. Run tests

```bash
./mvnw test
```

The current test suite contains a Spring application context-load test. It is
not yet a behavioral test suite for upload, parsing, retrieval, chat, or
deletion.

## Configuration explained

### `application.properties`

- `spring.application.name=docmind-backend`
- Activates the `dev` profile.
- Sets `server.port=8081`.

### `application-dev.yml`

| Setting | Current behavior |
| --- | --- |
| Database URL | `jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5434}/${DB_NAME:docmind}` |
| DB credentials | `DB_USER` / `DB_PASSWORD`, with local development defaults |
| `spring.jpa.hibernate.ddl-auto` | `update`; Hibernate may update schema automatically |
| SQL logging | Enabled with formatted SQL |
| Chat provider | Google GenAI |
| Chat model | `${GEMINI_CHAT_MODEL:gemini-3.8-flash}` |
| Chat temperature | `0.2` |
| Embedding model | `gemini-embedding-001` |
| Embedding dimensions | `1536` |
| Vector table | `public.vector_store` |
| Vector index | HNSW |
| Vector distance | Cosine distance |
| Upload size | 25 MB per file, 50 MB per request |
| RAG chunk size | 700 tokens as passed to `TokenTextSplitter` |
| Default retrieval top K | 5 |
| Similarity threshold | 0.0 |
| CORS | Wildcard origin pattern, configured methods and headers |

Several values can be overridden through environment variables. The YAML also
contains a `jwt` section, but the current code does not implement JWT
authentication or request authorization.

### CORS configuration

`CorsConfig` applies CORS rules to `/api/**`. It splits allowed origins,
methods, and headers from `AppProperties` and allows credentials. The
development YAML uses wildcard origins. Production deployments should use a
strict allowlist of trusted web-app origins; CORS is not an authentication
mechanism.

## Errors, transactions, and operational behavior

`GlobalExceptionHandler` is a `@RestControllerAdvice` and wraps handled errors
in the same `ApiResponse` envelope:

| Exception | HTTP status | Behavior |
| --- | --- | --- |
| `ResourceNotFoundException` | `404 Not Found` | Includes the exception message |
| `DocumentProcessingException` | `422 Unprocessable Content` | Logs the exception and includes processing detail |
| `MaxUploadSizeExceededException` | `422 Unprocessable Content` | Returns a file-size-limit message |
| `MethodArgumentNotValidException` | `400 Bad Request` | Returns field-specific validation messages |
| `IllegalArgumentException` | `400 Bad Request` | Includes the exception message |
| Other `Exception` | `500 Internal Server Error` | Logs the exception and returns a generic public message |

`DocumentMetadataService.uploadAndProcess` and `deleteDocument` are annotated
with `@Transactional`. The upload-multiple method loops over files and calls
`uploadAndProcess` internally; because this is a self-invocation, it does not
pass through the Spring transaction proxy for each loop iteration. Each upload
may therefore have different transaction boundaries from calling the
single-upload endpoint.

Deleting a document first removes JPA metadata, then attempts to delete vector
rows using a parameterized SQL statement on `metadata->>'documentId'`. The
vector deletion is inside a broad catch that logs a warning and does not fail
the request. This means the metadata row can be deleted while orphaned vectors
remain if direct vector deletion fails.

Upload-multiple processes files sequentially, not concurrently. It stops on an
exception rather than returning a per-file success/failure result for every
file. The upload endpoint also waits for server-side parsing and indexing; it
is not an asynchronous job API.

## Security and production readiness

This is an educational/demo backend, not a production-hardened service yet.
Important points:

- No authentication or authorization filter is currently implemented.
- `spring-boot-starter-security` is commented out. JJWT libraries and a JWT
  configuration value exist, but the code does not use them to secure routes.
- Document records and vector searches have no user/tenant ownership boundary.
  Any caller that can reach the API can list, query, or delete shared records.
- Never expose the Gemini API key to clients or commit it.
- Replace development DB credentials and any weak/default JWT secret before
  deployment. Better still, do not configure unused security secrets until a
  real auth implementation exists.
- Restrict CORS origins; wildcard CORS does not prevent non-browser callers.
- `ddl-auto: update` and SQL logging are development conveniences. Prefer
  database migrations and safer logging/DDL policies in production.
- Validate uploads by actual file content as well as filename/content type;
  content type and extension are client-controlled.
- Add limits/rate controls for model calls, upload volume, and query frequency.
- Avoid returning provider, database, or filesystem details to untrusted
  callers. The current document-processing exception handler includes the
  exception message in its response.

## Known implementation gaps to understand

These are useful to know when debugging or explaining the current code. They
are listed rather than silently described as completed features.

1. **Parser dispatch looks inverted for common formats.** In
   `DocumentParserService`, PDFs are routed to `TikaDocumentReader`, while all
   non-PDF files are routed to `PagePdfDocumentReader`. The latter is a PDF
   reader; DOC/DOCX/TXT/Markdown/CSV support should be verified and this
   dispatch likely needs correction before claiming broad format support.
2. **`buildPrompt` is currently unused.** `RagService` builds a prompt string,
   but the normal and streaming chat chains send only the system template with
   `doc_context` plus the question as `.user(...)`. Instructions inside the
   unused helper do not affect model behavior.
3. **Similarity-search failures are converted to empty results.**
   `retrieveRelevantDocuments` catches any exception and returns an empty
   list. This lets the request continue as a no-context chat, but makes a
   vector-store outage indistinguishable from genuinely having no matching
   chunks at the API level.
4. **Empty parsed/chunked content is marked failed but not thrown.** If the
   splitter produces no chunks, ingestion sets status `FAILED` and returns
   zero. The upload service can then return its normal response message even
   though the status is failed.
5. **Successful upload response wording is optimistic.** The upload response
   message says the file was successfully processed even if the no-chunk path
   returned zero chunks and left status `FAILED`.
6. **The conversation ID should be sent by clients.** The streaming endpoint
   fills one when absent. The non-stream endpoint constructs an ID for its
   response after the advisor call; pass a stable ID in requests for reliable
   multi-turn memory.
7. **Page count is based on parser output count.** `totalPages` is the number
   of returned Spring AI `Document` objects. That only equals real pages when
   the selected reader emits one object per page.
8. **Citation score is an assumed distance conversion.** `similarityScore`
   is `1 - distance` if the metadata contains a numeric `distance`; null is
   returned if it does not. This value is not a probability.
9. **Tests are minimal.** There is one context-load test and no explicit
   tests for file-format parsing, upload limits, partial failures, vector
   filtering, deletion cleanup, SSE token framing, or chat-memory continuity.
10. **There is no endpoint to enumerate every chunk.** Chunks are exposed
    through similarity search results. Metadata exposes the count, and search
    returns the top-ranked matching chunks.
11. **Metadata lifecycle is only partially populated.** `createdAt` is set
    at upload; `updatedAt` is part of the entity/DTO but is not visibly
    maintained in the service.
12. **The entity has no stored source file or user association.** It cannot
    currently re-parse a document without a re-upload, and all documents
    share the same application scope.

## How to explain this project in an interview

### Short version

> DocMind is a Spring Boot RAG backend. It accepts documents, parses and
> token-splits their text, enriches each chunk with document/page metadata,
> embeds the chunks using Gemini, and stores them in PostgreSQL pgvector. At
> query time, it embeds the user's question, retrieves the top relevant chunks
> (optionally filtered by document UUID), and supplies those passages as
> context to a Gemini `ChatClient`. It supports JSON chat, token streaming,
> similarity search with citations, and document metadata management.

### Be ready to discuss

- Why chunking is needed: whole documents are too large and imprecise for
  retrieval; smaller passages give more targeted grounding.
- Why vector search: it matches semantic meaning rather than requiring exact
  keyword overlap.
- What metadata filtering does: restricts retrieval to chunks carrying the
  selected `documentId`.
- Why dimensions matter: query and stored embeddings must have matching
  dimensions for pgvector distance operations.
- How citations are built: retrieved chunk text and its metadata are mapped to
  `CitationDto`; citations are retrieval evidence, not model-generated links.
- Why stream: the `Flux<String>` route can deliver generated output
  incrementally, improving perceived response time for long answers.
- What you would improve next: parser routing/tests, error propagation from
  vector retrieval, upload job handling, auth/tenant isolation, transactional
  vector cleanup, stable conversation IDs, observability, and migration-based
  schema management.

Be precise in interviews: distinguish the intended supported file formats from
what the current parser dispatch has actually been verified to parse.

## A practical code-reading path

1. Start at `controller/DocumentController.java` and
   `controller/ChatController.java` to see the HTTP contract.
2. Read the DTOs to understand JSON, multipart, and response payloads.
3. Follow document upload through `DocumentMetadataService`,
   `DocumentParserService`, and `DocumentIngestionService`.
4. Read `RagService.retrieveRelevantDocuments`, `buildContextString`,
   `mapToCitation`, `askQuestion`, and `streamQuestionAnswer`.
5. Read `ProjectConfig` to understand the default system prompt, memory
   advisor, and OpenAPI metadata.
6. Compare `application.properties`, `application-dev.yml`, `docker-compose.yaml`,
   and `init.sql` to trace runtime configuration into PostgreSQL/pgvector.
7. Read `GlobalExceptionHandler` and the test class to understand current
   failure mapping and test coverage.

## Useful commands

```bash
# Start only the database
docker compose up -d postgres

# Tail database logs
docker compose logs -f postgres

# Start the API (GEMINI_API_KEY must be set)
./mvnw spring-boot:run

# Run tests
./mvnw test

# Package the application
./mvnw package

# Stop the database container (the named volume remains)
docker compose stop postgres
```
