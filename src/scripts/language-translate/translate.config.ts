import { IncrementalMode, Lang } from 'language-translate/types'
import { defineConfig } from 'language-translate/utils'

export default defineConfig({
  proxy: {
    host: '127.0.0.1',
    port: 7890
  },
  fromLang: Lang["zh-CN"],
  fromPath: 'locales/source/zh.ts',
  translate: [
    {
      label: '将结果翻译到locales文件夹下',
      targetConfig: [
        {
          targetLang: Lang.es,
          outPath: 'locales/target/es.ts',
        },
        {
          targetLang: Lang.ja,
          outPath: 'locales/target/ja.ts',
        },
        {
          targetLang: Lang.ko,
          outPath: 'locales/target/ko.ts',
        },
        {
          targetLang: Lang.fr,
          outPath: 'locales/target/fr.ts',
        },
        {
          targetLang: Lang.de,
          outPath: 'locales/target/de.ts',
        },
        {
          targetLang: Lang.pt,
          outPath: 'locales/target/pt.ts',
        },
        {
          targetLang: Lang.sw,
          outPath: 'locales/target/sw.ts',
        },
      ]
    }
  ]
})
