import { defineShikiSetup } from '@slidev/types'

export default defineShikiSetup(() => {
  return {
    theme: 'vitesse-dark',
    langs: [
      'js',
      'java',
      'python',
      'haskell',
      'sql',
    ],
    transformers: [
      // ...
    ],
  }
})
