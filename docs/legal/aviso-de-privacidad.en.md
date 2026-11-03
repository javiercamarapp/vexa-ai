# Privacy notice

Version of November 3, 2026. It describes what the product does today.

## 1. Who is the controller

Rovaq AI is a software service for businesses, operated by [LEGAL_NAME], located at [ADDRESS], hereinafter Rovaq. This notice is issued under the Mexican Federal Law on the Protection of Personal Data Held by Private Parties.

## Two roles

Rovaq acts in two different roles. It is the controller of the data of the people who use the portal. It is the processor of the data about the buyers and operations of a customer company that the company loads or connects: toward those individuals the controller is the customer company, and Rovaq processes that data only on its behalf and following its instructions.

## 2. Data of portal users, as controller

- Sign-in email. Access is by a link sent to the email address, with email confirmation. Sign-in with Google may also be offered; in that case Google provides the email and basic account data.
- Team data. Which organization each person belongs to, with which role, pending invitations and the record of additions, role changes and revocations.
- Security records. Event type, path, method, user agent and an irreversible fingerprint of the IP address, not the address itself. Access rate counters keep only fingerprints of the email and the IP for one hour.
- Notifications. If the person turns them on: the destination email address, the delivery status, and for browser alerts the device subscription. After a complaint or a permanent bounce, a suppression by mailbox fingerprint is kept so we do not write again.
- Language preference and minimal technical session data.
- The messages you write to our contact email, with the content you decide to send.

## 3. Customer company data, as processor

- Support conversations: messages, channel, dates, authorship and any contact details the text contains, such as a buyer name, email or phone number.
- Orders and refunds: identifiers, products, amounts, dates and statuses, loaded from marketplace exports with the help of our team.
- Data read from the support tool the company connects, today HubSpot, with read-only permissions: conversations, messages, notes and basic ticket data. Rovaq does not write to that tool.
- Attachments and exports that the company hands over for loading.

## Sensitive data and redaction

The product is not designed to process sensitive personal data or data about minors. If the text of a conversation contained them, they form part of what the customer company decided to load, and the company answers for it toward its buyers. For analysis, each conversation is stored with a redacted version, separate from the original. Redacting is not anonymizing, and we do not say that the data is anonymized.

## 4. What we use the data for

- As controller: give access to the portal, authenticate the person and apply the permissions of their role.
- As controller: operate and protect the service, with security records, usage limits and abuse prevention.
- As controller: send the notifications and the weekly report that the person has turned on and handle unsubscribes.
- As controller: answer access, support and contact requests, and meet legal obligations.
- As processor, only to provide the service to the customer company and following its instructions: organize and analyze conversations, orders and refunds, group problems, show figures with their origin and propose actions that a person at the company decides.
- There are no secondary purposes. We do not sell personal data or use it for purposes other than providing the service.

## 5. Artificial intelligence

- Conversations are classified and grouped with language models only when the customer company enables it for its organization, in batches and with a spending limit. The AI classifies and drafts proposals. It does not calculate amounts, does not send anything and does not execute actions: a person at the company decides each one.
- What is sent to the model is the redacted version of the text, in which emails, phone numbers and the names that the organization policy configures are replaced. Redaction covers those patterns and those names; it does not recognize every kind of personal data, so identifiable information may remain in the text sent.
- Models are queried through OpenRouter, a model intermediary. The model providers that the code contemplates today are Anthropic, to classify and draft, and OpenAI, through Azure, to calculate the vectors used to group problems. Each request states that the provider must not collect the data and does not allow falling back to another provider. Processing may take place in the United States or in the European Union, depending on the organization configuration. Results carry a quote from the source text so that a person can review them.
- The AI reading of pain points, when the customer company enables it, sends to Anthropic directly only a redacted card of the point, with channel, product, status and reason. Before it is sent, it is checked for personal data and, if anything looks like it, it is not sent.
- The Ask feature of the general agent answers with rules and does not use a language model.

## 6. Providers that receive data and transfers

- Supabase: database, authentication and file storage. It receives all product data. The infrastructure may be outside Mexico.
- Vercel: hosting of the application and the site. It receives data in transit and technical logs that may include the IP address. It operates mainly in the United States.
- Resend: transactional email and delivery receipts. It receives the destination address and the content of the alert or report, when those features are active. It may be outside Mexico.
- OpenRouter and the language model providers it routes to, today Anthropic and OpenAI through Azure, plus Anthropic directly for the AI reading of pain points: they receive the redacted text described in section 5, only if the customer company enables the feature. They may be in the United States or in the European Union.
- Google: only if sign-in with Google is offered. It receives the authentication request of the person.
- The browser notification service, only if the person turns on browser alerts. It receives the device subscription.
- The support tool of the customer company, today HubSpot, is the source of the data the company connects. Rovaq only reads from it.
- These providers process data on behalf of Rovaq, as processors, and not for their own purposes. We do not use analytics, advertising or third party tags on the site or in the portal. Beyond the above, we only disclose data to an authority when a law or a valid order requires it.

## 7. How long we keep data and how it is deleted

- Customer company data. It is kept while the relationship lasts. The company decides what to keep: the workspace administrator has a retention screen that shows the exact scope before deleting and deletes nothing until confirmed. Deletion covers the associated messages, conversations, their versions, vectors, jobs, problems, files and attachments, and leaves a record of what was deleted. It does not delete the source in the company tool or the copies the company keeps.
- When the relationship ends. For 30 days we make an export of its data available to the company. We delete its data from the active systems within 60 days after termination, or earlier if the company asks in writing. We keep only what the law requires.
- Backups. The database has an automatic daily backup that is kept for 8 days. Deleted data may remain in it until those 8 days pass. There is no recovery to an exact point in time, file attachments are not covered by the backup and restoring a backup has not yet been tested.
- Security records. They are deleted after 180 days, and never before 30.
- User data. The account, the team and the notifications are kept while the account is active. After deactivation, we delete or block them within the following 90 days. The record of team changes and administration operations may be kept longer for security reasons and legal obligations.

## 8. ARCO rights and how to exercise them

- Every data subject may exercise their rights of access, rectification, cancellation and objection, and withdraw consent where applicable, under the applicable Mexican law.
- If your data is that of a portal user, Rovaq is the controller: write to [PRIVACY_EMAIL] with your name, the email you sign in with, the right you exercise and an identification that allows us to verify your identity. We will answer within the deadlines set by law.
- If your data is in conversations, orders or refunds of a company that uses Rovaq, send your request to that company, which is the controller. If you send it to us, we will forward it and support the company with the product tools: search by entity, scope preview, confirmed deletion and export, operated by the company workspace administrator.
- If you consider that your right was not addressed, you may turn to the competent personal data protection authority.

## 9. Security measures

- Each organization is kept separate from the others by database rules, not only by the application. There are four roles with different permissions: workspace administrator, analyst, operator and read-only.
- The connection is encrypted with HTTPS and the site and the application send security headers. Sessions use protected cookies.
- Access by Rovaq staff to the data of an organization is limited to authorized personnel bound by confidentiality. It may take place through a read-only support session, with a stated reason, a maximum duration of 60 minutes and a record, and through loading and maintenance tasks that the company requests.
- Administration operations, team changes and retention deletions are recorded. The record does not include data reads.
- There are no security certifications, no external penetration test has been performed and two-step verification is not mandatory for the users of customer companies. No measure guarantees total security. More detail on the Security and privacy page.

## 10. Cookies

We use session cookies needed to sign in to the portal, an active organization cookie and a language preference cookie called rovaq_lang, which lasts one year. If browser alerts are turned on, a device identifier is stored. We do not use advertising or analytics cookies.

## 11. Minors

The service is for businesses and is not directed at minors.

## 12. Changes to this notice

We will publish changes on this page with their date. If a change is substantial, we will notify portal users by email at least 30 days in advance.

## 13. Contact

- Controller: [LEGAL_NAME]. Address: [ADDRESS]. Privacy and ARCO requests email: [PRIVACY_EMAIL].
