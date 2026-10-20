import type { Answer, Block } from './index.mjs';
export function answerToMarkdown(input: { question: string; answer: Answer; generatedAt?: string }): string;
export function blockToCsv(block: Block): string;
