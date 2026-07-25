// No real SMS-sending code exists anywhere in this codebase yet (verified by
// grep before writing this) — despite CLAUDE.md/ARCHITECTURE.md documenting
// SMS as an already-wired Twilio integration, every existing "notification"
// call site only inserts a row into the `notifications` table; none of them
// call a real provider. The 10-mile delivery alert needs to actually reach
// the customer's phone, so this is a real implementation, not another
// log-only stub. Calls Twilio's REST API directly via fetch (Basic Auth with
// Account SID/Auth Token) instead of adding the `twilio` npm package as a
// new dependency — the SDK buys nothing for a single POST to the Messages
// resource.
export interface SendSmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio is not configured.' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };

    if (!res.ok) {
      return { success: false, error: data.message ?? `Twilio responded with HTTP ${res.status}` };
    }

    return { success: true, sid: data.sid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Twilio error' };
  }
}
