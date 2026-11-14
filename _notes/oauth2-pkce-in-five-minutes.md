---
title: OAuth2 + PKCE in five minutes
topic: Security
date: 2026-11-06
tags: [oauth2, pkce, authentication, java]
summary: Why apps that can't keep a secret send a hash first and the secret later, with the Java to do it.
reviewed: false
catalog: oauth2-pkce
questions:
  - q: Why do public clients need PKCE?
    a: >-
      They can't keep a client secret, so whoever intercepts the authorization code could swap it
      for a token. PKCE binds the code to the client that started the flow.
  - q: How is the S256 code challenge computed?
    a: >-
      `BASE64URL(SHA-256(code_verifier))` without padding. The verifier is 43 to 128 random
      characters from `A-Z a-z 0-9 - . _ ~`.
  - q: Why is the `plain` challenge method discouraged?
    a: >-
      With `plain` the challenge is the verifier itself, so anyone who sees the authorization
      request can redeem the code.
  - q: Does PKCE replace the `state` parameter?
    a: >-
      Not entirely. PKCE stops code injection, but `state` is still the simple way to check that a
      response matches a request you actually sent. OAuth 2.1 recommends PKCE for every client,
      confidential ones included.
---

## Why PKCE exists

Mobile apps, single-page apps, CLIs and AI agents are **public clients**: anything
shipped to the user's device can be read, so they can't keep a client secret.

In the plain Authorization Code flow, whoever holds the authorization code can
swap it for a token. If an attacker intercepts the code (a malicious app on the
same redirect scheme, a leaked log line), they get the token.

**PKCE** (Proof Key for Code Exchange, RFC 7636) ties the code to the client that
started the flow. In one line: *send the hash first, the secret later.*

## The flow

1. The client makes a random **code verifier**: 43 to 128 characters from
   `A-Z a-z 0-9 - . _ ~`.
2. It computes the **code challenge**: `BASE64URL(SHA-256(verifier))`, no padding.
3. It sends the user to `/authorize` with `code_challenge` and
   `code_challenge_method=S256`.
4. The user signs in and approves. The browser comes back with a **code**.
5. The client calls `/token` with the code **and the original verifier**.
6. The server hashes the verifier and compares it with the challenge from step 3.
   Only a match gets a token.

An attacker who steals the code in step 4 never saw the verifier, so the code is useless.

## In Java

```java
SecureRandom random = new SecureRandom();
byte[] bytes = new byte[32];
random.nextBytes(bytes);

// 32 random bytes -> 43 URL-safe characters
String verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

byte[] hash = MessageDigest.getInstance("SHA-256")
        .digest(verifier.getBytes(StandardCharsets.US_ASCII));
String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
```

The authorize request:

```text
GET /authorize?response_type=code
  &client_id=my-agent
  &redirect_uri=https://app.example.com/callback
  &scope=orders:read orders:write
  &state=af0ifjsldkj
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

## Common mistakes

- **Using `plain` instead of `S256`.** With `plain`, the challenge *is* the
  verifier, so anyone who sees the authorize request can redeem the code.
- **Reusing a verifier.** Make a new one for every login.
- **Dropping `state`.** PKCE stops code injection, but `state` is still the
  simplest way to check that a response belongs to a request you actually sent.
- **"We have a client secret, so we don't need PKCE."** OAuth 2.1 recommends PKCE
  for every client, confidential ones included. Use both.

## Further reading

- [RFC 7636: Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636)
- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://www.rfc-editor.org/rfc/rfc9700)
