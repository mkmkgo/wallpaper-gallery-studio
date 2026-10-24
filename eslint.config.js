import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import autoImportGlobals from './.eslintrc-auto-import.json' with { type: 'json' }

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'scripts/**', 'worker/**', 'server/**']
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettierConfig,
  {
    languageOptions: {
      globals: {
        ...autoImportGlobals.globals,
        // 浏览器全局变量
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FileReader: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        indexedDB: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        // Vitest 全局变量
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    },
    plugins: {
      prettier
    },
    rules: {
      'prettier/prettier': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/no-v-model-argument': 'off',
      'vue/require-default-prop': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-useless-escape': 'warn'
    }
  },
  {
    // EdgeOne Makers Cloud Function（Node 20 运行时，Web 标准 API + Node 全局），
    // 环境变量经 context.env / process.env 注入；手写白名单需在此补齐运行时全局，
    // 否则 pre-commit 的 lint-staged 会误报 no-undef。
    // 注意：根级 cloud-functions/[[default]].js 是 Makers 启用 Node 函数的
    // server-handler 入口，缺失会把项目降级为纯静态站。
    files: ['cloud-functions/**/*.js'],
    languageOptions: {
      globals: {
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        crypto: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
]
