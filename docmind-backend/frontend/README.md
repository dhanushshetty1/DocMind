# DocMind frontend

React, TypeScript, Vite, and Tailwind CSS UI for the DocMind document assistant.

## Source structure

```text
src/
├── components/
│   ├── ChatView.tsx
│   ├── ChunksView.tsx
│   ├── Navbar.tsx
│   ├── SearchView.tsx
│   ├── Shared.tsx
│   ├── Sidebar.tsx
│   └── UploadDialog.tsx
├── context/
│   └── WorkspaceContext.tsx
├── services/
│   └── api.ts
├── types/
│   └── index.ts
├── utils/
│   └── index.ts
├── App.tsx
├── index.css
└── main.tsx
```

## Run locally

```bash
npm install
npm run dev
```

The backend should be running at `http://localhost:8081` by default. Vite
proxies API and Swagger requests there during development. To use a different
backend URL, copy `.env.example` to `.env` and set `VITE_API_BASE_URL` before
starting Vite. For a deployed frontend, configure this value to the backend
base URL and make sure the backend allows the deployed frontend origin.

## Build

```bash
npm run build
npm run preview
```

## Backend integration

The UI uses the existing `/api/v1/documents` endpoints for listing, uploading,
reading, and deleting documents, plus `/api/v1/chat/query`, `/api/v1/chat/stream`,
and `/api/v1/chat/search/similarity` for chat and vector search.

Uploads use the backend's single-file or multi-file endpoint and report browser
transfer progress. The backend provides document chunk counts and similarity
search results, but does not provide an endpoint to list every chunk in a
document. The document details panel therefore displays the indexed chunk
count and retrieves relevant chunk previews through document-scoped semantic
search.
