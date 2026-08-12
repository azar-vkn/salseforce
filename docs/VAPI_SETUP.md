# Vapi AI Voice Receptionist & Webhook Setup Guide

This guide details how to configure Vapi AI Voice Receptionist with the SalesMind AI CRM using Supabase Edge Functions.

## 1. System Architecture
```
Caller Phone ──> Vapi Phone Number ──> Vapi AI Assistant
                                            │
                                  Server URL (Webhook)
                                            │
                                            ▼
                              Supabase Edge Function
                           (/functions/v1/vapi-webhook)
                                            │
                                  ┌─────────┴─────────┐
                                  ▼                   ▼
                           Tool Executions      Call Records &
                           (create_lead,        Transcripts Saved
                            find_customer,      in Supabase
                            update_customer)
```

## 2. Supabase Edge Function Deployment
Deploy the `vapi-webhook` Edge Function to your Supabase project:
```bash
npx supabase functions deploy vapi-webhook --no-verify-jwt
```
Your webhook URL will be:
`https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/vapi-webhook`

Set optional Vapi Webhook Secret in Supabase Secrets:
```bash
npx supabase secrets set VAPI_WEBHOOK_SECRET=your_custom_secret
```

## 3. Vapi Dashboard Setup
1. **Create Free Vapi Phone Number**:
   - In Vapi Dashboard: Go to **Phone Numbers** -> **Create Phone Number** -> **Free Vapi Number**.
2. **Create Assistant**:
   - Go to **Assistants** -> **Create Assistant**.
   - Name: `CRM AI Receptionist`.
   - First Message: `Hello! Thank you for calling SalesMind AI. How can I help you today?`
   - System Prompt:
     ```
     You are an AI receptionist for SalesMind AI.
     Your job is to answer incoming business calls professionally.
     - Greet the caller naturally.
     - Collect caller's name, phone number, and requirements.
     - Use registered tools 'find_customer', 'create_lead', and 'update_customer' to update CRM records.
     - Never invent business information or pricing.
     ```
3. **Configure Server URL (Webhook)**:
   - Under Assistant -> **Server URL**, paste your Supabase Edge Function URL:
     `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/vapi-webhook`
   - Set Header Secret (if configured): `x-vapi-secret: your_custom_secret`.
4. **Register Vapi Tools**:
   - `find_customer` (parameters: `phone`)
   - `create_lead` (parameters: `name`, `phone`, `email`, `company`, `requirement`, `budget`, `intent`)
   - `update_customer` (parameters: `leadId`, `phone`, `nextAction`, `emotion`, `stage`, `budget`)

## 4. Environment Variables
### Backend (Supabase Secrets)
```env
VAPI_API_KEY=vapi_live_xxx
VAPI_ASSISTANT_ID=vapi_asst_xxx
VAPI_PHONE_NUMBER_ID=vapi_phone_xxx
PUBLIC_WEBHOOK_BASE_URL=https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/vapi-webhook
```

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```
*(Note: Never expose private API keys in `VITE_*` frontend environment variables.)*
