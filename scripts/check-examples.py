#!/usr/bin/env python3
"""Compile and run every runnable Java example in the notes, and check its recorded output.

A runnable example in a note looks like this (the output block must follow the code block):

    ```java
    public class Demo { public static void main(String[] args) { System.out.println("hi"); } }
    ```
    {: .runnable}

    ```text
    hi
    ```
    {: .run-output}

The page shows a Run button that reveals the recorded output, so the output must be exactly what
Java prints. Run this after changing an example:

    python3 scripts/check-examples.py            # check (CI runs this)
    python3 scripts/check-examples.py --update   # rewrite the recorded outputs from a real run

Needs a JDK (Java 21) on the PATH.
"""
import pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAIR = re.compile(
    # a code block can't contain a closing fence, so each match stays inside one block
    r"```java\n(?P<code>(?:(?!```).)*)```\n\{: \.runnable\}\n\n```text\n(?P<out>(?:(?!```).)*)```\n\{: \.run-output\}",
    re.S,
)
LONE = re.compile(r"\{: \.runnable\}")


def run(code: str) -> str:
    m = re.search(r"public\s+(?:final\s+)?class\s+(\w+)", code)
    if not m:
        raise ValueError("a runnable example needs a `public class` with a main method")
    name = m.group(1)
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp, f"{name}.java")
        src.write_text(code, encoding="utf-8")
        javac = subprocess.run(["javac", "-encoding", "UTF-8", "-d", tmp, str(src)], capture_output=True, text=True)
        if javac.returncode:
            raise ValueError("javac failed:\n" + javac.stderr)
        java = subprocess.run(["java", "-Dstdout.encoding=UTF-8", "-cp", tmp, name],
                              capture_output=True, text=True, encoding="utf-8", timeout=60)
        if java.returncode:
            raise ValueError("the program failed:\n" + java.stderr)
        return java.stdout


def main() -> int:
    update = "--update" in sys.argv
    failures, count = 0, 0
    for note in sorted((ROOT / "_notes").glob("*.md")):
        text = note.read_text(encoding="utf-8")
        pairs = list(PAIR.finditer(text))
        if len(pairs) != len(LONE.findall(text)):
            print(f"✗ {note.name}: every {{: .runnable}} block needs a {{: .run-output}} block right after it")
            failures += 1
            continue
        new_text, offset = text, 0
        for m in pairs:
            count += 1
            try:
                actual = run(m.group("code"))
            except Exception as e:  # report and keep going
                print(f"✗ {note.name}: {e}")
                failures += 1
                continue
            if actual == m.group("out"):
                print(f"✓ {note.name}: output matches")
            elif update:
                s, e = m.span("out")
                new_text = new_text[: s + offset] + actual + new_text[e + offset:]
                offset += len(actual) - (e - s)
                print(f"↻ {note.name}: output updated")
            else:
                print(f"✗ {note.name}: recorded output differs from a real run. Expected:\n{actual}")
                failures += 1
        if update and new_text != text:
            note.write_text(new_text, encoding="utf-8")
    print(f"{count} runnable examples, {failures} problem(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
