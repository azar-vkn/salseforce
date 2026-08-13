/**
 * Meta WhatsApp Business Platform Cloud API Client
 * Official Graph API Integration with exponential backoff rate-limit handling,
 * smart error diagnostics, and WABA-to-Phone auto-discovery.
 */

export interface SendWhatsAppTextMessageOptions {
  to: string;
  body: string;
  phoneId?: string;
  accessToken?: string;
  previewUrl?: boolean;
}

export interface SendWhatsAppTemplateMessageOptions {
  to: string;
  templateName?: string;
  languageCode?: string;
  phoneId?: string;
  accessToken?: string;
  components?: Array<{
    type: string;
    parameters: Array<{ type: string; text?: string; [key: string]: any }>;
  }>;
}

export interface WhatsAppInspectionResult {
  isValid: boolean;
  isTokenExpired: boolean;
  isWabaIdInstead: boolean;
  tokenInfo?: { id: string; name?: string };
  phoneDetails?: {
    id: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
  };
  discoveredPhoneNumbers?: Array<{
    id: string;
    displayPhoneNumber: string;
    verifiedName: string;
    qualityRating?: string;
  }>;
  error?: string;
  diagnosticAdvice?: string;
}

/**
 * Parses Meta Cloud API error responses into clear, actionable diagnostic advice.
 */
export function formatMetaCloudApiError(
  errorData: any,
  phoneId?: string,
  toPhone?: string
): string {
  const errorObj = errorData?.error || errorData;
  const rawMessage = errorObj?.message || "";
  const code = errorObj?.code;

  // 1. Session / Access Token Expired or Access Denied (Code 190 or 131005)
  if (code === 190 || code === 131005 || rawMessage.toLowerCase().includes("session has expired") || rawMessage.toLowerCase().includes("error validating access token") || rawMessage.toLowerCase().includes("access denied")) {
    return "WhatsApp Access Token Expired or Invalid: Your Meta Cloud API token is expired or unauthorized (Error 131005). If using a test token, remember they expire every 24 hours! Please generate a fresh token in Meta Business Manager and update it in Settings.";
  }

  // 2. Unsupported post request / Object ID does not exist (Code 100 or GraphMethodException)
  // This occurs when a WhatsApp Business Account (WABA) ID or App ID is used instead of the Phone Number ID in /messages endpoint
  if (
    code === 100 ||
    rawMessage.includes("Unsupported post request") ||
    rawMessage.includes("does not exist, cannot be loaded due to missing permissions")
  ) {
    return `Invalid Phone Number ID: Object with ID '${phoneId || "configured"}' cannot send messages. In Meta Developer Portal (WhatsApp → API Setup), make sure you copy the 'Phone number ID' (Step 1), NOT your WhatsApp Business Account ID or Meta App ID.`;
  }

  // 3. Recipient Phone Number Not Allowed (Code 131030 in development sandbox)
  if (code === 131030 || rawMessage.includes("recipient phone number not in allowed list") || rawMessage.includes("not in allowed list")) {
    const phoneStr = toPhone ? ` (+${toPhone})` : "";
    return `Recipient Not in Allowlist: On Meta test numbers, the recipient${phoneStr} must be added to the 'To' phone number allowlist in Meta Developer Portal (WhatsApp → API Setup).`;
  }

  // 4. Rate Limit / Pair Throttling (Code 131056 / 80007)
  if (code === 131056 || code === 80007 || rawMessage.includes("rate limit")) {
    return "Meta Rate Limit Exceeded: Message frequency exceeds Meta WhatsApp Cloud API throughput limits for this tier. Retries exhausted.";
  }

  // 5. Missing Permissions (Code 200 or 10)
  if (code === 200 || code === 10 || rawMessage.toLowerCase().includes("permission")) {
    return "Missing WhatsApp Permission: Your Meta access token requires the 'whatsapp_business_messaging' and 'whatsapp_business_management' permissions.";
  }

  // 6. Template not found / rejected (Code 132000 / 132001)
  if (code === 132000 || code === 132001 || rawMessage.toLowerCase().includes("template")) {
    return `WhatsApp Template Error: ${rawMessage || "Template does not exist or has not been approved by Meta."}`;
  }

  // 7. 24-hour window policy (Code 131047)
  if (code === 131047 || rawMessage.includes("24 hours")) {
    return "24-Hour Window Closed: You can only send free-form text messages within 24 hours of a customer's last message. Use a Template Message instead.";
  }

  // Fallback
  return rawMessage || `Meta Cloud API request failed (Code ${code || "unknown"})`;
}

/**
 * Gets stored WhatsApp credentials from localStorage or environment
 */
export function getWhatsAppCredentials() {
  const envPhoneId = import.meta.env.VITE_WHATSAPP_PHONE_ID || "";
  const envToken = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN || "";
  const envWabaId = import.meta.env.VITE_WHATSAPP_WABA_ID || "";

  if (typeof window === "undefined") {
    return { phoneId: envPhoneId, accessToken: envToken, wabaId: envWabaId };
  }

  // Helper: read localStorage value (may be JSON-stringified or plain)
  const readLS = (key: string): string => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return "";
      try { return JSON.parse(raw); } catch { return raw; }
    } catch { return ""; }
  };

  const lsPhoneId = readLS("salesmind-whatsapp-phone-id");
  const lsToken = readLS("salesmind-whatsapp-token");
  const lsWabaId = readLS("salesmind-whatsapp-waba-id");

  // Env vars take priority; localStorage is only a fallback
  return {
    phoneId: envPhoneId || lsPhoneId,
    accessToken: envToken || lsToken,
    wabaId: envWabaId || lsWabaId,
  };
}

/**
 * Inspects a Meta WhatsApp token and Phone ID / WABA ID to verify validity and auto-discover phone numbers.
 */
export async function inspectWhatsAppAccount(
  phoneIdInput?: string,
  tokenInput?: string,
  wabaIdInput?: string
): Promise<WhatsAppInspectionResult> {
  const creds = getWhatsAppCredentials();
  const activePhoneId = (phoneIdInput || creds.phoneId || "").trim();
  const activeToken = (tokenInput || creds.accessToken || "").trim();
  const activeWabaId = (wabaIdInput || creds.wabaId || "").trim();

  if (!activeToken) {
    return {
      isValid: false,
      isTokenExpired: false,
      isWabaIdInstead: false,
      error: "No WhatsApp Access Token provided.",
      diagnosticAdvice: "Enter your Meta System User Access Token in Settings.",
    };
  }

  try {
    // 1. Verify Token with /me
    const meRes = await fetch("https://graph.facebook.com/v21.0/me", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const meData = await meRes.json();

    if (!meRes.ok) {
      const isExpired = meData?.error?.code === 190 || meData?.error?.message?.toLowerCase().includes("session has expired");
      return {
        isValid: false,
        isTokenExpired: isExpired,
        isWabaIdInstead: false,
        error: meData?.error?.message || "Invalid Access Token",
        diagnosticAdvice: formatMetaCloudApiError(meData),
      };
    }

    const tokenInfo = { id: meData.id, name: meData.name };

    // 2. Check if activePhoneId is provided
    if (!activePhoneId) {
      // If no phone ID, but WABA ID is provided, try to discover phone numbers under WABA
      if (activeWabaId) {
        const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${activeWabaId}/phone_numbers`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        const wabaData = await wabaRes.json();
        if (wabaRes.ok && Array.isArray(wabaData.data)) {
          const discovered = wabaData.data.map((p: any) => ({
            id: p.id,
            displayPhoneNumber: p.display_phone_number,
            verifiedName: p.verified_name,
            qualityRating: p.quality_rating,
          }));
          return {
            isValid: true,
            isTokenExpired: false,
            isWabaIdInstead: true,
            tokenInfo,
            discoveredPhoneNumbers: discovered,
            diagnosticAdvice: "Found Phone Number IDs under your WhatsApp Business Account. Select one below to configure.",
          };
        }
      }

      return {
        isValid: false,
        isTokenExpired: false,
        isWabaIdInstead: false,
        tokenInfo,
        error: "Missing Phone Number ID",
        diagnosticAdvice: "Enter your 'Phone number ID' from Meta Developer Portal > WhatsApp > API Setup (Step 1).",
      };
    }

    // 3. Inspect the Phone ID node
    const phoneNodeRes = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const phoneNodeData = await phoneNodeRes.json();

    if (phoneNodeRes.ok && (phoneNodeData.display_phone_number || phoneNodeData.verified_name)) {
      return {
        isValid: true,
        isTokenExpired: false,
        isWabaIdInstead: false,
        tokenInfo,
        phoneDetails: {
          id: phoneNodeData.id,
          displayPhoneNumber: phoneNodeData.display_phone_number,
          verifiedName: phoneNodeData.verified_name,
          qualityRating: phoneNodeData.quality_rating,
        },
      };
    }

    // 4. If phone node failed, check if the ID is actually a WABA ID
    const wabaCheckRes = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const wabaCheckData = await wabaCheckRes.json();

    if (wabaCheckRes.ok && Array.isArray(wabaCheckData.data) && wabaCheckData.data.length > 0) {
      const discovered = wabaCheckData.data.map((p: any) => ({
        id: p.id,
        displayPhoneNumber: p.display_phone_number,
        verifiedName: p.verified_name,
        qualityRating: p.quality_rating,
      }));

      return {
        isValid: false,
        isTokenExpired: false,
        isWabaIdInstead: true,
        tokenInfo,
        discoveredPhoneNumbers: discovered,
        error: `ID '${activePhoneId}' is a WhatsApp Business Account (WABA) ID, not a Phone Number ID.`,
        diagnosticAdvice: `We detected ${discovered.length} Phone Number ID(s) inside this WABA. Please select a Phone Number ID below.`,
      };
    }

    // 5. General error on phone node
    return {
      isValid: false,
      isTokenExpired: phoneNodeData?.error?.code === 190,
      isWabaIdInstead: false,
      tokenInfo,
      error: phoneNodeData?.error?.message || `Failed to verify Phone Number ID '${activePhoneId}'.`,
      diagnosticAdvice: formatMetaCloudApiError(phoneNodeData, activePhoneId),
    };
  } catch (err: any) {
    return {
      isValid: false,
      isTokenExpired: false,
      isWabaIdInstead: false,
      error: err?.message || "Network error reaching Meta Graph API",
      diagnosticAdvice: "Check your internet connection or Meta API status.",
    };
  }
}

/**
 * Send a direct WhatsApp text message via Meta Cloud API v21.0
 * Includes exponential backoff for pair rate limits (error 131056) as specified by Meta.
 */
export async function sendWhatsAppTextMessage({
  to,
  body,
  phoneId,
  accessToken,
  previewUrl = true,
}: SendWhatsAppTextMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string; isSimulated?: boolean }> {
  const creds = getWhatsAppCredentials();
  const activePhoneId = (phoneId || creds.phoneId || "").trim();
  const activeToken = (accessToken || creds.accessToken || "").trim();

  if (!activePhoneId || !activeToken) {
    console.info("Meta WhatsApp Cloud API credentials not configured. Operating in simulation mode.");
    return { success: true, messageId: `sim_${Date.now()}`, isSimulated: true };
  }

  // Format phone number to E.164 without leading '+'
  const formattedPhone = to.replace(/\D/g, "");
  if (!formattedPhone || formattedPhone.length < 7) {
    return {
      success: false,
      error: `Invalid Phone Number ('${to}'): Please save a valid WhatsApp phone number with country code (e.g. 919876543210) for this lead.`,
    };
  }


  const endpoint = `https://graph.facebook.com/v21.0/${activePhoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: {
      preview_url: previewUrl,
      body,
    },
  };

  let maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }

      // Meta Error Code 131056: Rate limit / pair throttling error
      const errorCode = data.error?.code;
      if (errorCode === 131056 && attempt < maxRetries) {
        const backoffSeconds = Math.pow(4, attempt); // 4^X backoff per Meta docs
        console.warn(`WhatsApp Pair Rate Limit hit (131056). Retrying in ${backoffSeconds}s...`);
        await new Promise((r) => setTimeout(r, backoffSeconds * 1000));
        attempt++;
        continue;
      }

      // Format diagnostic error
      const formattedErr = formatMetaCloudApiError(data, activePhoneId, formattedPhone);
      return {
        success: false,
        error: formattedErr,
      };
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      } else {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Network error reaching Meta Graph API",
        };
      }
    }
  }

  return { success: false, error: "Maximum retries reached for WhatsApp delivery" };
}

/**
 * Send a WhatsApp Message Template for initial opt-in or out-of-window customer outreach
 */
export async function sendWhatsAppTemplateMessage({
  to,
  templateName = "jaspers_market_order_confirmation_v1",
  languageCode = "en_US",
  phoneId,
  accessToken,
  components,
}: SendWhatsAppTemplateMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string; isSimulated?: boolean }> {
  const creds = getWhatsAppCredentials();
  const activePhoneId = (phoneId || creds.phoneId || "").trim();
  const activeToken = (accessToken || creds.accessToken || "").trim();

  if (!activePhoneId || !activeToken) {
    return { success: true, messageId: `sim_tpl_${Date.now()}`, isSimulated: true };
  }

  const formattedPhone = to.replace(/\D/g, "");
  const endpoint = `https://graph.facebook.com/v21.0/${activePhoneId}/messages`;

  let templatePayload: any = {
    name: templateName,
    language: {
      code: languageCode,
    },
  };

  if (components && components.length > 0) {
    templatePayload.components = components;
  } else if (templateName === "jaspers_market_order_confirmation_v1") {
    templatePayload.components = [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Customer" },
          { type: "text", text: "123456" },
          { type: "text", text: new Date().toLocaleDateString() },
        ],
      },
    ];
  }

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: templatePayload,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }

    const formattedErr = formatMetaCloudApiError(data, activePhoneId, formattedPhone);
    return {
      success: false,
      error: formattedErr,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error reaching Meta Graph API",
    };
  }
}
