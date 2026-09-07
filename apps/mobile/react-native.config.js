const path = require('path');

module.exports = {
    project: {
        ios: {},
        android: {},
    },
    assets: ['./src/assets/fonts'],
    // whisper.rn "exports" omits package.json, so RN codegen cannot resolve it from
    // dependencies alone — register the root so RNWhisperSpec is generated for New Arch.
    dependencies: {
        'whisper.rn': {
            root: path.join(__dirname, 'node_modules/whisper.rn'),
        },
    },
};
