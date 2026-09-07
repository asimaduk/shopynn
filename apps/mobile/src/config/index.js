// Security: use HTTPS for production-test / production release builds.
const PRODUCTION_TEST_API = 'https://o47fh1tg20.execute-api.af-south-1.amazonaws.com/dev/api';
const LOCAL_DEV_API = 'http://192.168.10.109:4000/api';
const BASE_API = __DEV__ ? LOCAL_DEV_API : PRODUCTION_TEST_API;

export default {
    test: "test",
    VERSION_NUMBER: 1,
    BASE_API,
    /** Local receipt agent (ims-web NewSale parity). On a physical device use your machine LAN IP, e.g. http://192.168.x.x:3001/print */
    LOCAL_PRINT_URL: 'http://127.0.0.1:3001/print',
    /** Matches ims-web default theme `themesConfig.default` (Fuse primary / secondary.light) */
    THEME_COLOR: '#0A74DA',
    THEME_COLOR_SHADE: '#6BC9F7',
    OTHER_COLOR: 'rgba(91,127,112)',
    GOLD_COLOR: 'rgba(191,156,106)',
    LIGHT_GREEN_COLOR: 'rgb(238,252,244)',
    GREEN_COLOR: 'rgb(98,178,112)',
    /** One-time Whisper STT model (ggml-base.en.bin, ~150MB). Override to host on your CDN in production. */
    VOICE_WHISPER_MODEL_URL:
        'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
}

//Vendo — Sell better. Serve faster.