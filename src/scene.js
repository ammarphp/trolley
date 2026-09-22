export function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function people(count, y, id) {
  if (count === null) return `<text x="788" y="${y - 18}" class="unknown-figure">?</text>`;
  const visible = Math.min(count, 7);
  return `<g id="${id}" class="track-people">${Array.from({ length: visible }, (_, i) => {
    const x = 798 - (visible - 1) * 17 + i * 34;
    return `<g transform="translate(${x} ${y})"><circle cy="-36" r="7" fill="currentColor"/><path d="M0-25V-9M-12-18L0-25 12-18M0-9-9 5M0-9 9 5" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/></g>`;
  }).join('')}</g>`;
}
export function scene(scenario, index) {
  const main = escapeHTML(scenario.mainLabel);
  const side = escapeHTML(scenario.sideLabel);
  return `<div class="scene" id="scene">
    <div class="scene-top"><span>FIG. ${String(index).padStart(3, '0')} / TWO POSSIBLE FUTURES</span><span class="scene-arrival"><i></i> TROLLEY INCOMING</span></div>
    <svg viewBox="0 0 1100 300" role="img" aria-label="Decision schematic. Original route: ${main}. Intervention route: ${side}. Symbols illustrate affected entities; read the outcomes for exact consequences.">
      <defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#dcdfd4"/></pattern></defs>
      <rect width="1100" height="300" fill="url(#dots)"/>
      <g stroke="#d0d3c6" stroke-width="3">${Array.from({ length: 45 }, (_, i) => `<path d="M${40 + i * 23} 112v19"/>`).join('')}${Array.from({ length: 22 }, (_, i) => `<path d="M${571 + i * 23} 232v19"/>`).join('')}</g>
      <g fill="none" stroke="#7b8271" stroke-width="1.7"><path d="M30 117H1080M30 127H1080"/><path d="M416 117C517 117 516 237 615 237H1080M416 127C509 127 508 247 615 247H1080"/></g>
      <path id="route-stay" d="M150 113H1060" fill="none" stroke="none"/>
      <path id="route-pull" d="M150 113H417C519 113 519 233 617 233H1060" fill="none" stroke="none"/>
      <g class="route-direction" stroke="#9fa592" stroke-width="1.4" fill="none"><path d="m543 112 10 10-10 10m98 100 10 10-10 10"/></g>
      ${people(scenario.mainCount, 103, 'people-main')}${people(scenario.sideCount, 223, 'people-side')}
      <g class="track-text"><text x="933" y="76">ORIGINAL ROUTE</text><text x="933" y="196">IF YOU INTERVENE</text></g>
      <g class="track-count"><text x="933" y="99">${main}</text><text x="933" y="219">${side}</text></g>
      <g class="lever" transform="translate(426 190)"><path d="M-16 9H16L9 1H-9Z" fill="#20251c"/><path id="lever-arm" d="M0 2-18-27" fill="none" stroke="#20251c" stroke-width="5" stroke-linecap="round"/><circle id="lever-knob" cx="-18" cy="-27" r="7" fill="#20251c"/><text x="-4" y="37" text-anchor="middle">YOUR LEVER</text></g>
      <g id="trolley" transform="translate(150 113)">
        <path d="M-48-57H35L46-44V-8H-48Z" fill="#d9f36b" stroke="#24291d" stroke-width="2"/>
        <path d="M-39-47H-15V-26H-39ZM-7-47H17V-26H-7ZM25-47H32L37-41V-26H25Z" fill="#f8f9ed" stroke="#24291d" stroke-width="1.5"/>
        <path d="M-48-20H46M-40-59H31M-8-60V-68H17" fill="none" stroke="#24291d" stroke-width="2"/>
        <circle cx="-29" cy="-5" r="7" fill="#24291d"/><circle cx="28" cy="-5" r="7" fill="#24291d"/>
        <text x="-31" y="-11" font-size="6" letter-spacing="1">T.D. 001</text>
      </g>
    </svg>
    <div class="scene-bottom"><span>${scenario.schematic ? 'OUTCOMES SHOWN SYMBOLICALLY. READ THE FINE PRINT.' : 'NOT TO SCALE. NEITHER IS THE RESPONSIBILITY.'}</span><span>NO BRAKES. TWO OPTIONS.</span></div>
  </div>`;
}
export function animateChoice(choice, reduced, onEnd) {
  const trolley = document.querySelector('#trolley');
  const path = document.querySelector(`#route-${choice}`);
  if (!trolley || !path) { onEnd(); return; }
  const scene = document.querySelector('#scene');
  scene.classList.add('moving', `choice-${choice}`);
  const status = scene.querySelector('.scene-arrival');
  status.textContent = choice === 'pull' ? 'ROUTE REASSIGNED' : 'ORIGINAL ROUTE';
  if (reduced) { status.textContent = 'DECISION RECORDED'; onEnd(); return; }
  const start = performance.now();
  const length = path.getTotalLength();
  function frame(now) {
    if (!trolley.isConnected) { onEnd(); return; }
    const p = Math.min(1, (now - start) / 1350);
    const point = path.getPointAtLength(length * (p * p * (3 - 2 * p)));
    trolley.setAttribute('transform', `translate(${point.x} ${point.y})`);
    trolley.style.opacity = p > .72 ? String(Math.max(0, (1 - p) / .28)) : '1';
    if (p < 1) requestAnimationFrame(frame);
    else { status.textContent = 'DECISION RECORDED'; onEnd(); }
  }
  requestAnimationFrame(frame);
}
