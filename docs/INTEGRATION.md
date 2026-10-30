# Backend integration contract

The frontend talks to two backends, both through `src/services/`:

1. The **platform REST API**, for papers, extracted records, the review queue and uploads. These endpoints come from the prototype's `DataService` and keep the same shapes.
2. The **Amplifi proxy**, a server-side service that holds Amplifi's credentials and forwards questions to it. This frontend defines the proxy's contract below, because Amplifi's own API hadn't been verified when it was built.

All requests are JSON unless stated. The frontend sends `credentials: "same-origin"`, so a session cookie set by the same origin is included automatically. It never sends an `Authorization` header or any secret.

## Errors

Return a normal HTTP status. The frontend maps statuses to messages people can act on:

| Status | Shown as |
| --- | --- |
| 401 | “…needs you to sign in again.” |
| 403 | “Your account doesn’t have access to this…” |
| 404 | “…couldn’t find what was requested.” |
| 413 | “…rejected the file as too large.” |
| 5xx | “…had a problem (error N). Try again shortly.” |
| No response, or timeout | “Couldn’t reach…” or “…took too long to respond.” |
| Body that doesn't match the shapes below | “…sent data in an unexpected format (field).” |

## Platform API (`VITE_PLATFORM_API_BASE`)

### `GET /records`

Returns the research dataset. Measurements the paper doesn't report must be `null`. Don't send `0` or an estimate.

```json
{
  "papers": { "CP01": { "author": "Shen", "year": 2026, "title": "Pore-stitching engineering of…" } },
  "records": [
    {
      "id": "CP01-pouch", "paper": "CP01", "author": "Shen", "year": 2026,
      "battery": "Sodium-ion", "anode": "BGP@HEC-HC", "anodeFrom": "Sugarcane bagasse", "anodeGroup": "Biomass",
      "anodeTest": "375.3 mAh/g, first-cycle efficiency 94.8% at 20 mA/g", "anodePage": "5",
      "cathode": "NFPP", "cathodeFormula": "Na4Fe3(PO4)2(P2O7)", "format": "Pouch", "cell": "700 mAh pouch cell",
      "result": null, "energy": 150, "energyText": "150", "energyBasis": "active-material mass of both electrodes",
      "cycles": 200, "cycling": "97.8% retention after 200 cycles at 1C", "lowTemp": null, "page": "1, 7", "checked": true,
      "anodeCapacity": 375.3, "anodeICE": 94.8, "rateCapacity": 230, "rateCondition": "at 1 A/g",
      "anodeCycles": 1000, "anodeRetention": 88.5, "anodeRetentionNote": null,
      "carbonizationTemp": 1400, "d002": 0.39, "fullRetention": 97.8, "fullRetentionNote": null
    }
  ],
  "checkedValueCount": 72
}
```

`battery` must be `"Sodium-ion"` or `"Lithium-ion"`. `format` is `"Pouch"`, `"Cylindrical"`, `"Coin"`, `"Not stated"` or `null`. `checkedValueCount` is optional; without it the dashboard shows “Not reported”. The full field list and its meaning are in `src/types/research.ts`.

### `GET /papers`

Returns every paper in the Library.

```json
[{ "id": "CP02", "authors": "Wang et al.", "year": 2026, "title": "…", "type": "Lab study",
   "collection": "Hard carbon", "status": "Extracted", "values": "2 waiting", "note": "…" }]
```

`status` is `"Harvested"`, `"Extracted"` or `"Checked"`.

### `GET /review`

Returns the values waiting for a person to check.

```json
[{ "id": "r3", "paper": "CP09", "field": "Reversible capacity at 0.05 A/g", "value": "474.8 mAh/g", "page": "4",
   "source": "amplifi", "sourceLabel": "Extracted by Amplifi (GPT-5.4)", "note": "…" }]
```

### `POST /review/:id`

Records a review decision. The frontend updates its own state only after a 2xx response.

```json
{ "action": "approve" }
{ "action": "correct", "value": "443.8 mAh/g" }
{ "action": "reject" }
```

Any 2xx response is accepted. The body is ignored.

### `POST /upload`

Accepts `multipart/form-data` with three fields:

| Field | Content |
| --- | --- |
| `file` | The PDF |
| `dataset` | `theme-a` or `theme-b` |
| `extract` | `"true"` or `"false"` |

The response body is optional. If it contains `{ "paper": { …same shape as GET /papers… } }`, that paper is added to the Library straight away. Otherwise the frontend refetches `GET /papers`. Upload progress comes from the browser. A processing-status endpoint is still needed to show the later steps; see “Open integration questions” in the README.

## Amplifi proxy (`VITE_AMPLIFI_PROXY_URL`)

### `POST /chat`

```json
{
  "question": "What does CP07’s full cell with an NVP cathode deliver?",
  "scope": "CP07",
  "history": [{ "role": "user", "text": "…" }, { "role": "assistant", "text": "…" }],
  "conversationId": null
}
```

| Field | Meaning |
| --- | --- |
| `scope` | `null` for all papers, or a paper ID to limit the search to |
| `history` | Up to the last ten completed turns. Demo and failed answers are left out. |
| `conversationId` | Whatever the previous response returned, or `null` |

Response:

```json
{
  "answer": "The GCL8 and NVP full cell delivers 298 mAh/g at 0.1C… [CP07]",
  "citations": [{ "paperId": "CP07", "page": "6, 8" }],
  "conversationId": "abc123"
}
```

- `answer` is required.
- `citations` is optional. Without it, the frontend reads inline markers such as `[CP07]`, `[C12]`, `[N1]` and `[I2]` from the answer and shows them as sources without page numbers.
- Inline markers always render as buttons that open the paper.

### `POST /find-value`

Asks Amplifi to look for one value that's missing from the extracted table. This is used by "Find with Amplifi" in the pair details.

Request:

```json
{ "paperId": "CP03", "sample": "Ni-NPC", "field": "full-cell energy density" }
```

Response:

```json
{ "value": "…", "page": "8", "quote": "…" }
```

Use `"value": null` when the paper doesn't state it. The prototype did this with a prompt asking Amplifi to reply only with that JSON. The proxy can do the same, but it should validate Amplifi's output before returning it.

## Where to change things

| To change | Edit |
| --- | --- |
| Endpoint paths or request bodies | `createHttp*` in `src/services/researchService.ts`, `documentService.ts` and `amplifiApi.ts` |
| Response validation | `src/services/validate.ts` and `parseChatResponse` in `amplifiApi.ts` |
| Streaming | `createHttpAmplifiClient().ask`. Call `onText(textSoFar)` as chunks arrive; the UI already handles streaming, stopping and partial answers. |
| Auth headers, if a browser token turns out to be necessary | `requestJson` in `src/services/http.ts`, and `xhrUpload` in `documentService.ts` |
