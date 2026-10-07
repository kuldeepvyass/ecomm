// Lighthouse CI — mobile (default Moto G Power emulation, simulated slow 4G).
// Run: npm run lighthouse  (builds & serves the e2e production build on :3200)
module.exports = {
  ci: {
    collect: {
      startServerCommand: "node scripts/e2e-server.mjs 3201",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 600000,
      url: [
        "http://localhost:3201/",
        "http://localhost:3201/watches",
        "http://localhost:3201/watches/halvard/field-38-manual-wind-hv-f38",
        "http://localhost:3201/collections/dive",
        "http://localhost:3201/faq",
      ],
      numberOfRuns: 3,
      settings: { chromeFlags: "--headless=new --no-sandbox", // is-crawlable: sample (isDemo) products are deliberately noindex; real products are indexable.
      skipAudits: ["is-on-https", "redirects-http", "is-crawlable"] },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:seo": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
