---
title: Sliding-window rate limiting with a Redis sorted set
topic: Redis
date: 2026-11-02
tags: [redis, rate-limiting, lua, distributed-systems]
summary: Three Redis commands and one Lua script give every server the same answer to "is this user over the limit?"
reviewed: false
catalog: rate-limiting
questions:
  - q: Why use a sorted set instead of a simple counter for a sliding window?
    a: >-
      A fixed-window counter lets a client send a full quota at the end of one window and
      another at the start of the next. A sorted set keeps each request's timestamp, so you
      can count exactly what falls inside the last N seconds at any moment.
  - q: Why does the check need to run as a Lua script?
    a: >-
      The read (`ZCARD`) and the write (`ZADD`) are separate commands, so two servers can both
      read 4/5, both decide "allowed" and both add. A Lua script runs atomically on the Redis
      server. `MULTI`/`EXEC` can't branch on the `ZCARD` result, so Lua is the usual choice.
  - q: What goes wrong if the sorted-set member is just the timestamp?
    a: >-
      Two requests in the same millisecond get the same member, so the second `ZADD` overwrites
      the first and you under-count. Add a random suffix or a UUID to the member.
  - q: When would you choose a token bucket or a sliding window counter instead?
    a: >-
      Token bucket when short bursts are fine but you want a steady average rate. Sliding window
      counter (two fixed-window counters, weighted) when limits are very high and an
      approximation is acceptable, because it uses constant memory per user.
  - q: Which command forgets requests that are older than the window?
    options:
      - "`ZREMRANGEBYSCORE`"
      - "`ZCARD`"
      - "`ZADD`"
      - "`PEXPIRE`"
    correct: 1
    a: >-
      `ZREMRANGEBYSCORE key 0 (now - window)` removes every member whose score, the request
      timestamp, falls before the window. `ZCARD` only counts, `ZADD` adds, and `PEXPIRE` sets a
      timeout on the whole key.
  - q: Two servers both read 4/5 and both allow a request. What prevents this?
    options:
      - "Running the check and the add as one Lua script"
      - "Setting a shorter expiry on the key"
      - "Calling `ZCARD` twice before adding"
      - "Using a longer window"
    correct: 1
    a: >-
      Redis runs a Lua script atomically, so no other command can run between the count and the
      add. The other options leave the read and the write as separate steps that can interleave.
---

## The idea

Keep every request a user made in the last *N* seconds in a **sorted set**, with the
request's timestamp as its score. To decide whether a new request is allowed:

1. Remove everything older than the window.
2. Count what's left.
3. If the count is under the limit, add the new request.

Because the state lives in Redis, every application server sees the same window.

## The commands

```text
ZREMRANGEBYSCORE rl:{user}  0  (now - window)   # forget old requests
ZCARD            rl:{user}                       # how many are left?
ZADD             rl:{user}  now  <unique-id>     # record this one (only if allowed)
PEXPIRE          rl:{user}  window               # idle users' keys clean themselves up
```

## Make it atomic

Sending those commands one by one has a race: two servers can both read `4/5`,
both decide "allowed" and both add, ending at `6/5`. Redis runs a Lua script as
a single step, so put the logic in one:

```lua
-- KEYS[1] = rl:{user}
-- ARGV[1] = now (ms), ARGV[2] = window (ms), ARGV[3] = limit, ARGV[4] = unique member
local now, window, limit = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
if redis.call('ZCARD', KEYS[1]) < limit then
  redis.call('ZADD', KEYS[1], now, ARGV[4])
  redis.call('PEXPIRE', KEYS[1], window)
  return 1   -- allowed
end
return 0     -- rejected
```

Calling it from Spring Boot:

```java
DefaultRedisScript<Long> script = new DefaultRedisScript<>(LUA_SOURCE, Long.class);

Long allowed = redisTemplate.execute(
        script,
        List.of("rl:" + userId),
        String.valueOf(System.currentTimeMillis()),
        String.valueOf(windowMs),
        String.valueOf(limit),
        UUID.randomUUID().toString());

if (allowed == 0) {
    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
}
```

## Gotchas

- **Members must be unique.** If you use the timestamp as the member too, two
  requests in the same millisecond collapse into one entry and you under-count.
  Add a random suffix or a UUID.
- **Clock skew between servers.** Each server passes its own `now`. If clocks
  drift, window edges drift too. Use NTP, or read the time inside the script with
  `redis.call('TIME')` so one clock decides.
- **Memory grows with the limit.** One entry per request in the window is fine
  for 100 requests a minute. For 100,000, look at the approximation below.

## When to use something else

| Need | Better fit |
| --- | --- |
| Very high limits, approximate is fine | Sliding window **counter**: two fixed-window counters, weighted |
| Allow short bursts, then a steady rate | **Token bucket** |
| Cheapest possible, edge bursts acceptable | Fixed window counter (`INCR` + `EXPIRE`) |
