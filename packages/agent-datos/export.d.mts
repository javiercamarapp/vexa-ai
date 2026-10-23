import type { Answer, Block } from './index.mjs';
export function answerToMarkdown(input: { question: string; answer: Answer; generatedAt?: string }): string;
export function blockToCsv(block: Block): string;
export function answerToHtml(input: { question: string; answer: Answer; generatedAt?: string; userContext?: string[] }): string;
export function chartToSvg(block: Block): string;
