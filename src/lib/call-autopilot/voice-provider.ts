import { type CallRecord, type CallTranscriptItem } from "@/lib/types";
import { VapiVoiceProvider, getVapiCredentials } from "./vapi-provider";
import { TwilioVoiceProvider, getTelephonyCredentials } from "./twilio-provider";

export interface VoiceProviderOptions {
  provider: "vapi" | "twilio" | "telnyx" | "vonage";
  accountId?: string;
  authToken?: string;
  phoneNumber?: string;
}

export interface VoiceCallEvent {
  event: "RINGING" | "ANSWERED" | "TRANSCRIPT" | "HUMAN_REQUESTED" | "COMPLETED" | "FAILED";
  callId: string;
  timestamp: string;
  transcriptItem?: CallTranscriptItem;
  confidence?: number;
  reason?: string;
}

export interface VoiceProvider {
  name: string;
  startOutboundCall(targetPhone: string, leadId: string): Promise<CallRecord>;
  endCall(callId: string): Promise<CallRecord>;
  transferCall(callId: string, destination?: string): Promise<{ success: boolean; callId: string; status: "TRANSFERRED" }>;
}

/** Production Voice Provider Factory */
export function getVoiceProvider(options?: VoiceProviderOptions): VoiceProvider {
  const selected = options?.provider || import.meta.env.VITE_VOICE_PROVIDER || "vapi";

  if (selected === "twilio") {
    const creds = getTelephonyCredentials();
    if (!creds.accountId || !creds.authToken || !creds.phoneNumber) {
      throw new Error(
        "Call Autopilot is not configured. Missing TELEPHONY_ACCOUNT_ID, TELEPHONY_AUTH_TOKEN, or TELEPHONY_PHONE_NUMBER. Please complete setup in Call Autopilot settings."
      );
    }
    return new TwilioVoiceProvider() as unknown as VoiceProvider;
  }

  // Default production provider: Vapi
  const vapiCreds = getVapiCredentials();
  if (!vapiCreds.apiKey || !vapiCreds.phoneNumberId) {
    // Check if Twilio creds exist as fallback
    const twilioCreds = getTelephonyCredentials();
    if (twilioCreds.accountId && twilioCreds.authToken && twilioCreds.phoneNumber) {
      return new TwilioVoiceProvider() as unknown as VoiceProvider;
    }
    throw new Error(
      "Call Autopilot is not configured. Missing VAPI_API_KEY / VAPI_PHONE_NUMBER_ID or TELEPHONY_ACCOUNT_ID. Please complete setup in Call Autopilot settings."
    );
  }

  return new VapiVoiceProvider() as VoiceProvider;
}
