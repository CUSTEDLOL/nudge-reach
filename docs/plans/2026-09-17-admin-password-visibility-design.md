# Founder sign-in password visibility

**Date:** 2026-09-17  
**Status:** Approved

## Goal

Let a founder verify the password they have typed on the founder sign-in page without weakening authentication or storing the password anywhere new.

## Design

Add an eye button inside the password field on `/admin`. The field remains masked by default. Activating the button toggles the input between `password` and `text`; activating it again restores masking.

The control will:

- use an explicit `type="button"` so it never submits the form;
- expose an accessible label that changes between “Show password” and “Hide password”;
- preserve the existing `current-password` autocomplete behavior;
- remain disabled while the sign-in action is pending; and
- keep the password only in the browser input, with no logging, persistence, or server changes.

This feature reveals only text currently entered by the user. It cannot reveal or reverse the bcrypt password hash stored by Supabase.

## Error handling

The toggle has no network or server failure path. Existing sign-in validation and generic authentication errors remain unchanged.

## Verification

Update the founder-login UI test to require the visibility button, its accessible labels, and the password/text toggle. Run the focused admin login tests, lint, and the production build before completion.
