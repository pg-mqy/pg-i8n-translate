import { Lang } from 'language-translate/types';
import { defineConfig } from 'language-translate/utils';
import tunnel from 'tunnel';

type CustomExportConfig = {
    agent?: any;
} & Parameters<typeof defineConfig>[0];

const agent = tunnel.httpsOverHttp({
    proxy: {
        host: '127.0.0.1',
        port: 7890,
        headers: { 'User-Agent': 'Node' }
    }
});

export default defineConfig({
    agent,
    fromLang: Lang.en,
    fromPath: 'src/source/source.json',
    translate: [
        {
            label: '将结果翻译到 locales 文件夹下',
            targetConfig: [
                {
                    targetLang: Lang['zh-CN'],
                    outPath: 'src/target/zh.json',
                },
                {
                    targetLang: Lang['zh-TW'],
                    outPath: 'src/target/tc.json',
                },
                {
                    targetLang: Lang.de,
                    outPath: 'src/target/de.json',
                },
                {
                    targetLang: Lang.es,
                    outPath: 'src/target/es.json',
                },
                {
                    targetLang: Lang.ja,
                    outPath: 'src/target/ja.json',
                },
            ]
        }
    ]
} as CustomExportConfig);
