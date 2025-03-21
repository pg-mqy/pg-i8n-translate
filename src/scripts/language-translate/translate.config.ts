import { IncrementalMode, Lang } from 'language-translate/types'
import { defineConfig } from 'language-translate/utils'

export default defineConfig({
  proxy: {
    host: '127.0.0.1',
    port: 7890
  },
  fromLang: Lang.en,
  fromPath: 'locales/source/source.ts',
  translate: [
    {
      targetConfig: [
        {
          label: '中文',
          targetLang: 'zh-CN',
          outPath: 'locales/target/zh.ts'
        }
      ]
    }
  ]
})
