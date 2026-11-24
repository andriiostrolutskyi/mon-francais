export const vocabularyPrompt = `
Create useful French flashcards for the supplied word or phrase.
Correct spelling and grammar.

Return:
- entries: One entry per common meaning, or only the intended meaning if context or a translation is supplied.
  Each entry contains:
  - french: The French dictionary form, without the noun article.
  - wordType: The part of speech in French.
  - article: The definite article in the grammatically correct form immediately before the supplied French noun, including elision where required; otherwise "".
  - gender: The grammatical gender in French, or "" if inapplicable.
  - english: One English translation for this meaning.
  - definition: A short definition in French.
  - examples: Natural sentences using this meaning, with French in fr and English in en.
  - cloze: Split one example into:
    - before: All text before the learned word or phrase.
    - answer: Only the learned word or phrase, inflected to fit the sentence.
    - after: All text after it.
    - translation: The example's complete English translation.
    Preserve spaces: before + answer + after must reproduce the example exactly.
  - notes: Brief grammar or usage tips in English, or "".
- note: A brief English explanation of any correction or ambiguity, or "".

If the input cannot be understood, return entries: [] and ask for context in note.
`;

export const readingPrompt = `
Create one engaging French reading text at the requested CEFR level
for vocabulary practice and TEF Canada / TCF Canada preparation.

Use the supplied format. Follow the topic if supplied.

Use as many vocabulary entries as fit naturally, in their intended meanings.
Adapt the grammatical form of each vocabulary entry as needed to fit the text.
Keep the text coherent, logical, and realistic; never force vocabulary at the expense of text quality.

Keep everything in French and at the requested level.

Return:
- title: A title for the reading.
- text: The complete reading text with paragraph breaks, without translation.
  Mark each vocabulary occurrence in its supplied meaning as [actual wording](ref), using only supplied refs.
  Link every repetition. For a separated expression, link each part with the same ref.
  Keep surrounding spaces and punctuation outside links.
  Reserve square brackets for these links; use no nesting or other markup.
- questions: Three comprehension questions based on the text.
  Each question contains:
  - prompt: The question.
  - options: Four answer options with exactly one correct answer.
  - answer: The zero-based index of the correct option.
  - explanation: A brief explanation of the answer based on the text.
- outputPrompt: A short writing task related to the reading.
- modelAnswer: An example response to the writing task.
`;

export const feedbackPrompt = `
Help the learner improve their French response to the supplied task.
Use the supplied reading text as context for the task.
Preserve the intended meaning.

Return:
- encouragement: Concise encouragement in English.
- corrections: Useful corrections, or [] if the response is correct.
  Each correction contains:
  - original: The French text needing correction.
  - corrected: The corrected French text.
  - explanation: A brief explanation in English.
- improved: An improved French response appropriate to the requested CEFR level.
`;
