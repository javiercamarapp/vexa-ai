# openrouter-structured
Query: OpenRouter structured outputs response_format json_schema require_parameters supported models
Retrieved: 2026-09-19T01:54:03.473928+00:00

## https://openrouter.ai/docs/guides/features/structured-outputs
ID: doc:https://openrouter.ai/docs/guides/features/structured-outputs
# Structured Outputs
OpenRouter supports structured outputs for compatible models, ensuring responses follow a specific JSON Schema format.

## Using Structured Outputs

## Model Support
Structured outputs are supported by select models.

You can find a list of models that support structured outputs on the models page.

Support is determined per endpoint, not just per model: the same model may be served by multiple providers, and only some of those providers may support structured outputs. Endpoint support can also change over time. To see which providers support structured outputs for a specific model, check the `structured_outputs` parameter in the Providers section of the model's page.

To ensure your request is only routed to endpoints that support structured outputs:

1. Check the model's supported parameters on the models page
2. Set `require_parameters: true` in your provider preferences (see Provider Routing)
3. Include `response_format` and set `type: json_schema` in the required parameters

## Best Practices

1. **Include descriptions**: Add clear descriptions to your schema properties to guide the model

2. **Use strict mode**: Set `strict: true` so that providers with a native strict mode enforce your schema exactly. Enforcement varies by provider: some guarantee schema-conforming output, while others translate your schema into their own structured-output format or treat it as a strong hint, so exact compliance is not guaranteed on every endpoint. Strict modes may also restrict which JSON Schema features you can use. See the provider's documentation for details

## Example Implementation

Here's a complete example using the Fetch API:

<Template>
  <CodeGroup>
    ```typescript title="TypeScript SDK" expandable lines theme={null}
    import { OpenRouter } from '@openrouter/sdk';

    const openRouter = new OpenRouter({
      apiKey: '{{API_KEY_REF}}',
    });

    const response = await openRouter.chat.send({
      chatRequest: {
        model: '{{MODEL}}',
        messages: [
          { role: 'user', content: 'What is the weather like in London?' },
        ],
        responseFormat: {
          type: 'json_schema',
          jsonSchema: {
            name: 'weather',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'City or location name',
                },
                temperature: {
                  type: 'number',
… (118 more lines)

## https://github.com/openrouterteam/openrouter-examples/issues/20
ID: issue:openrouterteam/openrouter-examples#20
# Feature request: list structured output support on openrouter.ai/api/v1/models#20
## Description

This isn't well documented however you can use the supported_parameters query to filter for models that support `json_schema`. Example: [http://openrouter.ai/api/v1/models?supported\_parameters=structured\_outputs](http://openrouter.ai/api/v1/models?supported\_parameters=structured\_outputs)

To force OpenRouter to only route to providers that support json_schema you also have to set `require_parameters=true` in the providers object.

It would be great if that `supported_parameters` information was available in the JSON list of models too. As it stands I'm going to have to fetch and cache two JSON files - this one `https://openrouter.ai/api/v1/models` and also this one `https://openrouter.ai/api/v1/models?supported_parameters=structured_outputs` - then compare the two at runtime to decide which models support which features.

Have anyone found a working model on openrouter, which supports structured output?

[https://openrouter.ai/models?fmt=cards&supported\_parameters=response\_format](https://openrouter.ai/models?fmt=cards&supported\_parameters=response\_format)

@simonw the models endpoint now returns a `supported_parameters` list and `structured_outputs` is one of the values if the model provider claims that they support strict json output using `json_schema`.

## https://github.com/0xplaygrounds/rig/issues/1717
ID: issue:0xplaygrounds/rig#1717
# feat: Add structured outputs for Open Router#1717
## Feature Request
OpenRouter now supports structured outputs for compatible models through the `response_format` request parameter, using `type: "json_schema"` and a `json_schema` object containing the schema. Their documentation also notes that structured outputs are supported for both non-streaming and streaming responses.

### Motivation
OpenRouter is especially useful because it routes to many model providers, including models that already support structured outputs.

### Proposal

- Optionally expose or document OpenRouter’s `require_parameters: true` provider preference, since OpenRouter recommends using it to ensure the selected model supports `response_format`.
