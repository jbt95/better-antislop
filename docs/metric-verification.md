# Metric verification and references

## 14. Detecting a wrong implementation

Six rules are easy to get wrong in a way that produces plausible numbers. Each
has one input that settles it.

| Rule                                | Input                                            | Correct                                                  | Wrong implementations give                          |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| `??` is not a branch                | `return user?.name ?? 'anonymous';`              | cyclomatic 1, cognitive 0                                | 2 and 1, when `??` is treated as `\|\|`             |
| Sequences are read in source order  | `return a \|\| b && c \|\| d && e;`              | cognitive 4                                              | 2, from a preorder tree walk                        |
| `try` is not structural, `catch` is | `if` inside `try` vs `if` inside `catch`         | cognitive 2 / maxNesting 1 vs cognitive 3 / maxNesting 2 | 3 and 2 both times, or 1 and 2                      |
| A `switch` header costs nothing     | `switch` with two cases and a `default`          | cyclomatic 3                                             | 4 or 5, when the header or the `default` is charged |
| A nested function stands alone      | `outer` wrapping an arrow with an `if`           | outer: cyclomatic 1, cognitive 0, logicalLines 2         | 2, 1 and 5, when the arrow is walked into           |
| A property colon is written         | `{ a: 1 }` against `{ a }`, against `{ a() {} }` | `:` on the first and the third, none on the second       | none on the first, or one on the shorthand          |

Two further readings worth stating outright, because they are easy to assume
wrong:

- `break` and `continue` add nothing to cyclomatic complexity; only a **labelled**
  jump adds a cognitive point.
- `throw` adds 1 to cyclomatic complexity and **0** to cognitive complexity.

## 15. References

- T. J. McCabe, "A Complexity Measure", _IEEE Transactions on Software
  Engineering_, SE-2(4), 1976, pp. 308–320.
- G. A. Campbell, "Cognitive Complexity: A New Way of Measuring
  Understandability", SonarSource SA white paper, 2017.
- M. H. Halstead, _Elements of Software Engineering_, Elsevier, 1977.
- D. Coleman, D. Ash, B. Lowther, P. Oman, "Using Metrics to Evaluate Software
  System Maintainability", _IEEE Computer_, 27(8), 1994, pp. 44–49.
