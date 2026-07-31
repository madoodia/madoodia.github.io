# Implementation Plan: Checkbox Rephrasing & Phone Number Validation

This plan outlines changes to rephrase the client intake form's phone consultation checkbox to a more professional label and introduce robust pattern validation for phone numbers on both the frontend and backend.

## User Review Required

> [!NOTE]
> - The checkbox label will be updated to: **"I would like to request an introductory call to discuss my project requirements."**
> - The phone number validation will enforce a standard format allowing international formats (between 7 and 15 digits, allowing optional spaces, hyphens, periods, parentheses, and an optional leading plus sign).

## Proposed Changes

### Client Intake Form Page

#### [MODIFY] [index.html](file:///d:/madoodia/dev/madoodia.github.io/agency/index.html)
- Update the text label for the `#request-call` checkbox to: `"I would like to request an introductory call to discuss my project requirements."`
- Update the phone number placeholder to `+1 (555) 123-4567` (if not already set) and error message to `"Please enter a valid phone number (7-15 digits, digits/dashes/spaces only)"`.

#### [MODIFY] [script.js](file:///d:/madoodia/dev/madoodia.github.io/agency/script.js)
- Update `phoneRegex` to a robust E.164-compliant regex: `/^\+?(?:[0-9][-.\s()]*){7,15}$/`
- Ensure real-time validation feedback correctly triggers classes on invalid phone formats.

---

### Backend API

#### [MODIFY] [app.py](file:///d:/madoodia/dev/madoodia.github.io/backend/app.py)
- Import `field_validator` from `pydantic`.
- Add validation logic to `SubmissionCreate.phonenumber` using the same phone number regular expression to ensure the backend validates phone formats before writing to SQLite or forwarding to webhooks.

#### [NEW] [test_app.py](file:///d:/madoodia/dev/madoodia.github.io/backend/test_app.py)
- Create a test suite using `pytest` and `fastapi.testclient.TestClient` to verify the phone validation behavior on POST `/api/submit` for:
  - Valid formats: `+1 (555) 123-4567`, `09123456789`, `123-456-7890`.
  - Invalid formats: `abc`, `12345`, `+123456789012345678` (too long).

---

## Verification Plan

### Automated Tests
- Run `pytest` on `backend/test_app.py` in the backend environment.

### Manual Verification
- Launch the server locally and submit valid/invalid numbers from the UI.
- Verify validation states and professional checkbox layout in the browser.
