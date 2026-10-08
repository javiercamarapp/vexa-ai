import test from 'node:test';
import assert from 'node:assert/strict';
import {assertAnonymousGoogleForm} from './auth-form-oracle.mjs';
test('anonymous Google POST form permits either attribute order',()=>{
 assertAnonymousGoogleForm('<form action="/auth/google" method="post"><button>Google</button></form>');
 assertAnonymousGoogleForm('<form class="SYN" method="post" action="/auth/google"><button>Google</button></form>');
});
test('Google GET cannot borrow POST from another form',()=>{
 assert.throws(()=>assertAnonymousGoogleForm('<form action="/auth/google" method="get"></form><form action="/auth/other" method="post"></form>'),/GOOGLE_FORM_POST/);
});
test('anonymous HTML cannot expose a logout form',()=>{
 assert.throws(()=>assertAnonymousGoogleForm('<form method="post" action="/auth/google"></form><form method="post" action="/auth/logout"></form>'),/ANONYMOUS_LOGOUT_ABSENT/);
});
