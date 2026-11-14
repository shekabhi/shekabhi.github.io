---
title: "Idempotency keys: making retries safe"
topic: System Design
date: 2026-11-12
tags: [api-design, distributed-systems, reliability]
summary: A timeout doesn't tell you whether the request worked. An idempotency key makes "just retry" safe.
reviewed: false
catalog: idempotency
questions:
  - q: Which HTTP methods need idempotency keys, and why?
    a: >-
      `POST`, and often `PATCH`. `GET`, `PUT` and `DELETE` are idempotent by definition, so
      repeating them doesn't change the outcome.
  - q: Who should generate the idempotency key?
    a: >-
      The client, once per logical operation, reused on every retry. A key created by the server
      can't be reused by a retry that never received the first response.
  - q: Two requests with the same key arrive at the same time. What happens?
    a: >-
      A unique constraint on (client, key) lets only one insert win. The other sees the key as
      `IN_PROGRESS` and gets `409 Conflict`, so it retries later.
  - q: The same key arrives with a different request body. What should the server do?
    a: >-
      Reject it with `422`. Store a hash of the request body with the key and compare: the client
      reused a key by mistake.
  - q: Why store the response in the same transaction as the business change?
    a: >-
      If the change commits but the response isn't saved (a crash in between), a retry can't tell
      whether the work happened and may do it again.
  - q: A retry reuses an idempotency key but sends a different body. Which response fits best?
    options:
      - "`422 Unprocessable Content`"
      - "`409 Conflict`"
      - "`200 OK` with the stored response"
      - "`500 Internal Server Error`"
    correct: 1
    a: >-
      The client reused a key for a different request, which is a client error. The IETF draft for
      the `Idempotency-Key` header suggests `422`. `409` is for a request with that key that is
      still in progress.
  - q: A second request arrives while the first one with the same key is still running. What should it get?
    options:
      - "`409 Conflict`, so the client retries later"
      - "`422 Unprocessable Content`"
      - "`201 Created`, running the operation again"
      - "`404 Not Found`"
    correct: 1
    a: >-
      The key is stored as `IN_PROGRESS`, so the server can't return a result yet. `409` tells the
      client to try again later. Running the operation again is exactly what idempotency keys
      prevent.
---

## The problem

A client sends `POST /payments`. The network times out. Did the payment go through?

- Don't retry, and you may have dropped the payment.
- Retry, and you may charge the customer twice.

Timeouts, load balancers and client libraries all retry. The server has to make a
retry harmless.

## The fix

The client generates a unique key for each **logical operation** (a UUID is fine)
and sends it with every attempt:

```http
POST /payments HTTP/1.1
Idempotency-Key: 5f1c9d0e-2b7a-4c1e-9d3f-8a6b2c4e7f10
Content-Type: application/json

{"amount": 4999, "currency": "INR", "to": "acct_123"}
```

The server remembers each key and the response it produced. The same key again
returns the stored response without running the operation a second time.

## Server-side flow

1. Look up the key, scoped to the client.
2. **Not found:** insert it as `IN_PROGRESS`, do the work, store the response, mark `DONE`.
3. **Found, `DONE`:** return the stored response.
4. **Found, `IN_PROGRESS`:** another attempt is running. Return `409 Conflict`.
5. **Same key, different body:** the client reused a key by mistake. Return `422`.

```sql
CREATE TABLE idempotency_keys (
  client_id    VARCHAR(64)  NOT NULL,
  idem_key     VARCHAR(64)  NOT NULL,
  request_hash CHAR(64)     NOT NULL,          -- SHA-256 of the request body
  status       VARCHAR(16)  NOT NULL,          -- IN_PROGRESS | DONE
  response     TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, idem_key)
);
```

The primary key is what makes concurrent retries safe: if two attempts arrive at
once, only one insert succeeds.

## Details that matter

- **Save the response in the same transaction** as the business change where you
  can. A crash between the two leaves you unsure whether the work happened.
- **Expire old keys**, for example after 24 hours.
- **`GET`, `PUT` and `DELETE` are idempotent by definition.** It's `POST` (and
  often `PATCH`) that needs keys.
- **The client creates the key**, not the server. Otherwise a retry can't reuse it.

## Further reading

- [IETF draft: The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
