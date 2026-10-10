# Placement By Concept, Not By Writing Order

New code drifts into the wrong file when placement follows "where I happened to be typing" instead of "what this thing is." Before adding or appending a symbol, answer the three placement questions:

- Kind: is it a style constant, a rendered component, pure logic, or a type? Different kinds do not share a file. A `.tsx` that exports both `*_CLASS` style constants and a JSX-returning component is mixing kinds — split them.
- Concept: which domain concept owns it (e.g. "the CopySetting form's visual system"), not which control you are writing right now? Place by concept so files reflect domain boundaries, not authoring sequence.
- Existing home: does a file already carry that concept? Append to it instead of creating a parallel file.

Naming prefix is the boundary marker, and drift is grep-able:

- One concept, one prefix (e.g. `COPY_SETTING_*`). The same prefix living in two files, or an alias `export const A_X = B_X` that points one prefix at another, is the signal that two files are really one concept — merge them.
- A component imported by 2+ sibling files belongs in the shared `common/`-style folder; a component used in only one place stays local (do not pre-extract).
