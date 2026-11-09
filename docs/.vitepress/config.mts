import { defineConfig } from 'vitepress';

const APP = 'https://compbiochbiophlab.github.io/MecHand/app/';

export default defineConfig({
  title: 'MecHand',
  description: 'Draw reaction mechanisms by hand. MecHand recognizes them in your browser and exports them to LaTeX.',
  base: '/MecHand/',
  lang: 'en-GB',
  cleanUrls: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/MecHand/favicon.svg' }]],
  themeConfig: {
    logo: '/favicon.svg',
    nav: [
      { text: 'Open MecHand', link: APP, target: '_self' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Tutorial (PDF)', link: '/tutorial.pdf', target: '_blank' },
    ],
    sidebar: [
      {
        text: 'Using MecHand',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Drawing mechanisms', link: '/guide/drawing' },
          { text: 'Mechanism templates', link: '/guide/templates' },
          { text: 'Export to LaTeX and other editors', link: '/guide/export' },
          { text: 'Browser support', link: '/guide/browsers' },
          { text: 'Privacy', link: '/guide/privacy' },
        ],
      },
      {
        text: 'How it works',
        items: [
          { text: 'Handwriting recognition', link: '/guide/recognition' },
          { text: 'Optional DECIMER server', link: '/guide/server' },
          { text: 'User study mode', link: '/guide/study' },
          { text: 'Development', link: '/guide/development' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/CompBiochBiophLab/MecHand' }],
    search: { provider: 'local' },
    footer: {
      message: 'MIT licence (MecHand) · Apache 2.0 (Ketcher)',
      copyright: 'Jordi Villà-Freixa · Universitat de Vic – Universitat Central de Catalunya',
    },
    editLink: {
      pattern: 'https://github.com/CompBiochBiophLab/MecHand/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
