import type { Answer, Block } from './index.mjs';
export function answerToMarkdown(input: { question: string; answer: Answer; generatedAt?: string; idioma?: 'es' | 'en' }): string;
export function blockToCsv(block: Block): string;
export function answerToHtml(input: { question: string; answer: Answer; generatedAt?: string; userContext?: string[]; idioma?: 'es' | 'en' }): string;
export function chartToSvg(block: Block, idioma?: 'es' | 'en'): string;
