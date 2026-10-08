import assert from 'node:assert/strict';
// Inspect the same actual form, not a POST belonging to another action.
export function assertAnonymousGoogleForm(html){
 assert.match(html,/<form(?=\s)(?=[^>]*\saction="\/auth\/google")(?=[^>]*\smethod="post")[^>]*>/,'GOOGLE_FORM_POST');
 assert.doesNotMatch(html,/<form(?=\s)[^>]*\saction="\/auth\/logout"/,'ANONYMOUS_LOGOUT_ABSENT');
}
