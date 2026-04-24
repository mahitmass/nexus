"""
PrahaariNet — Alert dispatcher.

Fires:
  - Vernacular voice alert via Bhashini API (Hindi, Tamil, Telugu, Marathi)
  - WhatsApp Business Cloud API message

Both have graceful fallbacks: if API keys are missing, the call logs what
it WOULD have sent. The dashboard's frontend plays the voice via the browser's
Web Speech API regardless — so the demo always has audio.
"""
import asyncio
import logging
from typing import Optional

import httpx

log = logging.getLogger("prahaarinet.alerts")

HINDI_MESSAGE = "Ruk jaiye. Ye transaction ek dhokha ho sakta hai. Kripya cancel dabaiye."
ENGLISH_MESSAGE = "Stop. This transaction may be fraud. Please press cancel."


class AlertService:
    def __init__(
        self,
        bhashini_key: Optional[str] = None,
        bhashini_udyat: Optional[str] = None,
        whatsapp_token: Optional[str] = None,
        whatsapp_phone_id: Optional[str] = None,
    ):
        self.bhashini_key = bhashini_key
        self.bhashini_udyat = bhashini_udyat
        self.whatsapp_token = whatsapp_token
        self.whatsapp_phone_id = whatsapp_phone_id
        self.client = httpx.AsyncClient(timeout=8.0)

    async def fire_voice_alert(self, phone: str, lang: str = "hi", text: Optional[str] = None) -> dict:
        """Call Bhashini TTS. Returns status dict."""
        text = text or (HINDI_MESSAGE if lang == "hi" else ENGLISH_MESSAGE)

        if not self.bhashini_key:
            log.info(f"[BHASHINI·STUB] Would TTS to {phone} in {lang}: {text}")
            return {"status": "stub", "text": text, "lang": lang}

        try:
            # Bhashini ULCA TTS endpoint
            url = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/compute"
            payload = {
                "modelId": "633c021bbd966d1c7b0c40f7",  # IndicTTS Hindi (replace with your model)
                "task": "tts",
                "input": [{"source": text}],
                "gender": "female",
            }
            headers = {
                "Authorization": self.bhashini_key,
                "userID": self.bhashini_udyat or "",
                "Content-Type": "application/json",
            }
            r = await self.client.post(url, json=payload, headers=headers)
            if r.status_code == 200:
                log.info(f"[BHASHINI] Voice alert fired to {phone}")
                return {"status": "ok", "audio_b64": r.json().get("audio", [{}])[0].get("audioContent")}
            log.warning(f"[BHASHINI] Non-200: {r.status_code} {r.text[:200]}")
            return {"status": "error", "code": r.status_code}
        except Exception as e:
            log.warning(f"[BHASHINI] Exception: {e}")
            return {"status": "error", "error": str(e)}

    async def fire_whatsapp(self, phone: str, text: str) -> dict:
        """Send WhatsApp Business Cloud API message."""
        if not self.whatsapp_token or not self.whatsapp_phone_id:
            log.info(f"[WHATSAPP·STUB] Would send to {phone}: {text}")
            return {"status": "stub", "text": text}

        try:
            url = f"https://graph.facebook.com/v19.0/{self.whatsapp_phone_id}/messages"
            payload = {
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "text",
                "text": {"body": text},
            }
            headers = {
                "Authorization": f"Bearer {self.whatsapp_token}",
                "Content-Type": "application/json",
            }
            r = await self.client.post(url, json=payload, headers=headers)
            if r.status_code == 200:
                log.info(f"[WHATSAPP] Sent to {phone}")
                return {"status": "ok"}
            log.warning(f"[WHATSAPP] Non-200: {r.status_code} {r.text[:200]}")
            return {"status": "error", "code": r.status_code}
        except Exception as e:
            log.warning(f"[WHATSAPP] Exception: {e}")
            return {"status": "error", "error": str(e)}

    async def close(self):
        await self.client.aclose()
