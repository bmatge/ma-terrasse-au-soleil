"""Simple backend i18n — translates user-facing strings based on Accept-Language."""

from fastapi import Request

SUPPORTED_LANGS = ("fr", "en", "es", "de", "ja", "zh")
DEFAULT_LANG = "fr"

TRANSLATIONS: dict[str, dict[str, str]] = {
    "rate_limit": {
        "fr": "Trop de messages, réessaie plus tard.",
        "en": "Too many messages, please try again later.",
        "es": "Demasiados mensajes, inténtalo más tarde.",
        "de": "Zu viele Nachrichten, bitte versuche es später erneut.",
        "ja": "メッセージが多すぎます。後でもう一度お試しください。",
        "zh": "消息过多，请稍后再试。",
    },
    "name_message_required": {
        "fr": "Nom et message requis.",
        "en": "Name and message required.",
        "es": "Nombre y mensaje requeridos.",
        "de": "Name und Nachricht erforderlich.",
        "ja": "名前とメッセージは必須です。",
        "zh": "姓名和消息为必填项。",
    },
    "send_error": {
        "fr": "Erreur d'envoi : {error}",
        "en": "Send error: {error}",
        "es": "Error de envío: {error}",
        "de": "Sendefehler: {error}",
        "ja": "送信エラー: {error}",
        "zh": "发送错误：{error}",
    },
    "og_description": {
        "fr": "{name} — {address}. Consulte les créneaux ensoleillés sur Au Soleil.",
        "en": "{name} — {address}. Check sunny time slots on Au Soleil.",
        "es": "{name} — {address}. Consulta los horarios soleados en Au Soleil.",
        "de": "{name} — {address}. Sonnige Zeitfenster auf Au Soleil entdecken.",
        "ja": "{name} — {address}。Au Soleilで日当たりの良い時間帯をチェック。",
        "zh": "{name} — {address}。在Au Soleil查看阳光时段。",
    },
    "og_redirect": {
        "fr": "Redirection vers",
        "en": "Redirecting to",
        "es": "Redirigiendo a",
        "de": "Weiterleitung zu",
        "ja": "リダイレクト中",
        "zh": "正在跳转到",
    },
    "weather_morning_sunny": {
        "fr": "Matin ensoleillé",
        "en": "Sunny morning",
        "es": "Mañana soleada",
        "de": "Sonniger Morgen",
        "ja": "晴れの朝",
        "zh": "上午晴朗",
    },
    "weather_morning_mixed": {
        "fr": "Éclaircies le matin",
        "en": "Partly sunny morning",
        "es": "Claros por la mañana",
        "de": "Auflockerungen am Morgen",
        "ja": "朝はくもり時々晴れ",
        "zh": "上午多云转晴",
    },
    "weather_morning_cloudy": {
        "fr": "Matin nuageux",
        "en": "Cloudy morning",
        "es": "Mañana nublada",
        "de": "Bewölkter Morgen",
        "ja": "曇りの朝",
        "zh": "上午多云",
    },
    "weather_afternoon_clear": {
        "fr": "après-midi dégagé",
        "en": "clear afternoon",
        "es": "tarde despejada",
        "de": "klarer Nachmittag",
        "ja": "晴れの午後",
        "zh": "下午晴朗",
    },
    "weather_afternoon_mixed": {
        "fr": "éclaircies l'après-midi",
        "en": "partly sunny afternoon",
        "es": "claros por la tarde",
        "de": "Auflockerungen am Nachmittag",
        "ja": "午後はくもり時々晴れ",
        "zh": "下午多云转晴",
    },
    "weather_afternoon_cloudy": {
        "fr": "après-midi couvert",
        "en": "overcast afternoon",
        "es": "tarde nublada",
        "de": "bewölkter Nachmittag",
        "ja": "曇りの午後",
        "zh": "下午阴天",
    },
    "weather_no_forecast": {
        "fr": "Prévisions météo indisponibles — ensoleillement estimé sans nuages",
        "en": "Weather forecast unavailable — sunshine estimated without clouds",
        "es": "Pronóstico no disponible — soleamiento estimado sin nubes",
        "de": "Wettervorhersage nicht verfügbar — Sonnenschein ohne Wolken geschätzt",
        "ja": "天気予報なし — 雲なしで日照を推定",
        "zh": "天气预报不可用 — 按无云估算日照",
    },
}


def get_lang(request: Request) -> str:
    """Extract preferred language from Accept-Language header."""
    accept = request.headers.get("accept-language", "")
    for part in accept.split(","):
        tag = part.split(";")[0].strip().lower()
        lang = tag.split("-")[0]
        if lang in SUPPORTED_LANGS:
            return lang
    return DEFAULT_LANG


def tr(key: str, lang: str, **kwargs: str) -> str:
    """Get translated string by key and language."""
    texts = TRANSLATIONS.get(key, {})
    text = texts.get(lang, texts.get(DEFAULT_LANG, key))
    if kwargs:
        text = text.format(**kwargs)
    return text
