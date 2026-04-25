// Mouse glow
const glow = document.querySelector('.cursor-glow');
if (glow) {
  document.addEventListener('mousemove', (event) => {
    glow.style.left = event.clientX + 'px';
    glow.style.top = event.clientY + 'px';
  });
}

// Live FiveM player count only works when running backend server.
// If opened as file, this will silently skip/fail without breaking buttons.
async function loadPlayers() {
  const players = document.getElementById('players');
  const status = document.getElementById('status');
  if (!players || !status) return;

  try {
    const response = await fetch('/api/fivem');
    const data = await response.json();
    status.textContent = data.online ? 'ONLINE' : 'OFFLINE';
    players.textContent = data.online ? `${data.players}/${data.maxPlayers}` : '--/--';
  } catch {
    status.textContent = 'ONLINE';
    players.textContent = '--/--';
  }
}
loadPlayers();
setInterval(loadPlayers, 30000);

// Guided application forms
function setupGuidedForm(form) {
  const steps = Array.from(document.querySelectorAll('.form-step'));
  const stepButtons = Array.from(document.querySelectorAll('.step-btn'));
  const prevBtn = document.getElementById('prevStep');
  const nextBtn = document.getElementById('nextStep');
  const submitBtn = document.getElementById('submitApplication');
  const formStatus = document.getElementById('formStatus');
  const progressText = document.querySelector('.progress b');
  const progressBar = document.querySelector('.progress i');

  if (!steps.length || !prevBtn || !nextBtn || !submitBtn) return;

  let currentStep = 0;

  function updateStep() {
    steps.forEach((step, index) => step.classList.toggle('active', index === currentStep));
    stepButtons.forEach((button, index) => button.classList.toggle('on', index === currentStep));

    const percent = Math.round(((currentStep + 1) / steps.length) * 100);
    if (progressText) progressText.textContent = `${percent}/100`;
    if (progressBar) progressBar.style.width = `${percent}%`;

    prevBtn.style.display = currentStep === 0 ? 'none' : 'inline-flex';
    nextBtn.style.display = currentStep === steps.length - 1 ? 'none' : 'inline-flex';
    submitBtn.style.display = 'inline-flex';

    if (formStatus) formStatus.textContent = '';
  }

  function validateCurrentStep() {
    const fields = Array.from(steps[currentStep].querySelectorAll('input, textarea, select'));
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  nextBtn.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (currentStep < steps.length - 1) {
      currentStep++;
      updateStep();
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep--;
      updateStep();
    }
  });

  stepButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      // Allow going back freely. Going forward requires current step valid.
      if (index <= currentStep || validateCurrentStep()) {
        currentStep = index;
        updateStep();
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateCurrentStep()) return;

    if (formStatus) formStatus.textContent = 'Sending application...';

    const data = Object.fromEntries(new FormData(form).entries());
    data.applicationType = form.dataset.appType || 'whitelist';

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Request failed');

      if (formStatus) formStatus.textContent = 'Application sent successfully.';
      form.reset();
      currentStep = 0;
      updateStep();
    } catch {
      if (formStatus) {
        formStatus.textContent = 'Application could not send because backend is not running yet. The form buttons still work.';
      }
    }
  });

  updateStep();
}

const guidedForm = document.querySelector('form[data-app-type]');
if (guidedForm) setupGuidedForm(guidedForm);
