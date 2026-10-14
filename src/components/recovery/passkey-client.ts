import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  passkeyRegistrationOptions,
  passkeySignInOptions,
  savePasskey,
  signInWithPasskey,
} from "@/app/actions/passkeys";
import type { ActionResult } from "@/lib/action-errors";

/** Turns the browser's WebAuthn errors into something worth showing a person. */
function describeDeviceError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return "The passkey prompt was closed. Try again when you're ready.";
  if (name === "InvalidStateError") return "This device already has a passkey saved for you here.";
  if (name === "SecurityError") return "Passkeys don't work on this web address.";
  return "Your device couldn't use a passkey.";
}

/** Saves a passkey for this band membership on the current device. */
export async function createPasskey(slug: string, token: string): Promise<ActionResult> {
  const options = await passkeyRegistrationOptions(slug, token);
  if (!options.ok || !options.data) return options.ok ? { ok: false, error: "Something went wrong." } : options;
  let response;
  try {
    response = await startRegistration({ optionsJSON: options.data });
  } catch (err) {
    return { ok: false, error: describeDeviceError(err) };
  }
  return savePasskey(slug, token, response);
}

/** Signs in to this band with a passkey saved on (or synced to) this device. */
export async function signInWithSavedPasskey(slug: string): Promise<ActionResult<{ token: string; memberName: string }>> {
  const options = await passkeySignInOptions(slug);
  if (!options.ok || !options.data) return options.ok ? { ok: false, error: "Something went wrong." } : options;
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options.data });
  } catch (err) {
    return { ok: false, error: describeDeviceError(err) };
  }
  return signInWithPasskey(slug, response);
}
