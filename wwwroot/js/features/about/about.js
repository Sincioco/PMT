export function createAboutFeature({ app }) {
  function renderAbout() {
    app.innerHTML = `
      <section class="about-screen" aria-label="About PMT">
        <div class="about-logo-wrap">
          <img class="about-logo" src="/assets/pmt-logo-full.svg" alt="PMT - Project Management Tool">
        </div>
        <p class="about-credit">
          Created by <a href="http://sincioco.com/resume" target="_blank" rel="noopener noreferrer">Louiery R. Sincioco</a> on June 2026 to help companies who need an open-source solution for a Project or Task Management Tool for free.
          Open-source GitHub repository is at <a href="https://github.com/Sincioco/PMT" target="_blank" rel="noopener noreferrer">https://github.com/Sincioco/PMT</a>
        </p>
      </section>
    `;
  }

  return {
    render: renderAbout
  };
}
