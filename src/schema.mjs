import { z } from 'zod';

// Keep the provider's native shape, including structured instructions and rubrics.
const textOrJson = z.union([z.string().min(1), z.record(z.string(), z.unknown()), z.array(z.unknown())]);
const key = z.string().min(1).max(128).refine(
  (v) => !['__proto__', 'constructor', 'prototype'].includes(v), 'Reserved key',
);
const choices = z.record(key, textOrJson.nullable()).refine(
  (v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 255,
  'Choice requires 1–255 options',
);
export const questionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('noul'), instructions: textOrJson,
    criteria: z.object({ true: textOrJson.optional(), false: textOrJson.optional() }).strict().optional(),
  }).strict(),
  z.object({ type: z.literal('choice'), instructions: textOrJson, criteria: choices }).strict(),
  z.object({ type: z.literal('score'), instructions: textOrJson, criteria: z.array(textOrJson).min(2).max(10) }).strict(),
]);

export const inputShape = {
  state: textOrJson.describe('Content to evaluate: text, records, documents, code, or other JSON. Only this supplied content is evaluated; URLs are not fetched.'),
  questions: z.record(key, questionSchema).refine(
    (v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 100,
    'Provide 1–100 questions per call',
  ).describe('Named independent questions. Noul: probability of yes. Choice: option descriptions. Score: 2–10 ordered descriptive levels, indexed from 0. IDs are only output keys: identify the target item in instructions, not just in its question ID.'),
};
export const inputSchema = z.object(inputShape).strict();

const probability = z.number().finite().min(0).max(1);
const distribution = z.record(z.string(), probability);
const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('noul'), noul: probability }),
  z.object({ type: z.literal('choice'), choice: z.string(), probabilities: distribution, confidence: probability }),
  z.object({ type: z.literal('score'), score: z.number().finite(), probabilities: distribution, confidence: probability, legend: z.record(z.string(), z.unknown()) }),
]);
export const outputSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
  latency_ms: z.number().nonnegative(),
  attempts: z.number().int().positive(),
});

export function validateAnswerSet(output, questions) {
  const ids = Object.keys(questions);
  if (Object.keys(output.answers).length !== ids.length) throw new Error('Incomplete answer set');
  for (const id of ids) {
    const q = questions[id];
    const a = output.answers[id];
    if (!a || a.type !== q.type) throw new Error('Missing or mismatched answer');
    if (a.type === 'noul') continue;
    const expected = q.type === 'choice' ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
    const actual = Object.keys(a.probabilities);
    if (actual.length !== expected.length || expected.some((k) => !Object.hasOwn(a.probabilities, k))) {
      throw new Error('Incomplete probability distribution');
    }
    const sum = Object.values(a.probabilities).reduce((s, p) => s + p, 0);
    if (Math.abs(sum - 1) > 0.03) throw new Error('Invalid probability total');
    if (a.type === 'choice' && !expected.includes(a.choice)) throw new Error('Unknown choice');
    if (a.type === 'score' && (a.score < 0 || a.score > q.criteria.length - 1)) throw new Error('Score outside rubric');
  }
  return output;
}
