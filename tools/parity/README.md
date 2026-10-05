# Parity harness

Does the metric port agree with the engine it was ported from?

`better-antislop` reimplements, in TypeScript, the per-function metrics that the
[`leadline`](https://crates.io/crates/leadline) Rust engine computes. Two
implementations of the same rules drift the moment one of them changes. This
tool is the check that stops the drift: it scores the same functions with both
and fails when a number differs.

It answers one question and one question only:

> For every function in this directory, does this plugin report the same
> cognitive complexity and cyclomatic complexity as `leadline analyze`, and the
> same nesting depth wherever `leadline` reports one?

## Running it

```sh
bun run parity                 # compares the current directory
bun run parity -- src          # compares one directory
bun run parity -- /abs/path    # or an absolute path
bun tools/parity/index.ts --help
```

`leadline` must be on `PATH`. Set `LEADLINE_BIN` to an absolute path when it is
not. `oxlint` is taken from the package's own `node_modules/.bin`, so run
`bun install` first.

Exit codes:

| Code | Meaning                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | Every file parsed, and every compared function matched `leadline`.                                                                     |
| `1`  | A mismatch, a row missing on either side, an ambiguous key, a file that would not parse, a failed run, or no function compared at all. |

Zero functions compared is a failure, not a pass. A tool that compares nothing
has proven nothing. A file that would not parse is a failure too, for the same
reason: the functions in it went unscored on one side.

## What a mismatch means

Each line of the report names one function and one reason.

| Kind            | Meaning                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `value`         | Both tools scored the same function, and a field differs. Read the pair after it. |
| `plugin-only`   | The plugin reported a function that `leadline` never reported at that line.       |
| `leadline-only` | `leadline` scored a function that the plugin never reported at that line.         |
| `ambiguous`     | Two or more `leadline` rows share one key, so the pair cannot be resolved.        |

```
parity: /repo/src/rules
files linted 1 | plugin rows 12 | leadline rows 12
compared 12 | agreements 11 | mismatches 1
skipped nesting 12 | skipped name 0
plugin rule diagnostics 3 | unlabelled 0
mismatches (1):
  value        create-metric-rule.ts:119 createMetricRule     cognitive plugin=6 leadline=7
```

The report also names the file from the side that reported it, so a
`leadline-only` row shows the path `leadline` used and a `plugin-only` row shows
the path oxlint used.

A `value` row is a genuine disagreement about the rules. Read it as: the two
implementations score this construct differently, and one of them is wrong.

The other three are gaps. They usually mean the two tools walked different file
sets, not that a rule is wrong, so fix the corpus or the run before reading
anything into them.

### A file that would not parse

The sharpest corpus problem is a file oxlint could not parse. It yields no
metric rows at all, so every function `leadline` still reads in that file comes
back as a `leadline-only` row — which reads like a scoring dispute but is not
one. The run reports it separately instead:

```
UNPARSED FILES (1): the plugin scored nothing in these, so every function leadline reports in them shows up as leadline-only
  src/opinionated/shared/assertions.ts: Unexpected token
```

This fails the run, because an unparsed file proves nothing and a gate that
passes on an unreadable corpus is worse than no gate. The realistic trigger is a
file being edited while the harness runs: the corpus moves under the run, and
the `leadline-only` rows can then name line numbers that do not exist in the
tree. Treat this banner as "fix the corpus and re-run", never as a rule defect.

The two counts separate cleanly. A parse error carries no `code`; every lint
finding does, including this plugin's own. So a parse error is never counted as
a rule diagnostic, and `plugin rule diagnostics` stays a true count of findings.

## How it works

1. `leadline.ts` runs `leadline analyze --format agent-json <DIR>` and
   normalises every row to `{ file, line, name, cognitive, cyclomatic,
   maxNesting }`.
2. `collect.ts` writes a temporary oxlint config and a temporary oxlint plugin,
   runs `oxlint --config <config> --format json <DIR>`, and reads one row per
   function back out of the diagnostics.
3. `compare.ts` joins the two sets and reports every disagreement.
4. `index.ts` prints the report and sets the exit code.

## Why diagnostics

`context.report` is the only channel a linter rule has. There is no sidecar
file, no exit-code protocol and no return value: whatever the harness wants to
learn has to travel inside a diagnostic.

So the run emits one diagnostic per function, anchored at the function's span,
with the metrics in a fixed, parseable message:

```
@@parity cognitive=14 cyclomatic=7 nesting=4 name=createMetricRule
```

The prefix is the contract. `collect.ts` reads that message and nothing else;
every other diagnostic in the run belongs to one of the plugin's own three
metric rules and is counted, not compared.

The three metric rules are threshold rules. They report only what is out of
limit, so they cannot produce one row per function. The harness therefore
registers a second, generated plugin that calls the same `analyzeProgram` the
real rules call and reports every function it scores. The numbers compared are
still the numbers the rules would see, because they come out of the same engine,
through the same oxlint plugin runtime.

## Why the config path comes from the package root

oxlint resolves a `jsPlugins` specifier relative to the config file, not the
working directory. The generated config therefore lives at
`<package root>/.parity-oxlintrc.json`, next to `src/index.ts`, so it can name
the plugin under test as `./src/index.ts` exactly the way `oxlint.config.ts`
does.

Deriving that path from the package root rather than from `process.cwd()` means
`bun tools/parity/index.ts /some/other/tree` and `bun run parity` behave the
same. Only the directory under comparison follows the working directory, and it
is resolved to an absolute path before it reaches a subprocess.

The generated plugin goes the other way: it lands in the system temp directory
and imports the engine by absolute path. oxlint walks dotfiles that leadline
ignores, so a scratch file inside the repository would add rows to one side
only and report a phantom mismatch.

Both files are removed when the run ends, whether it succeeded or failed.

## How rows are matched

Rows join on `(basename, line)`.

The two tools print paths relative to different roots, so the basename is the
only part of the path that means the same thing on both sides. The line is the
1-based start line of the function, which oxlint reports in the diagnostic
label and leadline reports as the row's `line`.

Basenames collide across directories. When two leadline rows land on one key,
the key is reported as `ambiguous` and counts as a mismatch, so a corpus with
`src/index.ts` and `tests/index.ts` fails loudly instead of comparing the wrong
pair.

## Two fields are not always compared

`skipped nesting` counts functions where leadline carried no nesting measure.
`analyze --format agent-json` emits `cognitive`, `cyclomatic`, `line` and
`name`, and no nesting field, so on the current engine this count equals the
number of compared functions and the nesting rule is not covered by a default
run. The harness reports the skip instead of inventing a value. It compares
nesting automatically if a format ever supplies it.

`skipped name` counts functions where one side has no name, which happens for
anonymous functions. The two engines spell an anonymous function differently, so
names are compared only when both sides named the function. A named function
whose name differs between the two is still reported, as a `name` field diff.

## Effect boundaries

Effect appears only where this tool touches the outside world: spawning
`oxlint`, spawning `leadline`, and writing and removing the scratch files. The
metric math, the message parsing and the comparison are plain functions.

Every boundary fails into a typed error from `errors.ts`, and no `Error` ever
reaches the error channel:

| Error                | Raised when                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `LeadlineNotFound`   | `leadline` is not on `PATH` and `LEADLINE_BIN` does not resolve. |
| `OxlintNotFound`     | `node_modules/.bin/oxlint` is missing.                           |
| `CommandFailed`      | A tool started and then failed.                                  |
| `UnreadableOutput`   | A tool exited cleanly but wrote stdout this tool cannot read.    |
| `ScratchWriteFailed` | A scratch file could not be written.                             |

A scratch file that cannot be removed is reported on stderr instead. It never
fails the run, and it is never dropped without a word.

`UnreadableOutput` is also where a plugin that fails to load surfaces: oxlint
prints the load error to stdout instead of JSON, the decode fails, and the
first bytes of the message are in the report.

## Output is deterministic

Rows are sorted by basename, then line, then kind, then name. The same corpus
produces the same report on every run, so two runs can be diffed directly.
