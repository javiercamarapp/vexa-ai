# openrouter-privacy
Query: OpenRouter provider routing zero data retention zdr data_collection deny privacy
Retrieved: 2026-09-19T01:54:03.908532+00:00

## https://github.com/cultivatelabs/raif/blob/0c5c025a8ba23bbc643ae8f983d55e43a43d5b54/docs/_learn_more/provider_data_retention.md
ID: doc:https://github.com/cultivatelabs/raif/blob/0c5c025a8ba23bbc643ae8f983d55e43a43d5b54/docs/_learn_more/provider_data_retention.md
# Provider Data Retention
| Setting | Default | Sends | Applies to |
|-|-|-|-|
| `open_router_data_collection` | `"deny"` | `provider.data_collection` | `Raif::Llms::OpenRouter` |
| `open_router_zdr` | `false` | `provider.zdr` | `Raif::Llms::OpenRouter` |

Neither provider's parameter amounts to zero retention on its own.

## OpenAI Responses API

## OpenRouter
OpenRouter defaults `data_collection` to `"allow"`, which filters nothing, so without an explicit preference the only thing narrowing the routing is the account-level privacy setting on openrouter.ai, which the host app cannot read from its own code.

Raif sends `provider: { data_collection: "deny" }`, which routes only to providers that do not collect user data.

`"deny"` narrows the set of endpoints OpenRouter will route to.

Request preferences narrow within it rather than override it, so an account that denies data collection stays denied whatever a request asks for.

### Zero data retention
`data_collection` is about training and non-transient storage, not retention. OpenRouter states it has no routing rules based on providers' data retention policies, so a provider that holds prompts for a fixed window without training on them still satisfies `"deny"`.

`provider: { zdr: true }` is the control that restricts routing to endpoints with a Zero Data Retention policy. Raif sends it only when `open_router_zdr` is true:

It defaults to `false` because it is a far narrower filter than `data_collection`. Many models have no ZDR endpoint at all and will return a no-endpoints error once it is on.

The parameter is omitted rather than sent as `false`, since OpenRouter treats `false` and absent alike. A per-request `zdr` is OR'd with the account-wide and guardrail ZDR settings, so it can only add enforcement, never remove it.

### Zero data retention

`data_collection` is about training and non-transient storage, not retention. OpenRouter states it has no routing rules based on providers' data retention policies, so a provider that holds prompts for a fixed window without training on them still satisfies `"deny"`.

`provider: { zdr: true }` is the control that restricts routing to endpoints with a Zero Data Retention policy. Raif sends it only when `open_router_zdr` is true:

```ruby
Raif.configure do |config|
  config.open_router_zdr = true
end
```

It defaults to `false` because it is a far narrower filter than `data_collection`. Many models have no ZDR endpoint at all and will return a no-endpoints error once it is on. Check the models you use before enabling it.

The parameter is omitted rather than sent as `false`, since OpenRouter treats `false` and absent alike. A per-request `zdr` is OR'd with the account-wide and guardrail ZDR settings, so it can only add enforcement, never remove it.

## Overriding a setting

A `Raif::Task`, `Raif::Conversation` or `Raif::Agent` subclass can override either setting for every request it makes:

```ruby
class Raif::Tasks::PublicSummary < Raif::Task
  self.open_ai_store_responses = true

  def build_prompt
    "Summarize the following press release: ..."
  end
end
```

`Raif::Llm#chat` takes the same three keywords for a one-off override:

```ruby
Raif.llm(:open_ai_responses_gpt_4o).chat(
  message: "Summarize the following press release: ...",
  open_ai_store_responses: true
)
```
… (4 more lines)

## https://openrouter.ai/docs/guides/features/sovereign-ai
ID: doc:https://openrouter.ai/docs/guides/features/sovereign-ai
# Sovereign AI
## How OpenRouter Enables Sovereign AI
### In-Region Routing

### Zero Data Retention (ZDR)

### Data Collection Controls

When set to `"deny"`, your requests are only routed to providers that do not collect user data.

## Building a Sovereign AI Stack with OpenRouter
3. **Deny data collection** to prevent training on your data

## https://openrouter.ai/docs/guides/routing/provider-selection
ID: doc:https://openrouter.ai/docs/guides/routing/provider-selection
# Provider Routing
## Requiring Providers to Comply with Data Policies
| Field | Type | Default | Description |
|-|-|-|-|
| `data_collection` | "allow" | "deny" | "allow" | Control whether to use providers that may store data. |

## Zero Data Retention Enforcement
You can enforce Zero Data Retention (ZDR) on a per-request basis using the `zdr` parameter, ensuring your request only routes to endpoints that do not retain prompts.

When `zdr` is set to `true`, the request will only be routed to endpoints that have a Zero Data Retention policy. When `zdr` is `false` or not provided, it has no effect on routing.

The per-request `zdr` parameter
