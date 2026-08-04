/**
 * Meta WhatsApp Business Platform Cloud API Client
 * Official Graph API Integration with exponential backoff rate-limit handling.
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
  templateName: string;
  languageCode?: string;
  phoneId?: string;
  accessToken?: string;
}

/**
 * Gets stored WhatsApp credentials from localStorage or environment
 */
export function getWhatsAppCredentials() {
  if (typeof window === "undefined") {
    return {
      phoneId: import.meta.env.VITE_WHATSAPP_PHONE_ID || "",
      accessToken: import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN || "",
    };
  }

  try {
    const rawPhoneId = window.localStorage.getItem("salesmind-whatsapp-phone-id");
    const rawToken = window.localStorage.getItem("salesmind-whatsapp-token");

    let phoneId = "";
    if (rawPhoneId) {
      try {
        phoneId = JSON.parse(rawPhoneId);
      } catch {
        phoneId = rawPhoneId;
      }
    }

    let accessToken = "";
    if (rawToken) {
      try {
        accessToken = JSON.parse(rawToken);
      } catch {
        accessToken = rawToken;
      }
    }

    return {
      phoneId: phoneId || import.meta.env.VITE_WHATSAPP_PHONE_ID || "",
      accessToken: accessToken || import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN || "",
    };
  } catch {
    return { phoneId: "", accessToken: "" };
  }
}


/**
 * Send a direct WhatsApp text message via Meta Cloud API v19.0
 * Includes exponential backoff for pair rate limits (error 131056) as specified by Meta.
 */
export async function sendWhatsAppTextMessage({
  to,
  body,
  phoneId,
  accessToken,
  previewUrl = true,
}: SendWhatsAppTextMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const creds = getWhatsAppCredentials();
  const activePhoneId = phoneId || creds.phoneId;
  const activeToken = accessToken || creds.accessToken;

  if (!activePhoneId || !activeToken) {
    console.info("Meta WhatsApp Cloud API credentials not configured. Operating in simulation mode.");
    return { success: true, messageId: `sim_${Date.now()}` };
  }

  // Format phone number to E.164 without leading '+'
  const formattedPhone = to.replace(/\D/g, "");

  const endpoint = `https://graph.facebook.com/v19.0/${activePhoneId}/messages`;
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

      return {
        success: false,
        error: data.error?.message || `Meta API failed with status ${response.status}`,
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
  templateName,
  languageCode = "en_US",
  phoneId,
  accessToken,
}: SendWhatsAppTemplateMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const creds = getWhatsAppCredentials();
  const activePhoneId = phoneId || creds.phoneId;
  const activeToken = accessToken || creds.accessToken;

  if (!activePhoneId || !activeToken) {
    return { success: true, messageId: `sim_tpl_${Date.now()}` };
  }

  const formattedPhone = to.replace(/\D/g, "");
  const endpoint = `https://graph.facebook.com/v19.0/${activePhoneId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
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

    return {
      success: false,
      error: data.error?.message || "Failed to send WhatsApp template message",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
