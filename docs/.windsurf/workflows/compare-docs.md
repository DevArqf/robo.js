---
description: Compare docs migration/rewrite individually or in batches.
---

This workflow helps compare documentation files, typically from an old and new source (e.g., Docusaurus to Fumadocs migration), to ensure content parity and identify key differences.

## Workflow Steps

1.  **Input Specification**:
    *   The user provides two primary inputs:
        *   `Source A Path`: A file path or a folder path for the first set of documents (e.g., old documentation).
        *   `Source B Path`: A file path or a folder path for the second set of documents (e.g., new documentation).

2.  **File Collection**:
    *   Recursively list all markdown files (`.md`, `.mdx`) within the provided `Source A Path` and `Source B Path` if they are directories.

3.  **Parity Check & Pairing Strategy**:
    *   The goal is to find a unique corresponding file in `Source B` for each file in `Source A`.
    *   **Initial Pairing Attempt (Filename Similarity)**:
        *   For each file in `Source A`, try to find a file in `Source B` with a similar name. Consider:
            *   Exact filename match (e.g., `my-feature.md` -> `my-feature.md`).
            *   Case-insensitive match.
            *   Ignoring extensions or matching common extensions (`.md` vs `.mdx`).
            *   Simple transformations (e.g., `MyFeature.md` -> `my-feature.md`).
        *   If a unique, strong filename match is found, this forms a candidate pair.
    *   **Content Snippet Check (for Candidate Pairs or Ambiguous Filenames)**:
        *   If filename matching is ambiguous or to confirm a candidate pair, read the first few significant lines (e.g., up to the first H2 heading, or first 10-15 lines) of both files in a potential pair.
        *   Compare these snippets for thematic similarity. Are they discussing the same core topic?
        *   If the content snippets are vastly different, the pair is considered to have **no content parity**, even if filenames were similar. Log this and do not proceed with detailed comparison for this pair.
    *   **Handling Unpaired Files**: Files in `Source A` that don't find a plausible pair in `Source B` (and vice-versa) should be noted as "unpaired" or "new/removed".

4.  **Detailed Comparison (for Parity-Confirmed Pairs)**:
    *   For each file pair that has passed both filename and content parity checks:
        *   Read the full content of both files.
        *   **Analyze for Relevant Differences**:
            *   **Structural Changes**: Compare the hierarchy of headings (H1, H2, H3, etc.). Note added, removed, or reordered sections.
            *   **Missing Content**: Identify if significant blocks of text, code examples, or entire sections from `Source A` are missing in `Source B`, or vice-versa.
            *   **Intent/Meaning Changes**: Look for substantive alterations in explanations, instructions, or definitions that change the core message or technical accuracy.
            *   **Code Block Differences**: For corresponding code blocks, highlight changes in the code itself, especially if functionality is affected.
            *   **Link/Reference Changes**: Note significant changes in hyperlinks or cross-references if they alter navigation or point to different resources.
        *   **Note Less Relevant Differences (Optional)**:
            *   Minor wording tweaks that don't change meaning.
            *   Purely stylistic formatting changes (unless they impact readability significantly).
            *   Etc...

5.  **Reporting**:
    *   Generate a summary report that includes:
        *   A list of all files from `Source A` and their corresponding paired file from `Source B` (if any).
        *   For each successfully paired and analyzed set:
            *   A summary of major relevant differences (missing content, structural changes, intent changes).
            *   Optionally, a brief note on minor differences.
        *   A list of files from `Source A` for which no pair with sufficient parity was found in `Source B` (with reason: e.g., "no filename match", "failed content parity check").
        *   A list of files present in `Source B` but not in `Source A` or vice-versa.

**Automation Notes & Considerations:**

*   Determining "relevance" of differences can be subjective. The workflow should aim to highlight objective changes (e.g., "Section X is missing") and provide enough context for a human to assess the impact.
*   Content similarity can be aided by NLP techniques (e.g., TF-IDF, embeddings) for more sophisticated content parity checks, but simpler heuristic checks (keywords, headings) might be sufficient for a first pass.
*   This workflow focuses on textual and structural comparison. It does not inherently validate the technical correctness of the content, only its comparative state.