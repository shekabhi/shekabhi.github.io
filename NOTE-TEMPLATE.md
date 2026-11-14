---
title: Your note title
# short_title: Shorter title  # optional: used in the browser tab when the title is long (keep the tab under ~50 characters)
topic: Java concurrency   # Java, Redis, System Design, Security... (a new topic creates a new filter)
date: 2026-11-20          # when you wrote it (YYYY-MM-DD). Future dates are hidden until that day.
# updated: 2026-12-01     # uncomment when you update the note
tags: [tag-one, tag-two]
summary: One sentence that appears on the card in the Learning hub.
catalog: thread-pools     # optional: a topic id from _data/topics.yml, lists the note on the Topics page
series: java-concurrency  # optional: part of a series, ordered as in _data/topics.yml (previous/next links)
priority: high            # optional: only shown (as a star) in your private plan view
questions:
  # Questions WITHOUT options appear under "Common questions" (full answers, think first, then expand)
  - q: A question people often ask about this topic?
    a: >-
      A complete answer, as you'd explain it out loud. Markdown works, e.g. `code`.
  # Questions WITH options + correct are multiple choice and appear under "Test yourself"
  - q: A multiple-choice question?
    options:
      - "The right answer"
      - "A plausible wrong answer"
      - "Another wrong answer"
      - "One more wrong answer"
    correct: 1            # which option is right, counting from 1 (shuffled in the Quiz)
    a: >-
      Why that's right (shown after answering).
---

## The idea

What is this, in two or three sentences?

## How it works

The mechanism, step by step. Use `### sub-headings`, tables and diagrams in `text` blocks.

## In code

```java
// A realistic, runnable example
```

## Pitfalls

- The mistakes people actually make, and what happens when they do.

## When to use what

| Need | Use |
| --- | --- |
| ... | ... |

## Further reading

- [Link title](https://example.com)

<!--
Practice-problem notes use the same front matter (with a `problem-...` catalog id) and these sections:
## The problem / ## Approach / ## Solution / ## Complexity / ## Common mistakes / ## Variations
-->
