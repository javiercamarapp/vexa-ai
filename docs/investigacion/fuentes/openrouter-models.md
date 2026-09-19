# openrouter-models
Query: OpenRouter models API pricing supported_parameters embeddings model context length
Retrieved: 2026-09-19T01:54:04.877898+00:00

## https://openrouter.ai/docs/guides/overview/models
ID: doc:https://openrouter.ai/docs/guides/overview/models
# Models
One API for hundreds of models

Explore and browse 400+ models and providers on our website, or with our API.

## Query Parameters
### `supported_parameters`

### `sort`
| Value | Description |
|-|-|
| `pricing-low-to-high` | Cheapest models first (weighted average of prompt, completion, request, and web_search pricing) |
| `pricing-high-to-low` | Most expensive models first |
| `context-high-to-low` | Largest context window first |
| `throughput-high-to-low` | Highest tokens/second first (p50 throughput from routing heuristics) |
| `latency-low-to-high` | Lowest time-to-first-token first (p50 latency) |
| `newest` | Most recently added to OpenRouter |

## Models API Standard
### API Response Schema
#### Model Object Schema
| Field | Type | Description |
|-|-|-|
| `context_length` | `number` | Maximum context window size in tokens |
| `pricing` | `Pricing` | Pricing from the top provider for this model |
| `supported_parameters` | `string[]` | Array of supported API parameters for this model |

#### Pricing Object
##### Pricing Overrides

#### Supported Parameters
The `supported_parameters` array indicates which OpenAI-compatible parameters work with each model:

Some models break up text into chunks of multiple characters (GPT, Claude, Llama, etc), while others tokenize by character (PaLM). This means that token counts (and therefore costs) will vary between models, even when inputs and outputs are the same. Costs are displayed and billed according to the tokenizer for the model in use. You can use the `usage` field in the response to get the token counts for the input and output. </Note>

If there are models or providers you are interested in that OpenRouter doesn't have, please tell us about them in our Discord channel.

## https://github.com/prism-php/prism/blob/5d6cc65b80b19cf3f22744703ac0c727b68cdca8/docs/providers/openrouter.md
ID: doc:https://github.com/prism-php/prism/blob/5d6cc65b80b19cf3f22744703ac0c727b68cdca8/docs/providers/openrouter.md
# OpenRouter
OpenRouter provides access to multiple AI models through a single API.

## Usage
### Videos
[! NOTE] Video support varies by model.

### Provider Routing & Advanced Options
[! IMPORTANT]

Because metadata is centralized, you can double-check `supported_parameters`, context length, and per-request limits via the Models API before rolling out changes.

## Available Models
OpenRouter supports many models from different providers. The Models API returns structured metadata—`supported_parameters`, context length, pricing, and more—so you can verify capabilities programmatically before issuing requests. Some popular options include:

- `x-ai/grok-code-fast-1`
- `anthropic/claude-sonnet-4.5`
- `google/gemini-2.5-flash`
- `deepseek/deepseek-chat-v3-0324`
- `z-ai/glm-4.6`
- `tngtech/deepseek-r1t2-chimera:free`
- `qwen/qwen3-coder-30b-a3b-instruct`
- `mistralai/mistral-nemo`

## Features
- ✅ Multiple Model Support
- ❌ Embeddings (not yet implemented)

#### Reasoning Effort

Control how much reasoning the model performs before generating a response using the `reasoning` parameter. The way this is structured depends on the underlying model you are calling:

```php
$response = Prism::text()
    ->using(Provider::OpenRouter, 'openai/gpt-5-mini')
    ->withPrompt('Write a PHP function to implement a binary search algorithm with proper error handling')
    ->withProviderOptions([
        'reasoning' => [
            'effort' => 'high',  // Can be "high", "medium", or "low" (OpenAI-style)
            'max_tokens' =>  2000, // Specific token limit (Gemini / Anthropic-style)

            // Optional: Default is false. All models support this.
            'exclude' => false, // Set to true to exclude reasoning tokens from response
            // Or enable reasoning with the default parameters:
            'enabled' => true // Default: inferred from `effort` or `max_tokens`
        ]
    ])
    ->asText();
```

### Provider Routing & Advanced Options

Use `withProviderOptions()` to forward OpenRouter-specific controls such as model preferences or sampling parameters. Prism automatically forwards the native request values for `temperature`, `top_p`, and `max_tokens`, so you can continue tuning them through the usual Prism API without duplicating them in `withProviderOptions()`. For transform pipelines, OpenRouter currently documents `"middle-out"` as the primary example—consult the parameter reference for additional context.
… (26 more lines)

## https://github.com/corsairdev/corsair/blob/07b361c10f693d20d6c45fe3a63f139e4dd08400/docs/plugins/openrouter/api.mdx
ID: doc:https://github.com/corsairdev/corsair/blob/07b361c10f693d20d6c45fe3a63f139e4dd08400/docs/plugins/openrouter/api.mdx
**New to Corsair?**

## Embeddings
### create

## Models
### count
`models.count`

**Risk:** `read`

### list
List all models available on OpenRouter, including pricing, context length, and supported parameters

**Risk:** `read`

### listEmbeddings
`models.listEmbeddings`

**Risk:** `read`

| Name | Type | Required | Description |
|-|-|-|-|
| `offset` | `number` | No | — |
| `limit` | `number` | No | — |

### listEmbeddings

`models.listEmbeddings`

List all embedding models available on OpenRouter

**Risk:** `read`

```ts
await corsair.openrouter.api.models.listEmbeddings({});
```

**Input**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `offset` | `number` | No | — |
| `limit` | `number` | No | — |

**Output**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `object[]` | Yes | — |
| `links` | `object` | No | — |
| `total_count` | `number` | No | — |
… (99 more lines)
